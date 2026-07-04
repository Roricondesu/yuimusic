import type { LyricLine, FetchedLyrics } from "../types";
import { getItem, setItem, STORAGE_KEYS } from "../lib/storage";

/**
 * 歌词获取与解析模块
 *
 * 数据源（auto 模式下并行竞速，先返回有效结果者胜出）：
 * - 网易云音乐 (music.163.com) —— 国内访问快，中文歌词覆盖好
 * - LRCLIB (https://lrclib.net/) —— 开源歌词库，提供同步/纯文本歌词
 *
 * 优化点：
 * - 并行竞速：LRCLIB 和网易云同时请求，先返回有效歌词的源胜出
 * - 超时控制：网易云 8 秒、LRCLIB 4 秒超时
 * - localStorage 持久缓存：跨会话复用，避免重复请求（缓存键只依赖 artist + title，避免专辑名不一致导致命中失败）
 * - 内存 LRU 缓存：同会话内即时返回
 * - 清洗输入：去掉 feat. / ft. / remix / official video 等噪声
 * - 相似度匹配：综合 Jaccard、编辑距离、LCS 做 artist/title 模糊匹配
 * - MusicBrainz work 别名扩展：跨语言标题匹配
 */

const LRU_CACHE_SIZE = 50;
const LOCALSTORAGE_KEY = "yui-lyrics-cache";
const LOCALSTORAGE_MAX = 200; // localStorage 最多缓存 200 首歌词

/** 缓存项：携带原文、译文与来源标签 */
interface CachedLyrics {
  lines: LyricLine[];
  translationLines: LyricLine[];
  sourceLabel: string;
}

const lyricCache = new Map<string, CachedLyrics>();

/** 网易云歌词源超时（毫秒） */
const NETEASE_TIMEOUT = 8000;
/** LRCLIB 歌词源超时（毫秒） */
const LRCLIB_TIMEOUT = 4000;
/** MusicBrainz work 别名查询超时（毫秒） */
const MB_TIMEOUT = 4000;
const MB_USER_AGENT = "LiquidGlassMusic/0.2 (hello@liquidglass.app)";

/** 网易云 API 请求头（部分接口会校验 Referer / UA） */
const NETEASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
  Accept: "application/json, text/plain, */*",
};

// === localStorage 持久缓存 ===

const loadLocalCache = (): Map<string, CachedLyrics> => {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, CachedLyrics>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
};

const localCache = loadLocalCache();

const saveLocalCache = () => {
  try {
    // 只保留最近的 LOCALSTORAGE_MAX 条
    const entries = [...localCache.entries()].slice(-LOCALSTORAGE_MAX);
    const obj = Object.fromEntries(entries);
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(obj));
  } catch {
    // localStorage 可能已满，忽略
  }
};

// === 工具函数 ===

/** 标准化字符串：小写、去首尾空格、合并连续空格、去符号 */
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\s]/g, " ")
    .replace(/[\s\-_]+/g, " ")
    .trim();

