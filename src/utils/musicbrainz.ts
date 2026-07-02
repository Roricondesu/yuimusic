/**
 * MusicBrainz 元数据增强
 *
 * 用途：
 * - 对中文/日文/韩文查询，尝试获取艺人的英文/拉丁别名
 * - 用别名回搜 Audius / iTunes，提高非英文内容的匹配率
 *
 * 注意：
 * - MusicBrainz 对未授权客户端有约 1 req/s 的速率限制，因此启用内存缓存
 *   避免同一艺人在同一会话内重复请求。
 *
 * 引用：
 * - MusicBrainz XML Web Service / JSON Web Service [1]
 *   https://musicbrainz.org/doc/MusicBrainz_API
 */

interface MusicBrainzAlias {
  name: string;
  "sort-name": string;
  locale?: string;
  type?: string;
  primary?: boolean | null;
}

interface MusicBrainzArtist {
  id: string;
  name: string;
  "sort-name": string;
  aliases?: MusicBrainzAlias[];
  score?: number;
}

interface MusicBrainzSearchResponse {
  artists?: MusicBrainzArtist[];
  count?: number;
}

const USER_AGENT = "LiquidGlassMusic/0.2 (hello@liquidglass.app)";

/** 艺人别名内存缓存，减少 MusicBrainz 重复请求 */
const aliasCache = new Map<string, string[]>();

/** 判断字符串是否包含 CJK 字符 */
export const containsCJK = (s: string): boolean => /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s);

/** 从 MusicBrainz 搜索艺人，返回最佳别名（优先英文 locale） */
export const searchArtistAliases = async (
  query: string,
  limit = 3,
): Promise<string[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = aliasCache.get(cacheKey);
  if (cached) return cached;

  const url = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(
    trimmed,
  )}&fmt=json&limit=${limit}`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    aliasCache.set(cacheKey, []);
    return [];
  }
  const data = (await res.json()) as MusicBrainzSearchResponse;
  const artists = data.artists || [];

  const aliases: string[] = [];
  for (const artist of artists) {
    // 优先收集英文 locale 的 primary 别名
    const enAlias = artist.aliases?.find(
      (a) => a.locale?.startsWith("en") && a.primary,
    );
    if (enAlias) {
      aliases.push(enAlias.name);
      continue;
    }
    // 否则用 sort-name（通常是拉丁拼写）
    if (artist["sort-name"] && artist["sort-name"] !== artist.name) {
      aliases.push(artist["sort-name"]);
    }
  }

  const result = [...new Set(aliases)].slice(0, limit);
  aliasCache.set(cacheKey, result);
  return result;
};

/**
 * 对查询词做增强：如果包含 CJK，尝试获取拉丁别名并组合成多个查询词。
 * 返回的查询词列表用于并行搜索音频源。
 */
export const expandQueryForCJK = async (query: string): Promise<string[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!containsCJK(trimmed)) return [trimmed];

  // 提取可能是艺人名的部分（简单取前 1-3 个词）
  const parts = trimmed.split(/\s+/);
  const artistPart = parts.slice(0, 2).join(" ");

  const aliases = await searchArtistAliases(artistPart, 2);
  if (aliases.length === 0) return [trimmed];

  // 组合：原词 + 别名 + 别名+剩余关键词
  const expanded = new Set<string>([trimmed]);
  const remaining = parts.slice(2).join(" ");
  for (const alias of aliases) {
    expanded.add(alias);
    if (remaining) expanded.add(`${alias} ${remaining}`);
  }
  return [...expanded];
};
