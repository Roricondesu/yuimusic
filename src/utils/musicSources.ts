import JSZip from "jszip";
import type { Track, TrackSource, iTunesResult, JamendoResult } from "../types";
import { expandQueryForCJK } from "./musicbrainz";

/**
 * 多音乐来源聚合：
 * - Audius：去中心化音乐协议，免费、无需 API key，提供完整歌曲 [1]
 * - iTunes：主流版权音乐，仅 30 秒试听预览 [2]
 * - Jamendo：独立音乐人平台，CC 授权完整歌曲，需要 client_id [4]
 * - osu!：通过 osu.direct 镜像站搜索 beatmapset，先以官方 preview 播放，
 *         后台下载 .osz 并解压提取完整音频 [5]
 * - MusicBrainz：用于 CJK 查询的艺人拉丁别名扩展，提高非英文内容匹配率 [3]
 *
 * 搜索结果按"完整版优先"排序：完整曲目在前，试听在后。
 *
 * 关于中文音频来源：
 * 目前可用的公开、可跨域、免授权中文音乐 API 较少。潜在选项包括：
 * - 网易云音乐 API：社区逆向工程接口，稳定性与版权风险高，需要自建代理
 * - QQ 音乐 / 酷狗 / 酷我：官方 API 需要申请 key，且存在地区与版权限制
 * 当前策略是先用 MusicBrainz 把中文艺人名转写成英文/拉丁形式，再回搜
 * Audius / iTunes / Jamendo / osu!，这样能在不引入额外代理的情况下提高命中率和完整曲数量。
 *
 * 引用：
 * [1] Audius API: https://docs.audius.org/developers/api/rest-api
 * [2] iTunes Search API: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html
 * [3] MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
 * [4] Jamendo API: https://developer.jamendo.com/v3.0/docs
 * [5] osu.direct API: https://osu.direct
 */

const APP_NAME = "LiquidGlassMusic";
const AUDIUS_HOST = "https://discoveryprovider.audius.co";
const JAMENDO_HOST = "https://api.jamendo.com/v3.0";
/**
 * Jamendo client_id（nya's App）。
 * client_id 会随每个 API 请求发送，属于公开标识；client_secret 仅用于 OAuth 授权。
 * 如需替换，可在设置中填写自己的 key。
 */
const JAMENDO_DEFAULT_CLIENT_ID = "e3e05969";
const OSU_DIRECT_HOST = "https://osu.direct/api/v2";

interface OsuBeatmap {
  beatmapset_id: number;
  difficulty_rating: number;
  version: string;
  total_length: number;
  hit_length: number;
  bpm: number;
}

interface OsuBeatmapSet {
  id: number;
  title: string;
  title_unicode?: string;
  artist: string;
  artist_unicode?: string;
  creator: string;
  covers: {
    cover?: string;
    "cover@2x"?: string;
    list?: string;
    card?: string;
  };
  preview_url?: string;
  beatmaps: OsuBeatmap[];
  status?: string;
}

/** iTunes：30 秒版权试听 */
const mapItunesToTrack = (item: iTunesResult): Track => ({
  id: `itunes-${item.trackId}`,
  title: item.trackName,
  artist: item.artistName,
  album: item.collectionName || "单曲",
  cover: item.artworkUrl600 || item.artworkUrl100,
  duration: (item.trackTimeMillis || 30000) / 1000,
  src: item.previewUrl || "",
  source: "itunes",
  preview: true, // 版权限制：仅 30 秒预览
});

const searchItunes = async (term: string, limit = 40): Promise<Track[]> => {
  if (!term.trim()) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term,
  )}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("iTunes API 错误");
  const data = await res.json();
  return (data.results as iTunesResult[])
    .filter((r) => r.previewUrl)
    .map(mapItunesToTrack);
};

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  mood?: string;
  artwork?: { "150x150"?: string; "480x480"?: string; "1000x1000"?: string };
  user?: { name?: string };
  play_count?: number;
  favorite_count?: number;
}

