import type { Track } from "../types";

/**
 * 推荐与个性化工具
 *
 * 规则：
 * - 完整版优先（preview=false 排在前面）
 * - 去重（按 id 与 artist+title 双重去重）
 * - 基于历史播放的艺人/流派加权
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

/** 从历史播放记录中提取最常听的艺人 */
export const topArtistsFromHistory = (
  history: Track[],
  limit = 3,
): string[] => {
  const counts = new Map<string, number>();
  for (const t of history) {
    const key = normalize(t.artist);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
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

/** 计算曲目与历史的匹配分 */
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
  /** 基于历史的“为你推荐” */
  forYou: Track[];
  /** 完整版优先推荐 */
  fullVersions: Track[];
  /** 新发行/随机发现 */
  discoveries: Track[];
  /** 快速播放列表（去重后的热门+推荐） */
  quickPicks: Track[];
}

/**
 * 生成主页推荐
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

  // 去重并完整版优先
  const unique = dedupeTracks(sortFullFirst(allTracks));

  // 精选：优先完整版 + 播放量/热度无法知道，随机选一首完整版
  const fullTracks = unique.filter((t) => !t.preview);
  const featured = fullTracks.length > 0 ? fullTracks[0] : unique[0] || null;

  // 热门趋势：随机shuffle前 N 首
  const trending = shuffleWithRng([...unique], rng).slice(0, 6);

  // 为你推荐：基于历史加权排序后取前 N
  const scored = unique.map((t) => ({
    track: t,
    score: scoreTrackForHistory(t, history) + scoreTrackForHistory(t, favorites),
  }));
  scored.sort((a, b) => b.score - a.score);
  const forYou = scored.slice(0, 6).map((s) => s.track);

  // 完整版专区
  const fullVersions = fullTracks.slice(0, 6);

  // 随机发现：从非推荐池中随机选
  const usedIds = new Set([
    ...trending.map((t) => t.id),
    ...forYou.map((t) => t.id),
    ...fullVersions.map((t) => t.id),
    ...(featured ? [featured.id] : []),
  ]);
  const pool = unique.filter((t) => !usedIds.has(t.id));
  const discoveries = shuffleWithRng(pool, rng).slice(0, 6);

  // 快速播放：综合精选+热门+完整版
  const quickPicks = dedupeTracks([featured, ...trending, ...fullVersions].filter(Boolean) as Track[]).slice(0, 10);

  return {
    greeting,
    featured,
    trending,
    forYou,
    fullVersions,
    discoveries,
    quickPicks,
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