/** 清洗曲目元数据，去掉常见噪声 */
const cleanTitle = (title: string): string => {
  return title
    .replace(/\(feat\.?[^)]*\)/gi, "")
    .replace(/\(ft\.?[^)]*\)/gi, "")
    .replace(/\(with [^)]*\)/gi, "")
    .replace(/\[[^\]]*(remix|edit|mix|version|ver\.?|live|acoustic|instrumental|karaoke)[^\]]*\]/gi, "")
    .replace(/\([^)]*(remix|edit|mix|version|ver\.?|live|acoustic|instrumental|karaoke|official|video|audio|lyrics)[^)]*\)/gi, "")
    .replace(/\s-\s[^-]*(remix|edit|mix|version|live|acoustic)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanArtist = (artist: string): string => {
  return artist
    .replace(/,\s*feat\.?[^,]*/gi, "")
    .replace(/,\s*ft\.?[^,]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanAlbum = (album: string): string => {
  return album
    .replace(/\(deluxe\)|\(target exclusive\)|\(vinyl lp\)|\(single\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

/** 给 Promise 加超时 */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);

// === LRC 解析 ===

/** 解析 LRC 格式歌词 */
export const parseLRC = (lrc: string): LyricLine[] => {
  const lines = lrc.split("\n");
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const matches = [...line.matchAll(timeRegex)];
    if (matches.length === 0) continue;
    const text = line.replace(timeRegex, "").trim();
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
      const time = min * 60 + sec + ms / 1000;
      result.push({ time, text });
    }
  }
  return result.sort((a, b) => a.time - b.time);
};

/** 为纯文本歌词生成合理时间戳（按句子长度加权分配） */
const distributePlainLyrics = (
  text: string,
  duration: number,
): LyricLine[] => {
  const lines = text
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  if (lines.length === 1) return [{ time: 0, text: lines[0] }];

  const totalChars = lines.reduce((acc, line) => acc + line.length, 0) || 1;
  const output: LyricLine[] = [];
  let currentTime = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ratio = line.length / totalChars;
    output.push({ time: currentTime, text: line });
    currentTime += ratio * duration;
  }
  return output;
};

/** 根据当前播放时间找到对应歌词索引 */
export const findLyricIndex = (
  lyrics: LyricLine[],
  currentTime: number,
): number => {
  if (lyrics.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= currentTime) idx = i;
    else break;
  }
  return idx;
};

// === 缓存管理 ===

const cacheKey = (artist: string, title: string): string =>
  `${normalize(artist)}::${normalize(title)}`;

const ensureCacheSize = () => {
  if (lyricCache.size <= LRU_CACHE_SIZE) return;
  const first = lyricCache.keys().next().value;
  if (first !== undefined) lyricCache.delete(first);
};

const getCached = (artist: string, title: string): CachedLyrics | undefined => {
  const key = cacheKey(artist, title);
  // 先查内存缓存
  const mem = lyricCache.get(key);
  if (mem) return mem;
  // 再查 localStorage
  const local = localCache.get(key);
  if (local) {
    // 回填内存缓存
    ensureCacheSize();
    lyricCache.set(key, local);
    return local;
  }
  return undefined;
};

const setCached = (artist: string, title: string, value: CachedLyrics) => {
  ensureCacheSize();
  const key = cacheKey(artist, title);
  lyricCache.set(key, value);
  localCache.set(key, value);
  saveLocalCache();
};

// === LRCLIB 歌词源 ===

interface LrclibGetResult {
  syncedLyrics?: string;
  plainLyrics?: string;
  instrumental?: boolean;
}

interface LrclibSearchResult {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

const fetchLrclibGet = async (
  artist: string,
  title: string,
  album?: string,
): Promise<LrclibGetResult | null> => {
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });
  if (album) params.set("album_name", album);

  const base = import.meta.env.DEV ? "https://lrclib.net/api/get" : "/api/proxy/lrclib/api/get";
  const res = await fetch(`${base}?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB get 错误: ${res.status}`);
  return (await res.json()) as LrclibGetResult;
};