/** Audius：完整免费音乐（去中心化，CC / 自上传） */
const mapAudiusToTrack = (item: AudiusTrack): Track => ({
  id: `audius-${item.id}`,
  title: item.title,
  artist: item.user?.name || "Audius 艺人",
  album: item.genre ? `${item.genre}` : "Audius",
  cover:
    item.artwork?.["1000x1000"] ||
    item.artwork?.["480x480"] ||
    item.artwork?.["150x150"] ||
    "",
  duration: item.duration || 0,
  src: `${AUDIUS_HOST}/v1/tracks/${item.id}/stream?app_name=${APP_NAME}`,
  source: "audius",
  preview: false, // 完整歌曲
});

const searchAudius = async (term: string, limit = 40): Promise<Track[]> => {
  if (!term.trim()) return [];
  const url = `${AUDIUS_HOST}/v1/tracks/search?query=${encodeURIComponent(
    term,
  )}&app_name=${APP_NAME}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Audius API 错误");
  const data = await res.json();
  return (data.data as AudiusTrack[])
    .filter((r) => r.id && r.duration)
    .map(mapAudiusToTrack);
};

/** 获取 Audius 热门（通过 trending 接口） */
const fetchAudiusTrending = async (limit = 40): Promise<Track[]> => {
  const url = `${AUDIUS_HOST}/v1/tracks/trending?app_name=${APP_NAME}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Audius API 错误");
  const data = await res.json();
  return (data.data as AudiusTrack[])
    .filter((r) => r.id && r.duration)
    .map(mapAudiusToTrack);
};

interface JamendoResponse {
  headers: {
    status: string;
    code: number;
    error_message?: string;
  };
  results: JamendoResult[];
}

/** Jamendo：独立音乐人完整音乐（CC 授权） */
const mapJamendoToTrack = (item: JamendoResult): Track => ({
  id: `jamendo-${item.id}`,
  title: item.name,
  artist: item.artist_name || "Jamendo 艺人",
  album: item.album_name || "Jamendo",
  cover: item.image || "",
  duration: item.duration || 0,
  // 优先使用 audiodownload（mp32），兼容性比 mp31 更好
  src: item.audiodownload || item.audio || "",
  source: "jamendo",
  preview: false, // 完整歌曲
});

const createSearchJamendo = (clientId: string) => {
  return async (term: string, limit = 40): Promise<Track[]> => {
    if (!term.trim()) return [];
    const url = `${JAMENDO_HOST}/tracks/?client_id=${clientId}&format=json&limit=${limit}&search=${encodeURIComponent(
      term,
    )}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Jamendo API 错误");
    const data = (await res.json()) as JamendoResponse;
    if (data.headers?.status === "failed") {
      // 如 client_id 被 suspended，不抛错，返回空数组让其它源兜底
      return [];
    }
    return (data.results || [])
      .filter((r) => r.id && r.audio)
      .map(mapJamendoToTrack);
  };
};

const createFetchJamendoTrending = (clientId: string) => {
  return async (limit = 40): Promise<Track[]> => {
    const url = `${JAMENDO_HOST}/tracks/?client_id=${clientId}&format=json&limit=${limit}&order=popularity_total_desc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Jamendo API 错误");
    const data = (await res.json()) as JamendoResponse;
    if (data.headers?.status === "failed") return [];
    return (data.results || [])
      .filter((r) => r.id && r.audio)
      .map(mapJamendoToTrack);
  };
};

/** osu!：beatmapset 元数据转 Track */
const mapOsuToTrack = (set: OsuBeatmapSet): Track => {
  // 优先选择难度最低的 beatmap 作为代表（"最小型号"）
  const easiest = set.beatmaps.reduce(
    (min, b) => (b.difficulty_rating < min.difficulty_rating ? b : min),
    set.beatmaps[0],
  );
  const previewUrl = set.preview_url
    ? set.preview_url.startsWith("//")
      ? `https:${set.preview_url}`
      : set.preview_url
    : "";
  return {
    id: `osu-${set.id}`,
    title: set.title_unicode || set.title,
    artist: set.artist_unicode || set.artist,
    album: set.creator || "osu! 谱面",
    cover: set.covers?.["cover@2x"] || set.covers?.cover || "",
    duration: easiest?.total_length || 0,
    src: previewUrl,
    source: "osu",
    preview: true,
    osuSetId: set.id,
  };
};

