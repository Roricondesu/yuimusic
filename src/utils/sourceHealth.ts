import type { TrackSource } from "../types";

/**
 * 音乐来源连接延迟检测
 *
 * 对每个来源访问一个轻量级只读接口（limit=1），测量 RTT。
 * 超时阈值 8 秒；超时或错误返回 null 表示不可达。
 */

export interface SourcePingResult {
  source: TrackSource;
  /** RTT 毫秒，null 表示失败 */
  latency: number | null;
  /** 失败时的错误描述 */
  error?: string;
}

const PING_TIMEOUT_MS = 8000;

/** 单源延迟测量：返回 RTT 毫秒，失败返回 null */
const ping = async (url: string, init?: RequestInit): Promise<number> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // 不缓存，确保每次都真实测量
      cache: "no-store",
    });
    const elapsed = Math.round(performance.now() - start);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return elapsed;
  } finally {
    clearTimeout(timer);
  }
};

/** 各来源的 ping 端点构造 */
const buildPingUrl = (source: TrackSource): { url: string; init?: RequestInit } => {
  switch (source) {
    case "itunes":
      return { url: "https://itunes.apple.com/search?term=test&limit=1" };
    case "audius":
      return { url: "https://discoveryprovider.audius.co/v1/tracks/trending?app_name=LiquidGlassMusic&limit=1" };
    case "jamendo":
      return { url: "https://api.jamendo.com/v3.0/tracks/?client_id=e3e05969&format=json&limit=1" };
    case "osu":
      return { url: "https://osu.direct/api/v2/search?q=pop&mode=0&limit=1" };
    case "ia":
      return { url: "/api/proxy/ia/advancedsearch.php?q=collection:audio%20AND%20mediatype:audio&rows=1&output=json" };
    case "deezer":
      return { url: "/api/proxy/deezer/search?q=test&limit=1" };
  }
};

/** 测量单个来源延迟 */
export const pingSource = async (source: TrackSource): Promise<SourcePingResult> => {
  const { url, init } = buildPingUrl(source);
  try {
    const latency = await ping(url, init);
    return { source, latency };
  } catch (err) {
    const msg = err instanceof Error
      ? (err.name === "AbortError" ? "超时" : err.message)
      : String(err);
    return { source, latency: null, error: msg };
  }
};

/** 并行测量所有来源延迟 */
export const pingAllSources = async (
  sources: TrackSource[],
  onUpdate?: (result: SourcePingResult) => void,
): Promise<SourcePingResult[]> => {
  const results: SourcePingResult[] = [];
  await Promise.all(
    sources.map(async (s) => {
      const r = await pingSource(s);
      onUpdate?.(r);
      results.push(r);
    }),
  );
  return results;
};

/** 根据延迟值返回状态等级与颜色 */
export const latencyLevel = (latency: number | null): {
  level: "good" | "ok" | "slow" | "fail";
  color: string;
  label: string;
} => {
  if (latency == null) return { level: "fail", color: "#ef4444", label: "不可达" };
  if (latency < 500) return { level: "good", color: "#22c55e", label: "优秀" };
  if (latency < 1500) return { level: "ok", color: "#eab308", label: "正常" };
  return { level: "slow", color: "#f97316", label: "较慢" };
};