const fetchLrclibSearch = async (
  q: string,
): Promise<LrclibSearchResult[]> => {
  const base = import.meta.env.DEV ? "https://lrclib.net/api/search" : "/api/proxy/lrclib/api/search";
  const res = await fetch(`${base}?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { results?: LrclibSearchResult[] }).results || [];
};

// === 模糊相似度计算 ===

/** 计算编辑距离（Levenshtein distance） */
const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = [];
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      }
      prev = temp;
    }
  }
  return dp[n];
};

/** 计算最长公共子序列长度（LCS） */
const lcsLength = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;

  let prev: number[] = new Array(n + 1).fill(0);
  let curr: number[] = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

/**
 * 计算两个字符串的综合相似度（0-1）
 * - 完全相等：1
 * - 包含关系：0.9
 * - 加权：Jaccard 词集 0.4 + 编辑距离归一化 0.35 + LCS 归一化 0.25
 */
const similarity = (a: string, b: string): number => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  // Jaccard 词集相似度
  const wordsA = na.split(" ").filter(Boolean);
  const wordsB = nb.split(" ").filter(Boolean);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  const jaccard = union.size === 0 ? 0 : intersection.length / union.size;

  // 编辑距离归一化相似度
  const maxLen = Math.max(na.length, nb.length);
  const editSim = maxLen === 0 ? 0 : 1 - levenshtein(na, nb) / maxLen;

  // 最长公共子序列归一化相似度
  const lcsSim = maxLen === 0 ? 0 : lcsLength(na, nb) / maxLen;

  return jaccard * 0.4 + Math.max(0, editSim) * 0.35 + lcsSim * 0.25;
};

/**
 * 构造多种备选搜索查询词，提高模糊命中率：
 * 1. artist + title
 * 2. title + artist（日韩/欧美有时平台顺序不同）
 * 3. 去掉括号内容后的 artist + title
 * 4. 仅 title（osu! 等来源 artist 字段不准时作为兜底）
 * 5. 去掉括号内容后的 title
 * 6. 仅 artist（适用于演唱会/live版本）
 */
const buildSearchQueries = (artist: string, title: string): string[] => {
  const queries: string[] = [];
  const a = artist.trim();
  const t = title.trim();
  const tNoParen = t.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "").trim();
  const aNoParen = a.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "").trim();

  // 优先 artist + title：这是最常见且准确的查询
  if (a && t) queries.push(`${a} ${t}`);
  if (a && t && a !== t) queries.push(`${t} ${a}`);
  if (aNoParen && tNoParen && `${aNoParen} ${tNoParen}` !== `${a} ${t}`) {
    queries.push(`${aNoParen} ${tNoParen}`);
  }

  // 然后仅 title（适用于 artist 字段不准的情况）
  if (t) queries.push(t);
  if (tNoParen && tNoParen !== t) queries.push(tNoParen);

  // 最后仅 artist（适用于 live/演唱会版）
  if (a) queries.push(a);

  return [...new Set(queries)].slice(0, 6);
};

const pickBestSearchResult = (
  results: LrclibSearchResult[],
  artist: string,
  title: string,
): LrclibSearchResult | null => {
  if (results.length === 0) return null;
  const normTitle = normalize(title);
  const normArtist = normalize(artist);
  const scored = results.map((r) => {
    const rTitle = r.trackName || r.name;
    const titleSim = similarity(rTitle, title);
    const artistSim = artist ? similarity(r.artistName, artist) : 0;
    // 完全命中任一字段额外加分，但不能双 0
    const exactTitle = normalize(rTitle) === normTitle ? 0.12 : 0;
    const exactArtist =
      artist && normalize(r.artistName) === normArtist ? 0.08 : 0;
    const combined = titleSim * 0.55 + artistSim * 0.35 + exactTitle + exactArtist;
    // 只要 title 或 artist 任一较高，也允许入选
    const score = Math.max(combined, titleSim * 0.9, artistSim * 0.9);
    return { result: r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best.score >= 0.22 ? best.result : null;
};

const lyricsFromLrclibResult = (
  data: LrclibGetResult | LrclibSearchResult,
  duration: number,
): LyricLine[] => {
  if (data.instrumental) return [{ time: 0, text: "♪ 纯音乐" }];
  if ("syncedLyrics" in data && data.syncedLyrics) {
    return parseLRC(data.syncedLyrics);
  }
  if ("plainLyrics" in data && data.plainLyrics) {
    return distributePlainLyrics(data.plainLyrics, duration);
  }
  return [];
};

/** 从 LRCLIB 获取歌词（多策略回退，整体加超时） */
const fetchFromLrclib = async (
  artist: string,
  title: string,
  album: string | undefined,
  duration: number,
): Promise<LyricLine[]> => {
  const tryGet = async (
    a: string,
    t: string,
    al?: string,
  ): Promise<LyricLine[]> => {
    const result = await fetchLrclibGet(a, t, al);
    if (result) {
      const lyrics = lyricsFromLrclibResult(result, duration);
      if (lyrics.length) return lyrics;
    }
    return [];
  };

  // 策略 1：宽松匹配（artist + title），专辑名在不同来源间经常不一致，
  // 因此先尝试不带 album 的匹配
  const loose = await tryGet(artist, title);
  if (loose.length) return loose;

  // 策略 2：严格匹配（artist + title + album）
  if (album) {
    const lyrics = await tryGet(artist, title, album);
    if (lyrics.length) return lyrics;
  }

  // 策略 3：多组查询词并行搜索
  const queries = buildSearchQueries(artist, title);
  if (queries.length > 0) {
    const searchResults = await Promise.all(
      queries.map((q) => fetchLrclibSearch(q)),
    );
    const allResults = searchResults.flat();
    if (allResults.length > 0) {
      const best = pickBestSearchResult(allResults, artist, title);
      if (best) {
        const lyrics = lyricsFromLrclibResult(best, duration);
        if (lyrics.length) return lyrics;
      }
    }
  }

  return [];
};

// === MusicBrainz work 别名扩展 ===

interface MusicBrainzWorkAlias {
  name: string;
  "sort-name": string;
  locale?: string;
  type?: string;
  primary?: boolean | null;
}

interface MusicBrainzWork {
  id: string;
  title: string;
  score: number;
  aliases?: MusicBrainzWorkAlias[];
}

interface MusicBrainzWorkResponse {
  works?: MusicBrainzWork[];
}

const mbWorkAliasCache = new Map<string, string[]>();

const loadMbWorkAliasCache = (): Map<string, string[]> => {
  try {
    const raw = localStorage.getItem("yui-mb-work-aliases");
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string[]>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
};

const mbWorkAliasLocalCache = loadMbWorkAliasCache();

const saveMbWorkAliasCache = () => {
  try {
    const entries = [...mbWorkAliasLocalCache.entries()].slice(-100);
    localStorage.setItem("yui-mb-work-aliases", JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore
  }
};

/**
 * 查询 MusicBrainz work 别名，用于跨语言标题匹配。
 * 例如：来源是 "Gurenge"，MB work 会返回别名 "紅蓮華"，
 * 再用 "紅蓮華" 去网易云搜索就能找到 LiSA 原曲。
 */
const fetchMusicBrainzWorkAliases = async (
  artist: string,
  title: string,
): Promise<string[]> => {
  const key = `${normalize(artist)}::${normalize(title)}`;
  const cached = mbWorkAliasCache.get(key) ?? mbWorkAliasLocalCache.get(key);
  if (cached) return cached;

  if (!artist.trim() || !title.trim()) return [];

  try {
    const url = `https://musicbrainz.org/ws/2/work/?query=%28work:${encodeURIComponent(
      title,
    )}%20OR%20alias:${encodeURIComponent(title)}%29%20AND%20artist:${encodeURIComponent(
      artist,
    )}&fmt=json&limit=3`;
    const res = await withTimeout(
      fetch(url, { headers: { "User-Agent": MB_USER_AGENT } }),
      MB_TIMEOUT,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as MusicBrainzWorkResponse;
    const works = data.works || [];
    if (works.length === 0) return [];

    // 取 score 最高的 work 的别名
    const best = works.reduce((max, w) => (w.score > max.score ? w : max), works[0]);
    const aliases = (best.aliases || [])
      .map((a) => a.name)
      .filter((n) => normalize(n) !== normalize(title));
    const result = [...new Set([best.title, ...aliases])].slice(0, 6);

    mbWorkAliasCache.set(key, result);
    mbWorkAliasLocalCache.set(key, result);
    saveMbWorkAliasCache();
    return result;
  } catch {
    return [];
  }
};

// === 网易云音乐歌词源 ===

interface NeteaseSong {
  id: number;
  name: string;
  alias?: string[];
  artists?: { id: number; name: string }[];
  album?: { id: number; name: string };
  duration: number;
}

interface NeteaseSearchResponse {
  result?: {
    songs?: NeteaseSong[];
  };
  code: number;
}

interface NeteaseLyricResponse {
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
  code: number;
}

/**
 * 构造网易云 API URL。
 * - 开发环境：通过 Vite 代理（/netease-api），无 CORS 问题
 * - 生产环境：通过 EdgeOne Edge Function 代理（/api/proxy/netease）
 */
const buildNeteaseUrl = (path: string, params: Record<string, string>): string => {
  const queryString = new URLSearchParams(params).toString();
  if (import.meta.env.DEV) {
    return `/netease-api${path}?${queryString}`;
  }
  return `/api/proxy/netease${path}?${queryString}`;
};

/** 在网易云搜索结果中挑选最佳匹配 */
const pickBestNeteaseSong = (
  songs: NeteaseSong[],
  artist: string,
  title: string,
  duration: number,
  titleAliases: string[] = [],
): NeteaseSong | null => {
  if (songs.length === 0) return null;
  const normArtist = normalize(artist);
  const allTitles = [title, ...titleAliases];
  const trackDurationMs = (duration || 240) * 1000;
  const hasArtist = Boolean(artist.trim());

  const scored = songs.map((s) => {
    // 标题相似度：同时与原始 title 及 MusicBrainz 别名（跨语言）比较
    const titleSim = Math.max(...allTitles.map((t) => similarity(s.name, t)));

    const artistNames = s.artists?.map((a) => a.name).join(" ") || "";
    const artistSim = hasArtist ? similarity(artistNames, artist) : 0;

    // alias 字段匹配（网易云 alias 常有其他语言名或副标题）
    const aliasSim =
      s.alias && s.alias.length > 0
        ? Math.max(...s.alias.map((a) => similarity(a, title)))
        : 0;

    // 时长匹配辅助
    const durationDiff = Math.abs((s.duration || 0) - trackDurationMs);
    const durationMatch =
      s.duration > 0 && durationDiff / Math.max(s.duration, 1) < 0.15 ? 0.15 : 0;

    // 完全匹配艺人或标题任一，额外加分
    const exactTitle =
      allTitles.some((t) => normalize(s.name) === normalize(t)) ? 0.15 : 0;
    const exactArtist =
      hasArtist && s.artists?.some((a) => normalize(a.name) === normArtist)
        ? 0.1
        : 0;

    const titleOrAlias = Math.max(titleSim, aliasSim);

    // 综合分：优先名字相似度（title 占 60%、artist 占 30%），时长和完全命中作为辅助
    let score = titleOrAlias * 0.6 + artistSim * 0.3 + durationMatch + exactTitle + exactArtist;

    // 标题完全命中但艺人明显不对时，小幅降权，避免同名翻唱大幅领先
    if (titleOrAlias >= 0.95 && hasArtist && artistSim < 0.3) {
      score *= 0.75;
    }

    return { song: s, score, titleSim, artistSim };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;

  // 入选阈值放低：名字差不多即可匹配
  if (best.score >= 0.3) return best.song;

  // 兜底：若没有任何结果达到阈值，但 top1 的 title 或 artist 任一明显相似，也返回
  if (best.titleSim >= 0.5 || best.artistSim >= 0.5) return best.song;

  return null;
};

/** 执行网易云搜索并返回去重后的歌曲列表 */
const searchNetease = async (queries: string[]): Promise<NeteaseSong[]> => {
  if (queries.length === 0) return [];
  const searchResults = await Promise.all(
    queries.map((q) =>
      fetch(buildNeteaseUrl("/api/search/get", {
        s: q,
        type: "1",
        limit: "30",
        offset: "0",
      }), { headers: NETEASE_HEADERS }).then((r) =>
        r.ok ? (r.json() as Promise<NeteaseSearchResponse>) : null,
      ),
    ),
  );
  return searchResults
    .flatMap((r) => r?.result?.songs || [])
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
};

/** 从网易云获取歌词（搜索 → 匹配 → 获取歌词），同时捕获译文 */
const fetchFromNetease = async (
  artist: string,
  title: string,
  duration: number,
): Promise<{ lines: LyricLine[]; translationLines: LyricLine[] }> => {
  // 同时获取 MusicBrainz work 别名（跨语言标题）和构造常规查询
  const [queries, aliases] = await Promise.all([
    Promise.resolve(buildSearchQueries(artist, title)),
    fetchMusicBrainzWorkAliases(artist, title),
  ]);

  // 把别名也扩展成查询词，与常规查询合并后一次性搜索
  const aliasQueries = aliases
    .flatMap((a) => buildSearchQueries(artist, a))
    .filter((q, i, arr) => arr.indexOf(q) === i);
  const allQueries = [...new Set([...queries, ...aliasQueries])].slice(0, 10);

  const songs = await searchNetease(allQueries);
  const best = pickBestNeteaseSong(songs, artist, title, duration, aliases);

  if (!best) return { lines: [], translationLines: [] };

  // 获取歌词
  const lyricUrl = buildNeteaseUrl("/api/song/lyric", {
    id: String(best.id),
    lv: "1", // 原文歌词
    kv: "1", // 卡拉OK歌词
    tv: "-1", // 翻译歌词
  });
  const lyricRes = await fetch(lyricUrl, { headers: NETEASE_HEADERS });
  if (!lyricRes.ok) return { lines: [], translationLines: [] };
  const lyricData = (await lyricRes.json()) as NeteaseLyricResponse;

  // 优先使用 LRC 同步歌词
  const lrc = lyricData?.lrc?.lyric;
  let lines: LyricLine[] = [];
  if (lrc) {
    const parsed = parseLRC(lrc);
    if (parsed.length > 0) lines = parsed;
  }

  // 译文（tlyric）
  let translationLines: LyricLine[] = [];
  const tlyric = lyricData?.tlyric?.lyric;
  if (tlyric) {
    const parsedT = parseLRC(tlyric);
    if (parsedT.length > 0) translationLines = parsedT;
  }

  return { lines, translationLines };
};

// === 酷狗音乐歌词源 ===

interface KugouSong {
  hash: string;
  sqhash?: string;
  songname: string;
  singername?: string;
  album_name?: string;
  album_id?: string;
  duration?: number;
}

interface KugouSearchResponse {
  status: number;
  data?: {
    info?: KugouSong[];
  };
}

interface KugouLyricCandidate {
  id: string;
  accesskey: string;
  singer: string;
  song: string;
  duration: number;
}

interface KugouLyricSearchResponse {
  status: number;
  errmsg?: string;
  candidates?: KugouLyricCandidate[];
}

interface KugouLyricDownloadResponse {
  status: number;
  content?: string;
}

const buildKugouUrl = (base: string, params: Record<string, string>): string => {
  const query = new URLSearchParams(params).toString();
  if (import.meta.env.DEV) {
    return `/kugou-api${base}?${query}`;
  }
  return `/api/proxy/kugou${base}?${query}`;
};

const searchKugou = async (q: string): Promise<KugouSong[]> => {
  const url = import.meta.env.DEV
    ? `/kugou-api/api/v3/search/song?format=json&keyword=${encodeURIComponent(q)}&page=1&pagesize=15`
    : `/api/proxy/kugou-search/api/v3/search/song?format=json&keyword=${encodeURIComponent(q)}&page=1&pagesize=15`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as KugouSearchResponse;
  return data.data?.info || [];
};

const pickBestKugouSong = (
  songs: KugouSong[],
  artist: string,
  title: string,
  duration: number,
  titleAliases: string[] = [],
): KugouSong | null => {
  if (songs.length === 0) return null;
  const normArtist = normalize(artist);
  const allTitles = [title, ...titleAliases];
  const trackDurationMs = (duration || 240) * 1000;
  const hasArtist = Boolean(artist.trim());

  const scored = songs.map((s) => {
    const titleSim = Math.max(...allTitles.map((t) => similarity(s.songname, t)));
    const artistSim = hasArtist ? similarity(s.singername || "", artist) : 0;

    const durationDiff = Math.abs((s.duration || 0) * 1000 - trackDurationMs);
    const durationMatch =
      s.duration && s.duration > 0 && durationDiff / Math.max(s.duration * 1000, 1) < 0.15
        ? 0.15
        : 0;

    const exactTitle = allTitles.some((t) => normalize(s.songname) === normalize(t)) ? 0.15 : 0;
    const exactArtist =
      hasArtist && normalize(s.singername || "") === normArtist ? 0.1 : 0;

    let score = titleSim * 0.6 + artistSim * 0.3 + durationMatch + exactTitle + exactArtist;
    if (titleSim >= 0.95 && hasArtist && artistSim < 0.3) {
      score *= 0.75;
    }
    return { song: s, score, titleSim, artistSim };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  if (best.score >= 0.3) return best.song;
  if (best.titleSim >= 0.5 || best.artistSim >= 0.5) return best.song;
  return null;
};

const fetchFromKugou = async (
  artist: string,
  title: string,
  duration: number,
): Promise<LyricLine[]> => {
  const [queries, aliases] = await Promise.all([
    Promise.resolve(buildSearchQueries(artist, title)),
    fetchMusicBrainzWorkAliases(artist, title),
  ]);

  const aliasQueries = aliases
    .flatMap((a) => buildSearchQueries(artist, a))
    .filter((q, i, arr) => arr.indexOf(q) === i);
  const allQueries = [...new Set([...queries, ...aliasQueries])].slice(0, 10);

  const searchResults = await Promise.all(allQueries.map((q) => searchKugou(q)));
  const songs = searchResults
    .flat()
    .filter((s, i, arr) => arr.findIndex((x) => x.hash === s.hash) === i);

  const best = pickBestKugouSong(songs, artist, title, duration, aliases);
  if (!best || !best.hash) return [];

  // 查询歌词候选
  const lyricSearchUrl = buildKugouUrl("/search", {
    ver: "1",
    man: "yes",
    client: "mobi",
    keyword: "",
    duration: "",
    hash: best.hash,
    album_id: best.album_id || "",
  });
  const lyricSearchRes = await fetch(lyricSearchUrl);
  if (!lyricSearchRes.ok) return [];
  const lyricSearchData = (await lyricSearchRes.json()) as KugouLyricSearchResponse;
  const candidate = lyricSearchData.candidates?.[0];
  if (!candidate) return [];

  // 下载歌词
  const lyricDownloadUrl = buildKugouUrl("/download", {
    ver: "1",
    client: "pc",
    id: candidate.id,
    accesskey: candidate.accesskey,
    fmt: "lrc",
    charset: "utf8",
  });
  const lyricRes = await fetch(lyricDownloadUrl);
  if (!lyricRes.ok) return [];
  const lyricData = (await lyricRes.json()) as KugouLyricDownloadResponse;
  if (!lyricData.content) return [];

  try {
    // base64 内容是 UTF-8 编码的 LRC
    const binary = atob(lyricData.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const lrc = new TextDecoder("utf-8").decode(bytes);
    const parsed = parseLRC(lrc);
    if (parsed.length > 0) return parsed;
  } catch {
    return [];
  }

  return [];
};

// === 主入口 ===

export type LyricsSource = "auto" | "lrclib" | "netease" | "kugou";

/** 来源标签 */
const SOURCE_LABELS: Record<LyricsSource, string> = {
  auto: "智能竞速",
  lrclib: "LRCLIB",
  netease: "网易云",
  kugou: "酷狗",
};

/**
 * 按时间戳把译文合并进原文行（双语模式）。
 * 译文行用最近且不晚于原文行的时间戳匹配；匹配不到则留空。
 */
export const mergeTranslation = (
  lines: LyricLine[],
  translationLines: LyricLine[],
): LyricLine[] => {
  if (!translationLines.length) return lines;
  // 译文按时间排序，便于二分查找
  const sorted = [...translationLines].sort((a, b) => a.time - b.time);
  return lines.map((line) => {
    // 找到时间 <= line.time 的最后一行译文
    let lo = 0;
    let hi = sorted.length - 1;
    let matched: string | undefined;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].time <= line.time) {
        matched = sorted[mid].text;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (matched !== undefined) {
      return { ...line, translation: matched };
    }
    return line;
  });
};

/**
 * 根据语言模式从 FetchedLyrics 构造最终展示的 LyricLine[]。
 * - original：仅原文
 * - translation：仅译文（无译文则回退原文）
 * - bilingual：原文 + 译文合并（无译文则仅原文）
 */
export const applyLyricLanguage = (
  fetched: FetchedLyrics,
  language: "original" | "translation" | "bilingual",
): LyricLine[] => {
  if (language === "translation" && fetched.translationLines.length) {
    return fetched.translationLines;
  }
  if (language === "bilingual") {
    return mergeTranslation(fetched.lines, fetched.translationLines);
  }
  return fetched.lines;
};

/** 构造曲目键（与缓存键一致，用于手动 LRC 持久化） */
export const trackLyricKey = (artist: string, title: string): string =>
  cacheKey(cleanArtist(artist), cleanTitle(title));

/**
 * 保存用户手动导入的 .lrc 文本到 IndexedDB，按 artist+title 键存储。
 * 同时写入 lyrics 缓存，使其立即生效。
 */
export const saveManualLrc = async (
  artist: string,
  title: string,
  lrcText: string,
): Promise<LyricLine[]> => {
  const lines = parseLRC(lrcText);
  const key = trackLyricKey(artist, title);
  await setItem(`${STORAGE_KEYS.manualLrc}:${key}`, lrcText);
  const cached: CachedLyrics = {
    lines,
    translationLines: [],
    sourceLabel: "本地导入",
  };
  setCached(cleanArtist(artist), cleanTitle(title), cached);
  return lines;
};

/** 读取用户手动导入的 .lrc 文本（无则返回 null） */
export const getManualLrc = async (
  artist: string,
  title: string,
): Promise<string | null> => {
  const key = trackLyricKey(artist, title);
  const raw = await getItem<string>(`${STORAGE_KEYS.manualLrc}:${key}`, "");
  return raw || null;
};

/** 清除用户手动导入的 .lrc */
export const clearManualLrc = async (artist: string, title: string): Promise<void> => {
  const key = trackLyricKey(artist, title);
  await setItem(`${STORAGE_KEYS.manualLrc}:${key}`, "");
  const ck = cacheKey(cleanArtist(artist), cleanTitle(title));
  lyricCache.delete(ck);
  localCache.delete(ck);
  saveLocalCache();
};

/**
 * 获取歌词（携带原文、译文与来源标签）
 * @param artist 艺人名
 * @param title 曲名
 * @param album 专辑名（可选）
 * @param duration 歌曲时长（秒），用于给纯文本歌词分配时间戳
 * @param source 歌词来源：auto（并行竞速）| lrclib | netease | kugou
 * @param force 强制刷新，绕过缓存（用于「重新获取歌词」）
 */
export const fetchLyrics = async (
  artist: string,
  title: string,
  album?: string,
  duration = 240,
  source: LyricsSource = "auto",
  force = false,
): Promise<FetchedLyrics> => {
  const rawArtist = artist || "";
  const rawTitle = title || "";
  const rawAlbum = album || "";

  const cleanedArtist = cleanArtist(rawArtist);
  const cleanedTitle = cleanTitle(rawTitle);
  const cleanedAlbum = rawAlbum ? cleanAlbum(rawAlbum) : "";

  // 缓存命中（缓存键只使用 artist + title，避免专辑名不一致导致命中失败）
  if (!force) {
    const cached = getCached(cleanedArtist, cleanedTitle);
    if (cached) return cached;
  } else {
    // 强制刷新时清掉旧缓存
    const ck = cacheKey(cleanedArtist, cleanedTitle);
    lyricCache.delete(ck);
    localCache.delete(ck);
  }

  const applyResult = (value: CachedLyrics): FetchedLyrics => {
    setCached(cleanedArtist, cleanedTitle, value);
    return value;
  };

  let sourceLabel = SOURCE_LABELS[source];

  try {
    let lines: LyricLine[] = [];
    let translationLines: LyricLine[] = [];

    if (source === "lrclib") {
      lines = await withTimeout(
        fetchFromLrclib(cleanedArtist, cleanedTitle, cleanedAlbum || undefined, duration),
        LRCLIB_TIMEOUT,
      ).catch(() => []);
    } else if (source === "netease") {
      const r = await withTimeout(
        fetchFromNetease(cleanedArtist, cleanedTitle, duration),
        NETEASE_TIMEOUT,
      ).catch(() => ({ lines: [] as LyricLine[], translationLines: [] as LyricLine[] }));
      lines = r.lines;
      translationLines = r.translationLines;
    } else if (source === "kugou") {
      lines = await withTimeout(
        fetchFromKugou(cleanedArtist, cleanedTitle, duration),
        NETEASE_TIMEOUT,
      ).catch(() => []);
    } else {
      // auto：酷狗 + 网易云 + LRCLIB 并行竞速，先返回有效歌词者胜出
      // 网易云额外携带译文，若胜出则一并保留译文
      const kugouPromise = withTimeout(
        fetchFromKugou(cleanedArtist, cleanedTitle, duration),
        NETEASE_TIMEOUT,
      ).catch(() => [] as LyricLine[]);

      const neteasePromise = withTimeout(
        fetchFromNetease(cleanedArtist, cleanedTitle, duration),
        NETEASE_TIMEOUT,
      ).catch(() => ({ lines: [] as LyricLine[], translationLines: [] as LyricLine[] }));

      const lrclibPromise = withTimeout(
        fetchFromLrclib(cleanedArtist, cleanedTitle, cleanedAlbum || undefined, duration),
        LRCLIB_TIMEOUT,
      ).catch(() => [] as LyricLine[]);

      const [kugouLines, neteaseResult, lrclibLines] = await Promise.all([
        kugouPromise,
        neteasePromise,
        lrclibPromise,
      ]);

      // 优先级：网易云（带译文）> 酷狗 > LRCLIB
      if (neteaseResult.lines.length) {
        lines = neteaseResult.lines;
        translationLines = neteaseResult.translationLines;
        sourceLabel = "网易云";
      } else if (kugouLines.length) {
        lines = kugouLines;
        sourceLabel = "酷狗";
      } else if (lrclibLines.length) {
        lines = lrclibLines;
        sourceLabel = "LRCLIB";
      }
    }

    return applyResult({ lines, translationLines, sourceLabel });
  } catch {
    return applyResult({ lines: [], translationLines: [], sourceLabel });
  }
};