/** osu!：通过 osu.direct 搜索 beatmapset */
const searchOsu = async (term: string, limit = 15): Promise<Track[]> => {
  if (!term.trim()) return [];
  const url = `${OSU_DIRECT_HOST}/search?q=${encodeURIComponent(
    term,
  )}&mode=0&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("osu! 搜索失败");
  const data = (await res.json()) as OsuBeatmapSet[];
  // 按"最小化"排序：beatmap 数量少、总时长短的靠前
  const scored = data
    .filter((set) => set.id && set.beatmaps?.length)
    .map((set) => {
      const totalLength = set.beatmaps.reduce((s, b) => s + (b.total_length || 0), 0);
      return { set, score: set.beatmaps.length * 60 + totalLength };
    })
    .sort((a, b) => a.score - b.score);
  return scored.map((s) => mapOsuToTrack(s.set));
};

/** 已提取的 osu! 音频 Blob URL 缓存，key 为 "setId:mirror" 避免不同镜像混用 */
const osuAudioCache = new Map<string, string>();

/** 根据镜像源构造 .osz 下载 URL */
const buildOsuDownloadUrl = (
  setId: number,
  mirror: "sayobot" | "osu.direct",
): string => {
  if (mirror === "sayobot") {
    // Sayobot mini 版：体积最小（无视频、无多余素材），国内 CDN 加速
    return `https://dl.sayobot.cn/beatmaps/download/mini/${setId}`;
  }
  return `https://osu.direct/api/d/${setId}`;
};

/** 根据文件扩展名获取音频 MIME type */
const getAudioMime = (filename: string): string => {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    flac: "audio/flac",
  };
  return map[ext] || "application/octet-stream";
};

/** 下载 .osz 并解压提取音频文件，返回 Blob URL。onProgress 回调下载进度 0-1 */
export const extractOsuAudio = async (
  setId: number,
  onProgress?: (ratio: number) => void,
  mirror: "sayobot" | "osu.direct" = "sayobot",
): Promise<string> => {
  const cacheKey = `${setId}:${mirror}`;
  if (osuAudioCache.has(cacheKey)) {
    onProgress?.(1);
    return osuAudioCache.get(cacheKey)!;
  }
  const url = buildOsuDownloadUrl(setId, mirror);
  const res = await fetch(url);
  if (!res.ok) throw new Error("osu! 谱面下载失败");

  // 检测响应类型：Sayobot 可能返回 HTML 错误页（503）而非 ZIP
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("镜像站返回错误页面，请尝试切换镜像源");
  }

  // 流式读取以跟踪下载进度
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  if (reader && total > 0) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        onProgress?.(Math.min(0.99, received / total));
      }
    }
    onProgress?.(1);
  }
  const buf = total > 0
    ? new Blob(chunks).arrayBuffer()
    : res.arrayBuffer();
  const ab = await buf;

  // 检测是否为有效 ZIP（ZIP 文件以 PK\x03\x04 开头）
  const view = new DataView(ab);
  if (view.byteLength < 4 || view.getUint16(0, true) !== 0x4b50) {
    throw new Error("下载的内容不是有效的 .osz 文件");
  }

  const zip = await JSZip.loadAsync(ab);

  const fileNames = Object.keys(zip.files);
  const audioExts = [".mp3", ".ogg", ".wav", ".mp4", ".m4a", ".flac"];

  // 快速路径：先按扩展名找音频文件
  const audioCandidates = fileNames.filter((n) =>
    audioExts.some((ext) => n.toLowerCase().endsWith(ext)),
  );

  let audioName: string | undefined;

  if (audioCandidates.length === 1) {
    // 只有一个音频文件，直接使用，跳过 .osu 解析（省去解压 .osu 的开销）
    audioName = audioCandidates[0];
  } else if (audioCandidates.length > 1) {
    // 多个音频文件：解析 .osu 确认 AudioFilename
    let audioFilename = "";
    for (const name of fileNames) {
      if (!name.endsWith(".osu")) continue;
      const text = await zip.files[name].async("string");
      const match = text.match(/^AudioFilename:\s*(.+)$/m);
      if (match) {
        audioFilename = match[1].trim();
        break;
      }
    }
    audioName =
      (audioFilename &&
        fileNames.find(
          (n) => n.toLowerCase() === audioFilename.toLowerCase(),
        )) ||
      audioCandidates[0];
  }

  if (!audioName) throw new Error("未在 .osz 中找到音频文件");

  // 提取音频并设置正确的 MIME type（JSZip 默认 blob.type 为空，浏览器无法播放）
  const rawBlob = await zip.files[audioName].async("blob");
  const mime = getAudioMime(audioName);
  const blob = new Blob([rawBlob], { type: mime });
  const blobUrl = URL.createObjectURL(blob);
  osuAudioCache.set(cacheKey, blobUrl);
  return blobUrl;
};

