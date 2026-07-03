import type { Track } from "../types";
import { fetchRecommendationTracks } from "./musicSources";

/**
 * 推荐与个性化工具
 *
 * 改进版规则：
 * - 完整版优先（preview=false 排在前面）
 * - 去重（按 id 与 artist+title 双重去重）
 * - 基于历史播放的艺人加权 + 时间衰减
 * - 从多个来源并行搜索获取更多推荐曲目
 * - "因为你听过 X" 基于艺人推荐
 * - 随机洗牌但保持稳定（同一 session 内推荐一致）
 */

/** 根据当前时间返回问候语 */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
};

/** 简单随机种子：基于日期，保证同一天推荐稳定 */
const dailySeed = (): number => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

const mulberry32 = (seed: number) => {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_]+/g, " ")
    .trim();

/** 从标题中提取基础曲名（去掉括号、feat、remix 等版本信息） */
const baseTitle = (title: string): string => {
  return title
    .replace(/\(feat\.?[^)]*\)/gi, "")
    .replace(/\(ft\.?[^)]*\)/gi, "")
    .replace(/\([^)]*(remix|edit|mix|version|ver\.?|live|acoustic|instrumental|karaoke|official|video|audio|lyrics)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(remix|edit|mix|version|ver\.?|live|acoustic|instrumental|karaoke)[^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

/** 双重去重：按 id，再按 artist+baseTitle */
export const dedupeTracks = (tracks: Track[]): Track[] => {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: Track[] = [];

  for (const t of tracks) {
    if (seenIds.has(t.id)) continue;
    const key = `${normalize(t.artist)}::${normalize(baseTitle(t.title))}`;
    if (seenKeys.has(key)) continue;
    seenIds.add(t.id);
    seenKeys.add(key);
    out.push(t);
  }
  return out;
};

/** 完整版优先排序 */
export const sortFullFirst = (tracks: Track[]): Track[] => {
  return [...tracks].sort((a, b) => {
    if (a.preview === b.preview) return 0;
    return a.preview ? 1 : -1;
  });
};

/** 从历史播放记录中提取最常听的艺人（带时间衰减） */
export const topArtistsFromHistory = (
  history: Track[],
  limit = 5,
): { artist: string; count: number; originalName: string }[] => {
  const counts = new Map<string, { count: number; originalName: string }>();
  // 历史已按最近播放排序（index 0 = 最新），越近权重越高
  history.forEach((t, idx) => {
    const key = normalize(t.artist);
    const weight = 1 + (history.length - idx) / history.length;
    const existing = counts.get(key);
    if (existing) {
      existing.count += weight;
    } else {
      counts.set(key, { count: weight, originalName: t.artist });
    }
  });
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([k, v]) => ({ artist: k, count: v.count, originalName: v.originalName }));
};

/** 从历史播放记录中提取常听流派（用 album 字段简单推断） */
export const topGenresFromHistory = (
  history: Track[],
  limit = 3,
): string[] => {
  const counts = new Map<string, number>();
  for (const t of history) {
    const genre = normalize(t.album).split(" ")[0];
    if (genre) counts.set(genre, (counts.get(genre) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
};

/** 计算曲目与历史的匹配分（带时间衰减） */
const scoreTrackForHistory = (track: Track, history: Track[]): number => {
  const artists = new Set(history.map((t) => normalize(t.artist)));
  const titles = new Set(history.map((t) => normalize(baseTitle(t.title))));
  let score = 0;
  if (artists.has(normalize(track.artist))) score += 3;
  if (titles.has(normalize(baseTitle(track.title)))) score += 2;
  // 完整版加分
  if (!track.preview) score += 1;
  return score;
};

export interface RecommendationResult {
  /** 今日问候 */
  greeting: string;
  /** 每日精选：一首主打 */
  featured: Track | null;
  /** 热门趋势 */
  trending: Track[];
  /** 基于历史的"为你推荐" */
  forYou: Track[];
  /** 完整版优先推荐 */
  fullVersions: Track[];
  /** 新发行/随机发现 */
  discoveries: Track[];
  /** 快速播放列表（去重后的热门+推荐） */
  quickPicks: Track[];
  /** "因为你听过 X"：基于历史艺人的推荐 */
  becauseYouListened: { artist: string; tracks: Track[] }[];
  /** 从远程获取的额外推荐曲目 */
  remoteRecs: Track[];
}

/**
 * 异步获取远程推荐曲目（基于历史艺人搜索）
 */
export const fetchRemoteRecommendations = async (
  history: Track[],
  favorites: Track[],
  jamendoClientId?: string,
): Promise<{ artist: string; tracks: Track[] }[]> => {
  const topArtists = topArtistsFromHistory([...history, ...favorites], 3);
  if (topArtists.length === 0) return [];

  const results = await Promise.allSettled(
    topArtists.map(async (a) => {
      const tracks = await fetchRecommendationTracks([a.originalName], jamendoClientId, 6);
      return { artist: a.originalName, tracks: tracks.slice(0, 6) };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ artist: string; tracks: Track[] }> =>
      r.status === "fulfilled" && r.value.tracks.length > 0,
    )
    .map((r) => r.value);
};

/**
 * 生成主页推荐（同步部分）
 * @param allTracks 当前库中所有曲目
 * @param history 最近播放历史
 * @param favorites 收藏曲目
 */
export const generateRecommendations = (
  allTracks: Track[],
  history: Track[] = [],
  favorites: Track[] = [],
): RecommendationResult => {
  const greeting = getGreeting();
  const rng = mulberry32(dailySeed() + allTracks.length);

  // 合并库 + 历史 + 收藏后去重，提供更大的推荐池
  const pool = dedupeTracks(sortFullFirst([...allTracks, ...history, ...favorites]));

  // 精选：优先完整版，随机选一首
  const fullTracks = pool.filter((t) => !t.preview);
  const featured = fullTracks.length > 0
    ? fullTracks[Math.floor(rng() * Math.min(5, fullTracks.length))]
    : pool[0] || null;

  // 热门趋势：随机shuffle前 N 首
  const trending = shuffleWithRng([...pool], rng).slice(0, 8);

  // 为你推荐：基于历史加权排序后取前 N
  const combinedHistory = [...history, ...favorites];
  const scored = pool.map((t) => ({
    track: t,
    score: scoreTrackForHistory(t, combinedHistory),
  }));
  scored.sort((a, b) => b.score - a.score);
  const forYou = scored.slice(0, 8).map((s) => s.track);

  // 完整版专区
  const fullVersions = fullTracks.slice(0, 8);

  // 随机发现：从非推荐池中随机选
  const usedIds = new Set([
    ...trending.map((t) => t.id),
    ...forYou.map((t) => t.id),
    ...fullVersions.map((t) => t.id),
    ...(featured ? [featured.id] : []),
  ]);
  const remaining = pool.filter((t) => !usedIds.has(t.id));
  const discoveries = shuffleWithRng(remaining, rng).slice(0, 8);

  // 快速播放：综合精选+热门+完整版
  const quickPicks = dedupeTracks(
    [featured, ...trending, ...fullVersions].filter(Boolean) as Track[],
  ).slice(0, 12);

  // "因为你听过"（同步部分，仅基于已有数据）
  const topArtists = topArtistsFromHistory(combinedHistory, 3);
  const becauseYouListened = topArtists.map((a) => ({
    artist: a.originalName,
    tracks: pool
      .filter((t) => normalize(t.artist) === a.artist)
      .slice(0, 6),
  })).filter((g) => g.tracks.length > 0);

  return {
    greeting,
    featured,
    trending,
    forYou,
    fullVersions,
    discoveries,
    quickPicks,
    becauseYouListened,
    remoteRecs: [],
  };
};

const shuffleWithRng = <T>(arr: T[], rng: () => number): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