/** 获取 osu! 完整音频 URL（失败则回退到 preview URL） */
export const getOsuAudioUrl = async (
  setId: number,
  fallbackUrl?: string,
  onProgress?: (ratio: number) => void,
  mirror: "sayobot" | "osu.direct" = "sayobot",
): Promise<string> => {
  const cacheKey = `${setId}:${mirror}`;
  if (osuAudioCache.has(cacheKey)) {
    onProgress?.(1);
    return osuAudioCache.get(cacheKey)!;
  }
  try {
    return await extractOsuAudio(setId, onProgress, mirror);
  } catch {
    // 当前镜像失败时，自动尝试另一个镜像
    const fallbackMirror = mirror === "sayobot" ? "osu.direct" : "sayobot";
    const fallbackKey = `${setId}:${fallbackMirror}`;
    if (osuAudioCache.has(fallbackKey)) {
      onProgress?.(1);
      return osuAudioCache.get(fallbackKey)!;
    }
    try {
      return await extractOsuAudio(setId, onProgress, fallbackMirror);
    } catch {
      // 两个镜像都失败，回退到 preview URL
      return fallbackUrl || "";
    }
  }
};

export interface SearchResult {
  tracks: Track[];
  /** 是否有来源失败 */
  partial: boolean;
}

/** 榜单分区 */
export interface ChartSection {
  title: string;
  source: TrackSource;
  tracks: Track[];
}

/**
 * 获取多来源榜单：各源热门/趋势曲目，分区展示。
 * - Audius：trending 接口
 * - Jamendo：按 popularity 排序
 * - osu!：搜索 "popular" 获取热门谱面
 * - iTunes：搜索 "top hits" 获取热门歌曲
 */
export const fetchCharts = async (
  jamendoClientId?: string,
): Promise<ChartSection[]> => {
  const jamendoKey = jamendoClientId?.trim() || JAMENDO_DEFAULT_CLIENT_ID;
  const fetchJamendoTrending = createFetchJamendoTrending(jamendoKey);

  const [audius, jamendo, osu, itunes] = await Promise.allSettled([
    fetchAudiusTrending(20),
    fetchJamendoTrending(20),
    searchOsu("popular", 20),
    searchItunes("top hits", 20),
  ]);

  const sections: ChartSection[] = [];
  if (audius.status === "fulfilled" && audius.value.length) {
    sections.push({
      title: "Audius 热门趋势",
      source: "audius",
      tracks: audius.value,
    });
  }
  if (jamendo.status === "fulfilled" && jamendo.value.length) {
    sections.push({
      title: "Jamendo 热门音乐",
      source: "jamendo",
      tracks: jamendo.value,
    });
  }
  if (osu.status === "fulfilled" && osu.value.length) {
    sections.push({
      title: "osu! 热门谱面",
      source: "osu",
      tracks: osu.value,
    });
  }
  if (itunes.status === "fulfilled" && itunes.value.length) {
    sections.push({
      title: "iTunes 热门歌曲",
      source: "itunes",
      tracks: itunes.value,
    });
  }

  return sections;
};

/**
 * 轮询合并多个来源的曲目，使各源结果按相关度穿插。
 * 每个源内部已按 API 返回的相关度排序，轮询取各源第 1、2、3… 项，
 * 这样不同来源的高相关度结果会自然交替出现。
 */
const interleaveByRelevance = (lists: Track[][]): Track[] => {
  const result: Track[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.length) {
        const t = list[i];
        if (!seen.has(t.id)) {
          seen.add(t.id);
          result.push(t);
        }
      }
    }
  }
  return result;
};

/**
 * 标准化曲目标识：小写 + 去符号 + 合并空格，用于判断「同曲目」。
 * 名字+歌手相同即视为同曲目（不同来源）。
 */
const normalizeTrackKey = (artist: string, title: string): string => {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\s]/g, " ")
      .replace(/[\s\-_]+/g, " ")
      .trim();
  // 去掉标题常见噪声（feat/remix 等）
  const cleanT = title
    .replace(/\(feat\.?[^)]*\)/gi, "")
    .replace(/\(ft\.?[^)]*\)/gi, "")
    .replace(/\[[^\]]*(remix|edit|mix|version|live|acoustic)[^\]]*\]/gi, "")
    .replace(/\([^)]*(remix|edit|mix|version|live|acoustic|official|video)[^)]*\)/gi, "")
    .trim();
  return `${norm(artist)}::${norm(cleanT)}`;
};

/**
 * 将搜索结果按 artist+title 合并：同曲目不同来源归为主 Track 的 alternatives。
 * 保留首选来源（完整版权优先于试听）作为主版本，其余作为备选。
 */
const mergeSameTracks = (tracks: Track[]): Track[] => {
  const map = new Map<string, Track>();
  for (const t of tracks) {
    const key = normalizeTrackKey(t.artist, t.title);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...t, alternatives: [] });
    } else {
      // 优先级：完整 > 试听；同优先级保留先出现的
      const existingFull = !existing.preview;
      const newFull = !t.preview;
      const alt = { ...t, alternatives: [] };
      if (!existingFull && newFull) {
        // 新的是完整版，替换主版本
        map.set(key, { ...alt, alternatives: [existing, ...(existing.alternatives || [])] });
      } else {
        // 否则作为备选加入
        if (!existing.alternatives) existing.alternatives = [];
        existing.alternatives.push(alt);
      }
    }
  }
  return [...map.values()];
};

/**
 * 对单个源使用一组查询词并行搜索，返回按查询词顺序、保留各 API 相关度顺序的曲目。
 * 用于 CJK 查询扩展：原词 + 艺人拉丁别名同时搜索，提高命中率；原词结果优先，别名结果补充。
 */
const searchSourceWithQueries = async (
  queries: string[],
  searchFn: (term: string, limit: number) => Promise<Track[]>,
  limitPerQuery: number,
): Promise<Track[]> => {
  if (queries.length === 0) return [];
  const results = await Promise.all(
    queries.map((q) => searchFn(q, limitPerQuery).catch(() => [] as Track[])),
  );
  const seen = new Set<string>();
  const tracks: Track[] = [];
  // 按查询词顺序合并，保留每个查询词内部 API 返回的相关度
  for (const list of results) {
    for (const t of list) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      tracks.push(t);
    }
  }
  return tracks;
};

/**
 * 混源搜索：按偏好优先级并发请求，结果按来源相关度排序。
 * - mixed：Audius → Jamendo → osu! → iTunes 顺序合并；Audius / Jamendo / osu!
 *        保持各 API 返回的相关度，iTunes 作为试听源放在最后
 * - audius：仅 Audius 完整音乐
 * - itunes：仅 iTunes 试听
 * - jamendo：仅 Jamendo 独立音乐
 * - osu：仅 osu! 谱面（先 preview，后台下载 .osz 提取完整音频）
 *
 * 当查询包含中文/日文/韩文时，会通过 MusicBrainz 扩展为多个查询词
 *（如"周杰伦 晴天"扩展为"Jay Chou 晴天"）并行搜索，提升匹配率。
 */
export const searchTracks = async (
  term: string,
  preferred: "mixed" | "itunes" | "audius" | "jamendo" | "osu" = "mixed",
  limit = 40,
  jamendoClientId?: string,
): Promise<SearchResult> => {
  const trimmed = term.trim();
  const jamendoKey = jamendoClientId?.trim() || JAMENDO_DEFAULT_CLIENT_ID;
  const searchJamendo = createSearchJamendo(jamendoKey);
  const fetchJamendoTrending = createFetchJamendoTrending(jamendoKey);

  // 无搜索词：返回各源热门
  if (!trimmed) {
    if (preferred === "itunes") {
      try {
        const t = await searchItunes("pop", limit);
        return { tracks: t, partial: false };
      } catch {
        return { tracks: [], partial: true };
      }
    }
    if (preferred === "audius") {
      try {
        const t = await fetchAudiusTrending(limit);
        return { tracks: t, partial: false };
      } catch {
        return { tracks: [], partial: true };
      }
    }
    if (preferred === "jamendo") {
      try {
        const t = await fetchJamendoTrending(limit);
        return { tracks: t, partial: false };
      } catch {
        return { tracks: [], partial: true };
      }
    }
    if (preferred === "osu") {
      try {
        const t = await searchOsu("pop", limit);
        return { tracks: t, partial: false };
      } catch {
        return { tracks: [], partial: true };
      }
    }
    // mixed：Audius / Jamendo / osu! 三源轮询穿插，iTunes 试听放最后
    const [audius, jamendo, osu, itunes] = await Promise.allSettled([
      fetchAudiusTrending(Math.ceil(limit / 4)),
      fetchJamendoTrending(Math.floor(limit / 4)),
      searchOsu("pop", Math.floor(limit / 4)),
      searchItunes("pop", Math.floor(limit / 4)),
    ]);
    const interleaved = interleaveByRelevance([
      audius.status === "fulfilled" ? audius.value : [],
      jamendo.status === "fulfilled" ? jamendo.value : [],
      osu.status === "fulfilled" ? osu.value : [],
    ]);
    const tracks = [
      ...interleaved,
      ...(itunes.status === "fulfilled" ? itunes.value : []),
    ];
    return {
      tracks,
      partial:
        audius.status === "rejected" ||
        jamendo.status === "rejected" ||
        osu.status === "rejected" ||
        itunes.status === "rejected",
    };
  }

  // 扩展 CJK 查询词（非 CJK 直接返回原词）
  const queries = await expandQueryForCJK(trimmed);

  // 单源
  if (preferred === "itunes") {
    try {
      const t = await searchSourceWithQueries(
        queries,
        searchItunes,
        Math.max(1, Math.ceil(limit / queries.length)),
      );
      return { tracks: t, partial: false };
    } catch {
      return { tracks: [], partial: true };
    }
  }
  if (preferred === "audius") {
    try {
      const t = await searchSourceWithQueries(
        queries,
        searchAudius,
        Math.max(1, Math.ceil(limit / queries.length)),
      );
      return { tracks: t, partial: false };
    } catch {
      return { tracks: [], partial: true };
    }
  }
  if (preferred === "jamendo") {
    try {
      const t = await searchSourceWithQueries(
        queries,
        searchJamendo,
        Math.max(1, Math.ceil(limit / queries.length)),
      );
      return { tracks: t, partial: false };
    } catch {
      return { tracks: [], partial: true };
    }
  }
  if (preferred === "osu") {
    try {
      // osu! 不扩展 CJK：osu.direct 对日文/罗马音搜索已有较好支持
      const t = await searchOsu(trimmed, limit);
      return { tracks: t, partial: false };
    } catch {
      return { tracks: [], partial: true };
    }
  }

  // mixed：Audius / Jamendo / osu! 三源轮询穿插，iTunes 试听放最后
  const perSourceLimit = Math.ceil(limit / 4);
  const perQueryLimit = Math.max(
    1,
    Math.ceil(perSourceLimit / queries.length),
  );
  const [audius, jamendo, osu, itunes] = await Promise.allSettled([
    searchSourceWithQueries(queries, searchAudius, perQueryLimit),
    searchSourceWithQueries(queries, searchJamendo, perQueryLimit),
    searchOsu(trimmed, perSourceLimit),
    searchSourceWithQueries(queries, searchItunes, perQueryLimit),
  ]);
  const interleaved = interleaveByRelevance([
    audius.status === "fulfilled" ? audius.value : [],
    jamendo.status === "fulfilled" ? jamendo.value : [],
    osu.status === "fulfilled" ? osu.value : [],
  ]);
  const tracks = [
    ...interleaved,
    ...(itunes.status === "fulfilled" ? itunes.value : []),
  ];
  // 同曲目（名字+歌手相同）合并为多来源，完整版权优先于试听
  const merged = mergeSameTracks(tracks);
  return {
    tracks: merged,
    partial:
      audius.status === "rejected" ||
      jamendo.status === "rejected" ||
      osu.status === "rejected" ||
      itunes.status === "rejected",
  };
};

/** 来源显示信息 */
export const sourceInfo = (
  source: TrackSource,
): { label: string; short: string; copyright: boolean; full: boolean } => {
  switch (source) {
    case "itunes":
      return {
        label: "iTunes · 版权试听 30 秒",
        short: "试听",
        copyright: true,
        full: false,
      };
    case "audius":
      return {
        label: "Audius · 免费音乐",
        short: "Audius",
        copyright: false,
        full: true,
      };
    case "jamendo":
      return {
        label: "Jamendo · CC 授权音乐",
        short: "Jamendo",
        copyright: false,
        full: true,
      };
    case "osu":
      return {
        label: "osu! · 谱面提取音频",
        short: "谱面",
        copyright: false,
        full: false,
      };
  }
};

/**
 * 下载任意来源曲目的音频为 Blob。
 * - osu!：通过 extractOsuAudio 下载 .osz 并提取音频
 * - 其他：直接 fetch 音频 URL
 * @returns Blob 和 MIME 类型
 */
export const downloadTrackAudio = async (
  track: Track,
  onProgress?: (ratio: number) => void,
  mirror: "sayobot" | "osu.direct" = "sayobot",
): Promise<Blob> => {
  // osu! 谱面：需要下载并解压
  if (track.source === "osu" && track.osuSetId != null) {
    const blobUrl = await extractOsuAudio(track.osuSetId, onProgress, mirror);
    // extractOsuAudio 返回的是 blob: URL，需要取回 Blob
    const res = await fetch(blobUrl);
    return res.blob();
  }

  // 其他来源：直接 fetch 音频流
  const res = await fetch(track.src);
  if (!res.ok) throw new Error(`下载失败: ${res.status}`);

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  if (reader && total > 0) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        onProgress?.(Math.min(0.99, received / total));
      }
    }
    onProgress?.(1);
    const blob = new Blob(chunks);
    // 尝试从 URL 推断 MIME
    const mime = inferAudioMime(track.src);
    return mime ? new Blob([blob], { type: mime }) : blob;
  }

  return res.blob();
};

/** 从 URL 推断音频 MIME */
const inferAudioMime = (url: string): string | null => {
  const u = url.split("?")[0].toLowerCase();
  if (u.endsWith(".mp3")) return "audio/mpeg";
  if (u.endsWith(".ogg")) return "audio/ogg";
  if (u.endsWith(".wav")) return "audio/wav";
  if (u.endsWith(".m4a")) return "audio/mp4";
  if (u.endsWith(".flac")) return "audio/flac";
  return null;
};

/**
 * 获取推荐曲目：从多个来源并行搜索，合并结果。
 * 用于主页"为你推荐"等需要更多曲目的场景。
 */
export const fetchRecommendationTracks = async (
  queries: string[],
  jamendoClientId?: string,
  limit = 20,
): Promise<Track[]> => {
  const jamendoKey = jamendoClientId?.trim() || JAMENDO_DEFAULT_CLIENT_ID;
  const results = await Promise.allSettled(
    queries.map((q) => searchTracks(q, "mixed", limit, jamendoKey)),
  );
  const all: Track[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value.tracks);
  }
  // 简单去重
  const seen = new Set<string>();
  return all.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
};
