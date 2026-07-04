import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Heart,
  ListMusic,
  ChevronLeft,
  Download,
  Check,
  Loader2,
  X,
  Mic2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  RefreshCw,
  Upload,
  Languages,
  Trash2,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { SourceIcon } from "../components/common/SourceIcon";
import { CoverImage } from "../components/common/CoverImage";
import type { LyricLine, Track, LyricLanguage } from "../types";

/* ---------- 歌词列表 ---------- */
function LyricList({
  lyrics,
  loading,
  currentIndex,
  fontSize,
  fontWeight,
  fontFamily,
  effect,
  isDark,
  align,
  bounceScroll,
  letterSpacing,
  lineHeight,
  scrollRef,
  onSeek,
  duration,
  reduceMotion,
}: {
  lyrics: LyricLine[];
  loading: boolean;
  currentIndex: number;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  effect: "none" | "blur" | "fade";
  isDark: boolean;
  align: "left" | "center" | "right";
  bounceScroll: boolean;
  letterSpacing: "compact" | "normal" | "loose";
  lineHeight: "tight" | "normal" | "relaxed";
  scrollRef: React.RefObject<HTMLDivElement>;
  onSeek: (p: number) => void;
  duration: number;
  reduceMotion: boolean;
}) {
  const lastIdxRef = useRef(-1);
  const rafRef = useRef<number | null>(null);

  // 回弹滚动：自定义动画，到达目标后轻微回弹
  const animateBounceScroll = useCallback(
    (container: HTMLDivElement, target: number) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const start = container.scrollTop;
      const delta = target - start;
      const durationMs = 620;
      const startTime = performance.now();
      // 回弹曲线：先冲过目标少许，再回到目标
      // 用两段缓动近似：过冲量 6%
      const overshoot = delta * 0.06;

      const easeOutBack = (t: number) => {
        const c1 = 1.2;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = easeOutBack(t);
        const next = start + (delta + overshoot) * eased - overshoot * Math.min(1, t * 1.1);
        container.scrollTop = next;
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          container.scrollTop = target;
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // 歌曲开始时 currentIndex 可能为 -1，此时将第一行居中预览
    const targetIdx = currentIndex < 0 ? 0 : currentIndex;
    if (lastIdxRef.current === targetIdx) return;
    lastIdxRef.current = targetIdx;

    const el = container.querySelector(
      `[data-idx="${targetIdx}"]`,
    ) as HTMLElement | null;
    if (!el) return;

    const target =
      el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    const clamped = Math.max(0, target);

    if (reduceMotion) {
      container.scrollTop = clamped;
    } else if (bounceScroll) {
      animateBounceScroll(container, clamped);
    } else {
      container.scrollTo({ top: clamped, behavior: "smooth" });
    }
  }, [currentIndex, scrollRef, reduceMotion, bounceScroll, animateBounceScroll]);

  useEffect(() => {
    lastIdxRef.current = -1;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [lyrics, scrollRef]);

  // 容器（重新）挂载后，立即定位到当前歌词，避免切换页面时停在顶部
  useEffect(() => {
    if (!scrollRef.current) return;
    // 等 DOM 稳定后定位
    const raf = requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      const targetIdx = currentIndex < 0 ? 0 : currentIndex;
      const el = container.querySelector(
        `[data-idx="${targetIdx}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      const target =
        el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTop = Math.max(0, target);
      lastIdxRef.current = targetIdx;
    });
    return () => cancelAnimationFrame(raf);
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const itemStyle = useCallback(
    (i: number): React.CSSProperties => {
      const active = i === currentIndex;
      const dist = Math.abs(i - currentIndex);

      // 颜色：当前行使用强调色；相邻行更亮，远行渐暗
      const baseColor = active
        ? "var(--accent)"
        : dist <= 1
          ? isDark
            ? "rgba(255,255,255,0.62)"
            : "rgba(0,0,0,0.58)"
          : isDark
            ? "rgba(255,255,255,0.32)"
            : "rgba(0,0,0,0.32)";

      const ls =
        letterSpacing === "compact" ? "0em" : letterSpacing === "loose" ? "0.06em" : "0.02em";

      // 焦点行永远不模糊、不透明
      if (active) {
        return {
          fontSize: Math.round(fontSize * 1.32),
          fontWeight: 700,
          color: baseColor,
          transform: "scale(1.02)",
          letterSpacing: ls,
          filter: "none",
          opacity: 1,
        };
      }
      if (effect === "none") {
        return {
          fontSize,
          fontWeight,
          color: baseColor,
          transform: "scale(1)",
          letterSpacing: ls,
        };
      }
      if (effect === "fade") {
        return {
          fontSize,
          fontWeight,
          color: baseColor,
          opacity: Math.max(0.2, 1 - dist * 0.2),
          transform: "scale(1)",
          letterSpacing: ls,
          filter: "none",
        };
      }
      // blur：焦点外的行渐变模糊，但焦点本身不模糊（上面已处理）
      return {
        fontSize,
        fontWeight,
        color: baseColor,
        opacity: Math.max(0.3, 1 - dist * 0.08),
        filter: `blur(${Math.min(3, dist * 0.5)}px)`,
        transform: "scale(1)",
        letterSpacing: ls,
      };
    },
    [currentIndex, fontSize, fontWeight, effect, isDark, letterSpacing],
  );

  const alignClass =
    align === "left"
      ? "items-start text-left"
      : align === "right"
        ? "items-end text-right"
        : "items-center text-center";

  const padSide = align === "left" ? "0 0.5rem 0 1.25rem" : align === "right" ? "0 1.25rem 0 0.5rem" : undefined;

  const lhValue =
    lineHeight === "tight" ? 1.35 : lineHeight === "relaxed" ? 2.0 : 1.6;
  const gapValue =
    lineHeight === "tight" ? "0.05em" : lineHeight === "relaxed" ? "0.3em" : "0.15em";

  return (
    <div
      ref={scrollRef}
      className="lyric-scroll flex-1 overflow-y-auto rounded-xl px-3"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
        scrollBehavior: bounceScroll && !reduceMotion ? "auto" : "smooth",
      }}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      ) : lyrics.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <Mic2 size={28} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            暂无歌词
          </p>
        </div>
      ) : (
        <div
          className={`flex flex-col ${alignClass}`}
          style={{
            fontFamily,
            gap: gapValue,
            // 首尾留出半屏空间，使第一行/最后一行也能滚到容器中心
            paddingTop: "45%",
            paddingBottom: "45%",
          }}
        >
          {lyrics.map((line, i) => {
            const active = i === currentIndex;
            const hasTranslation = Boolean(line.translation);
            return (
              <p
                key={i}
                data-idx={i}
                className={`lyric-line cursor-pointer transition-[color,opacity,filter,transform,font-size,letter-spacing] duration-500 ${active ? "lyric-focus" : ""}`}
                style={{
                  ...itemStyle(i),
                  lineHeight: lhValue,
                  maxWidth: align === "center" ? "92%" : "100%",
                  padding: padSide,
                  margin: align === "center" ? "0 auto" : undefined,
                  textShadow: active
                    ? isDark
                      ? "0 1px 12px rgba(0,0,0,0.4)"
                      : "0 1px 8px rgba(0,0,0,0.08)"
                    : "none",
                }}
                onClick={() => onSeek(duration > 0 ? line.time / duration : 0)}
              >
                <span>{line.text || "♪"}</span>
                {hasTranslation && (
                  <span
                    className="block"
                    style={{
                      marginTop: 4,
                      fontSize: "0.72em",
                      fontWeight: active ? 500 : 400,
                      opacity: active ? 0.92 : 0.7,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {line.translation}
                  </span>
                )}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- 黑胶唱片封面 ---------- */
function VinylCover({
  track,
  isPlaying,
  reduceMotion,
}: {
  track: Track;
  isPlaying: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div className="relative flex items-center justify-center">
      <div
        className="relative overflow-hidden rounded-full shadow-2xl"
        style={{
          width: "min(48vw, 280px)",
          height: "min(48vw, 280px)",
          maxWidth: 280,
          maxHeight: 280,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle, #1a1a1a 30%, #0a0a0a 100%)",
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                inset: `${(i + 1) * 4}%`,
                border: "0.5px solid rgba(255,255,255,0.04)",
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            animation: reduceMotion
              ? "none"
              : isPlaying
                ? "vinyl-spin 8s linear infinite"
                : "none",
            animationPlayState: isPlaying ? "running" : "paused",
          }}
        >
          <div
            className="overflow-hidden rounded-full"
            style={{ width: "55%", height: "55%" }}
          >
            <CoverImage
              src={track.cover}
              alt={track.title}
              className="h-full w-full object-cover"
              iconSize={48}
            />
          </div>
        </div>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 12,
            height: 12,
            background: "#000",
            border: "2px solid rgba(255,255,255,0.15)",
          }}
        />
      </div>
    </div>
  );
}

/* ---------- 播放队列面板 ---------- */
function QueuePanel({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: (track: Track, context: Track[]) => void;
}) {
  const contextQueue = useAppStore((s) => s.player.contextQueue);
  const libraryTracks = useAppStore((s) => s.library.tracks);
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const queue = contextQueue.length > 0 ? contextQueue : libraryTracks;

  return (
    <div
      className="overlay-fade absolute inset-0 z-30 flex flex-col"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(20px)",
        // 让遮罩底部延伸到 BottomPlayer 之下，避免出现硬黑边
        bottom: 0,
      }}
      onClick={onClose}
    >
      <div
        className="sheet-enter mt-auto max-h-[60%] overflow-hidden rounded-t-3xl"
        style={{
          background: "var(--surface)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          marginBottom: 96,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <ListMusic size={18} style={{ color: "var(--accent)" }} />
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              播放队列
            </h3>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {queue.length} 首
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto px-3 pb-5">
          {queue.map((track, i) => {
            const active = currentTrack?.id === track.id;
            return (
              <button
                key={track.id}
                onClick={() => onPlay(track, queue)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ border: "none", background: "transparent", cursor: "pointer" }}
              >
                <span className="w-5 text-center text-xs tabular-nums" style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
                  {i + 1}
                </span>
                <div className="shrink-0 overflow-hidden rounded-md" style={{ width: 36, height: 36 }}>
                  <CoverImage src={track.cover} alt={track.title} className="h-full w-full object-cover" iconSize={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                    {track.title}
                  </div>
                  <div className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {track.artist}
                  </div>
                </div>
                {active && (
                  <div className="flex items-end gap-0.5" style={{ color: "var(--accent)", height: 16 }}>
                    <span style={{ width: 3, height: 8, background: "currentColor", borderRadius: 2, animation: "vinyl-spin 1s ease-in-out infinite alternate" }} />
                    <span style={{ width: 3, height: 12, background: "currentColor", borderRadius: 2, animation: "vinyl-spin 0.8s ease-in-out infinite alternate-reverse" }} />
                    <span style={{ width: 3, height: 6, background: "currentColor", borderRadius: 2, animation: "vinyl-spin 1.2s ease-in-out infinite alternate" }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- 歌词设置浮层 ---------- */
function LyricSettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const updateSetting = useAppStore((s) => s.updateSetting);

  const iconBtn = (active?: boolean): React.CSSProperties => ({
    border: "none",
    background: active ? "var(--accent-soft)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    cursor: "pointer",
    padding: 8,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  });

  const labelStyle: React.CSSProperties = {
    color: "var(--text-secondary)",
    fontSize: 12,
    marginBottom: 6,
  };

  return (
    <div
      className="overlay-fade absolute inset-0 z-30 flex flex-col"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(20px)",
        bottom: 0,
      }}
      onClick={onClose}
    >
      <div
        className="sheet-enter mt-auto max-h-[85vh] overflow-y-auto rounded-t-3xl p-5"
        style={{
          background: "var(--surface)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          marginBottom: 96,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type size={18} style={{ color: "var(--accent)" }} />
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              歌词样式
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 对齐方式 */}
        <div className="mb-4">
          <div style={labelStyle}>对齐方式</div>
          <div className="flex gap-2">
            {([
              { key: "left", icon: AlignLeft, label: "左" },
              { key: "center", icon: AlignCenter, label: "中" },
              { key: "right", icon: AlignRight, label: "右" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => updateSetting("lyricAlign", opt.key)}
                style={iconBtn(settings.lyricAlign === opt.key)}
                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium"
              >
                <opt.icon size={16} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 字号 */}
        <div className="mb-4">
          <div style={labelStyle}>字号</div>
          <div className="flex gap-2">
            {(["small", "medium", "large"] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateSetting("lyricFontSize", s)}
                style={iconBtn(settings.lyricFontSize === s)}
                className="flex-1 py-2.5 text-sm font-medium"
              >
                {s === "small" ? "小" : s === "medium" ? "中" : "大"}
              </button>
            ))}
          </div>
        </div>

        {/* 字重 */}
        <div className="mb-4">
          <div style={labelStyle}>字重</div>
          <div className="flex gap-2">
            {([
              { key: "normal", label: "常规", weight: 400 },
              { key: "medium", label: "中等", weight: 500 },
              { key: "bold", label: "粗体", weight: 700 },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => updateSetting("lyricWeight", opt.key)}
                style={{
                  ...iconBtn(settings.lyricWeight === opt.key),
                  fontWeight: opt.weight,
                }}
                className="flex-1 py-2.5 text-sm"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 字体族 */}
        <div className="mb-4">
          <div style={labelStyle}>字体</div>
          <div className="flex gap-2">
            {([
              { key: "system", label: "系统", family: "inherit" },
              { key: "serif", label: "衬线", family: "Georgia, serif" },
              { key: "mono", label: "等宽", family: "monospace" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => updateSetting("lyricFontFamily", opt.key)}
                style={{
                  ...iconBtn(settings.lyricFontFamily === opt.key),
                  fontFamily: opt.family,
                }}
                className="flex-1 py-2.5 text-sm"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 效果 */}
        <div className="mb-4">
          <div style={labelStyle}>非当前行效果</div>
          <div className="flex gap-2">
            {([
              { key: "none", label: "无" },
              { key: "fade", label: "淡出" },
              { key: "blur", label: "模糊" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => updateSetting("lyricEffect", opt.key)}
                style={iconBtn(settings.lyricEffect === opt.key)}
                className="flex-1 py-2.5 text-sm font-medium"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 字距 */}
        <div className="mb-4">
          <div style={labelStyle}>字距</div>
          <div className="flex gap-2">
            {([
              { key: "compact", label: "紧凑", ls: "0em" },
              { key: "normal", label: "标准", ls: "0.02em" },
              { key: "loose", label: "宽松", ls: "0.06em" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => updateSetting("lyricLetterSpacing", opt.key)}
                style={{
                  ...iconBtn(settings.lyricLetterSpacing === opt.key),
                  letterSpacing: opt.ls,
                }}
                className="flex-1 py-2.5 text-sm font-medium"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 行高 */}
        <div className="mb-4">
          <div style={labelStyle}>行高</div>
          <div className="flex gap-2">
            {([
              { key: "tight", label: "紧凑", lh: 1.35 },
              { key: "normal", label: "标准", lh: 1.6 },
              { key: "relaxed", label: "宽松", lh: 2.0 },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => updateSetting("lyricLineHeight", opt.key)}
                style={{
                  ...iconBtn(settings.lyricLineHeight === opt.key),
                  lineHeight: opt.lh,
                }}
                className="flex-1 py-2.5 text-sm font-medium"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 回弹滚动开关 */}
        <div className="flex items-center justify-between rounded-xl px-3 py-3" style={{ background: "var(--surface-elevated)" }}>
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              回弹滚动
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              歌词切换时带轻微回弹动画
            </span>
          </div>
          <button
            onClick={() => updateSetting("lyricBounceScroll", !settings.lyricBounceScroll)}
            role="switch"
            aria-checked={settings.lyricBounceScroll}
            aria-label="回弹滚动"
            className="relative transition-all duration-300"
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              border: "none",
              cursor: "pointer",
              background: settings.lyricBounceScroll ? "var(--accent)" : "var(--surface)",
              boxShadow: settings.lyricBounceScroll ? "none" : "inset 0 0 0 1px var(--border)",
              transitionTimingFunction: "var(--ease-silk)",
            }}
          >
            <span
              className="absolute top-1 rounded-full bg-white transition-all duration-300"
              style={{
                width: 22,
                height: 22,
                left: settings.lyricBounceScroll ? 21 : 3,
                transitionTimingFunction: "var(--ease-out-back)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 主组件 ---------- */
export default function NowPlaying() {
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const theme = useAppStore((s) => s.settings.theme);
  const lyricFontSize = useAppStore((s) => s.settings.lyricFontSize);
  const lyricEffect = useAppStore((s) => s.settings.lyricEffect);
  const lyricAlign = useAppStore((s) => s.settings.lyricAlign);
  const lyricWeight = useAppStore((s) => s.settings.lyricWeight);
  const lyricFontFamily = useAppStore((s) => s.settings.lyricFontFamily);
  const lyricBounceScroll = useAppStore((s) => s.settings.lyricBounceScroll);
  const lyricLetterSpacing = useAppStore((s) => s.settings.lyricLetterSpacing);
  const lyricLineHeight = useAppStore((s) => s.settings.lyricLineHeight);
  const reduceMotion = useAppStore((s) => s.settings.reduceMotion);
  const lyricLanguage = useAppStore((s) => s.settings.lyricLanguage);
  const showLyricSource = useAppStore((s) => s.settings.showLyricSource);
  const lyrics = useAppStore((s) => s.player.lyrics);
  const lyricsLoading = useAppStore((s) => s.player.lyricsLoading);
  const currentLyricIndex = useAppStore((s) => s.player.currentLyricIndex);
  const lyricSourceLabel = useAppStore((s) => s.player.lyricSourceLabel);
  const fetchedLyrics = useAppStore((s) => s.player.fetchedLyrics);
  const osuDownloadProgress = useAppStore((s) => s.player.osuDownloadProgress);
  const downloadProgress = useAppStore((s) => s.player.downloadProgress);

  const setShowNowPlaying = useAppStore((s) => s.showNowPlaying);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const playTrack = useAppStore((s) => s.playTrack);
  const downloadTrack = useAppStore((s) => s.downloadTrack);
  const isDownloaded = useAppStore((s) => s.isDownloaded);
  const removeDownloadedTrack = useAppStore((s) => s.removeDownloadedTrack);
  const reloadLyrics = useAppStore((s) => s.reloadLyrics);
  const importLyricFile = useAppStore((s) => s.importLyricFile);
  const removeManualLyric = useAppStore((s) => s.removeManualLyric);
  const switchLyricLanguage = useAppStore((s) => s.switchLyricLanguage);
  const switchTrackSource = useAppStore((s) => s.switchTrackSource);
  const updateSetting = useAppStore((s) => s.updateSetting);

  const isDark = theme === "dark";
  const liked = currentTrack ? isFavorite(currentTrack.id) : false;
  const downloaded = currentTrack ? isDownloaded(currentTrack.id) : false;
  const dlProgress = currentTrack ? downloadProgress[currentTrack.id] : undefined;
  const hasTranslation = (fetchedLyrics?.translationLines?.length || 0) > 0;
  const isManualLrc = lyricSourceLabel === "本地导入";
  const alternatives = currentTrack?.alternatives || [];

  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const lyricScrollRefMobile = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mobilePage, setMobilePage] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyricSettings, setShowLyricSettings] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [lyricBusy, setLyricBusy] = useState(false);

  const fontSize = useMemo(
    () =>
      lyricFontSize === "small" ? 14 : lyricFontSize === "large" ? 20 : 17,
    [lyricFontSize],
  );

  const fontWeightNum = useMemo(
    () => (lyricWeight === "bold" ? 700 : lyricWeight === "medium" ? 500 : 400),
    [lyricWeight],
  );

  const fontFamilyStr = useMemo(
    () =>
      lyricFontFamily === "serif"
        ? "Georgia, 'Times New Roman', serif"
        : lyricFontFamily === "mono"
          ? "'SF Mono', 'Menlo', monospace"
          : "inherit",
    [lyricFontFamily],
  );

  const iconBtn = useCallback(
    (active?: boolean): React.CSSProperties => ({
      border: "none",
      background: "transparent",
      color: active
        ? "var(--accent)"
        : isDark
          ? "rgba(255,255,255,0.7)"
          : "rgba(0,0,0,0.65)",
      cursor: "pointer",
      padding: 8,
      borderRadius: 10,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "color 0.2s ease, transform 0.28s var(--ease-out-back)",
      willChange: "transform",
    }),
    [isDark],
  );

  const handleDownload = async () => {
    if (!currentTrack || downloaded || dlProgress !== undefined) return;
    try {
      await downloadTrack(currentTrack);
    } catch {
      // 静默失败
    }
  };

  // 重新获取歌词（绕过缓存）
  const handleReloadLyrics = async () => {
    if (!currentTrack || lyricBusy) return;
    setLyricBusy(true);
    try {
      await reloadLyrics();
    } finally {
      setLyricBusy(false);
    }
  };

  // 导入本地 .lrc 文件
  const handleImportLrc = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同一文件
    if (!file) return;
    setLyricBusy(true);
    try {
      const text = await file.text();
      await importLyricFile(text);
    } finally {
      setLyricBusy(false);
    }
  };

  // 清除本地导入的歌词
  const handleRemoveManualLrc = async () => {
    if (lyricBusy) return;
    setLyricBusy(true);
    try {
      await removeManualLyric();
    } finally {
      setLyricBusy(false);
    }
  };

  // 关闭弹层（语言/来源菜单）的统一处理
  useEffect(() => {
    if (!showLangMenu && !showSourceMenu) return;
    const close = () => {
      setShowLangMenu(false);
      setShowSourceMenu(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [showLangMenu, showSourceMenu]);

  useEffect(() => {
    setMobilePage(0);
    setShowQueue(false);
    setShowLyricSettings(false);
  }, [currentTrack?.id]);

  // 移动端水平滑动切换
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const axisLocked = useRef<boolean | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    axisLocked.current = null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.innerWidth >= 768) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    if (axisLocked.current === null) {
      axisLocked.current = Math.abs(dx) > Math.abs(dy);
    }
    if (axisLocked.current === true) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (window.innerWidth >= 768) return;
      if (axisLocked.current !== true) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX.current;
      const threshold = 50;
      if (dx < -threshold && mobilePage === 0) setMobilePage(1);
      else if (dx > threshold && mobilePage === 1) setMobilePage(0);
      axisLocked.current = null;
    },
    [mobilePage],
  );

  if (!currentTrack) {
    return (
      <div
        className="absolute inset-0 z-[60] flex items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="text-center">
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            暂无播放中的歌曲
          </p>
          <button
            onClick={() => setShowNowPlaying(false)}
            className="mt-4 rounded-full px-6 py-2 text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const lyricProps = {
    lyrics,
    loading: lyricsLoading,
    currentIndex: currentLyricIndex,
    fontSize,
    fontWeight: fontWeightNum,
    fontFamily: fontFamilyStr,
    effect: lyricEffect,
    isDark,
    align: lyricAlign,
    bounceScroll: lyricBounceScroll,
    letterSpacing: lyricLetterSpacing,
    lineHeight: lyricLineHeight,
    onSeek: useAppStore.getState().seekTo,
    duration: currentTrack.duration,
    reduceMotion,
  };

  const downloadButton = (size: number) => {
    if (downloaded) {
      return (
        <button
          onClick={() => removeDownloadedTrack(currentTrack.id)}
          style={iconBtn(true)}
          aria-label="已下载，点击删除"
          className="press-silk"
        >
          <Check size={size} />
        </button>
      );
    }
    if (dlProgress !== undefined) {
      return (
        <div style={iconBtn(true)} aria-label="下载中">
          <Loader2 size={size} className="animate-spin" />
        </div>
      );
    }
    return (
      <button
        onClick={handleDownload}
        style={iconBtn()}
        aria-label="下载"
        className="press-silk"
      >
        <Download size={size} />
      </button>
    );
  };

  // 语言选项配置
  const LANG_OPTIONS: { key: LyricLanguage; label: string }[] = [
    { key: "original", label: "原文" },
    { key: "translation", label: "译文" },
    { key: "bilingual", label: "双语" },
  ];

  // 歌词工具栏：来源徽标 + 语言切换 + 重新获取 + 导入 .lrc + 清除本地
  const renderLyricToolbar = () => (
    <div className="flex items-center gap-1">
      {/* 来源徽标 */}
      {showLyricSource && lyricSourceLabel && (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: isManualLrc ? "var(--accent-soft)" : "var(--surface-elevated)",
            color: isManualLrc ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          {lyricSourceLabel}
        </span>
      )}

      {/* 语言切换（仅有译文时才显示） */}
      {hasTranslation && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLangMenu((v) => !v);
              setShowSourceMenu(false);
            }}
            style={iconBtn(lyricLanguage !== "original")}
            aria-label="歌词语言"
            className="press-silk"
            title="歌词语言"
          >
            <Languages size={16} />
          </button>
          {showLangMenu && (
            <div
              className="sheet-enter absolute right-0 top-full z-40 mt-1 min-w-[88px] overflow-hidden rounded-xl py-1"
              style={{
                background: "var(--surface)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                border: "1px solid var(--border)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    switchLyricLanguage(opt.key);
                    updateSetting("lyricLanguage", opt.key);
                    setShowLangMenu(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: lyricLanguage === opt.key ? "var(--accent)" : "var(--text-primary)",
                    fontWeight: lyricLanguage === opt.key ? 600 : 400,
                  }}
                >
                  {opt.label}
                  {lyricLanguage === opt.key && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 重新获取歌词 */}
      <button
        onClick={handleReloadLyrics}
        style={iconBtn()}
        aria-label="重新获取歌词"
        className="press-silk"
        title="重新获取歌词"
        disabled={lyricBusy}
      >
        {lyricBusy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <RefreshCw size={16} />
        )}
      </button>

      {/* 导入本地 .lrc */}
      <button
        onClick={handleImportLrc}
        style={iconBtn(isManualLrc)}
        aria-label="导入本地歌词"
        className="press-silk"
        title="导入本地 .lrc 歌词"
        disabled={lyricBusy}
      >
        <Upload size={16} />
      </button>

      {/* 清除本地导入的歌词（仅本地导入时显示） */}
      {isManualLrc && (
        <button
          onClick={handleRemoveManualLrc}
          style={iconBtn()}
          aria-label="清除本地歌词"
          className="press-silk"
          title="清除本地导入的歌词"
          disabled={lyricBusy}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  // 同曲目来源切换器（当存在 alternatives 时显示）
  const renderSourceSwitcher = () => {
    if (alternatives.length === 0) return null;
    const allVariants = [currentTrack, ...alternatives].filter((t): t is Track => !!t);
    const sourceName: Record<Track["source"], string> = {
      itunes: "iTunes",
      audius: "Audius",
      jamendo: "Jamendo",
      osu: "osu!",
      bilibili: "Bilibili",
      ia: "Internet Archive",
      deezer: "Deezer",
    };
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSourceMenu((v) => !v);
            setShowLangMenu(false);
          }}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface-elevated)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
          title="切换来源"
        >
          <SourceIcon source={currentTrack.source} size={10} />
          <span>{allVariants.length} 源</span>
        </button>
        {showSourceMenu && (
          <div
            className="sheet-enter absolute left-0 top-full z-40 mt-1 min-w-[180px] overflow-hidden rounded-xl py-1"
            style={{
              background: "var(--surface)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              同曲目不同来源
            </div>
            {allVariants.map((t) => {
              const active = t.id === currentTrack.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (!active) switchTrackSource(t);
                    setShowSourceMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <SourceIcon source={t.source} size={12} />
                  <span
                    className="flex-1 truncate text-xs"
                    style={{
                      color: active ? "var(--accent)" : "var(--text-primary)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {sourceName[t.source]}
                  </span>
                  {active && <Check size={12} style={{ color: "var(--accent)" }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="absolute inset-0 z-[55] flex flex-col overflow-hidden"
      style={{ background: "var(--bg-base)" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 模糊封面背景 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${currentTrack.cover})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(80px)",
          opacity: 0.25,
          transform: "scale(1.3)",
        }}
      />
      {/* 渐变遮罩 */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "linear-gradient(180deg, rgba(9,9,12,0.3) 0%, rgba(9,9,12,0.6) 100%)"
            : "linear-gradient(180deg, rgba(232,234,239,0.3) 0%, rgba(232,234,239,0.6) 100%)",
        }}
      />

      {/* 顶部栏 */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-4 pt-4 md:px-6 md:pt-5">
        <button
          onClick={() => setShowNowPlaying(false)}
          style={iconBtn()}
          aria-label="收起"
          className="press-silk"
        >
          <ChevronDown size={24} />
        </button>
        <div className="text-center">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            正在播放
          </div>
          <div
            className="flex max-w-[60vw] items-center justify-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="truncate">{currentTrack.album || currentTrack.title}</span>
            <SourceIcon source={currentTrack.source} size={10} />
          </div>
        </div>
        <button
          onClick={() => setShowQueue(true)}
          style={iconBtn()}
          aria-label="播放队列"
          className="press-silk"
        >
          <ListMusic size={22} />
        </button>
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-28 md:px-6 md:pb-24">
        {/* 桌面端：左右分栏 */}
        <div className="hidden min-h-0 flex-1 grid-cols-2 items-center gap-8 md:grid">
          {/* 左侧：唱片 + 信息 + 操作 */}
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <VinylCover track={currentTrack} isPlaying={isPlaying} reduceMotion={reduceMotion} />

            <div className="flex w-full max-w-md flex-col items-center gap-2">
              <h1
                className="flex items-center gap-2 text-xl font-bold md:text-2xl"
                style={{ color: "var(--text-primary)" }}
              >
                <span className="truncate">{currentTrack.title}</span>
                <SourceIcon source={currentTrack.source} size={13} />
              </h1>
              <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
                {currentTrack.artist}
              </p>
              {renderSourceSwitcher()}

              {/* 下载进度条 */}
              {(osuDownloadProgress >= 0 || dlProgress !== undefined) && (
                <div className="flex w-full max-w-xs items-center gap-2">
                  <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                  <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-elevated)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((dlProgress ?? osuDownloadProgress) * 100)}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {Math.round((dlProgress ?? osuDownloadProgress) * 100)}%
                  </span>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(currentTrack)}
                  style={iconBtn(liked)}
                  aria-label="收藏"
                  className="press-silk"
                >
                  <Heart size={22} fill={liked ? "currentColor" : "none"} />
                </button>
                {downloadButton(20)}
                <button
                  onClick={() => setShowLyricSettings(true)}
                  style={iconBtn()}
                  aria-label="歌词样式"
                  className="press-silk"
                >
                  <Type size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：歌词 */}
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                onClick={() => setShowLyricSettings(true)}
                className="flex shrink-0 items-center gap-1 text-xs"
                style={{ color: "var(--accent)", border: "none", background: "transparent", cursor: "pointer" }}
              >
                <Type size={12} /> 歌词样式
              </button>
              {renderLyricToolbar()}
            </div>
            <LyricList {...lyricProps} scrollRef={lyricScrollRef} />
          </div>
        </div>

        {/* 移动端：条件渲染双页（封面/歌词），可靠的高度计算 */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
          {/* 封面页 */}
          {mobilePage === 0 && (
            <div className="sheet-enter flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-hidden">
              <VinylCover track={currentTrack} isPlaying={isPlaying} reduceMotion={reduceMotion} />

              <div className="flex w-full max-w-sm flex-col items-center gap-1">
                <h1
                  className="flex items-center gap-2 text-lg font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span className="truncate">{currentTrack.title}</span>
                  <SourceIcon source={currentTrack.source} size={12} />
                </h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {currentTrack.artist}
                </p>
                {renderSourceSwitcher()}

                {(osuDownloadProgress >= 0 || dlProgress !== undefined) && (
                  <div className="flex w-full max-w-xs items-center gap-2 mt-1">
                    <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                    <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-elevated)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round((dlProgress ?? osuDownloadProgress) * 100)}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {Math.round((dlProgress ?? osuDownloadProgress) * 100)}%
                    </span>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => toggleFavorite(currentTrack)}
                    style={iconBtn(liked)}
                    aria-label="收藏"
                    className="press-silk"
                  >
                    <Heart size={20} fill={liked ? "currentColor" : "none"} />
                  </button>
                  {downloadButton(18)}
                  <button
                    onClick={() => setShowLyricSettings(true)}
                    style={iconBtn()}
                    aria-label="歌词样式"
                    className="press-silk"
                  >
                    <Type size={18} />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <ChevronLeft size={12} />
                  <span>左滑查看歌词</span>
                </div>
              </div>
            </div>
          )}

          {/* 歌词页 */}
          {mobilePage === 1 && (
            <div className="sheet-enter flex h-full min-h-0 flex-col overflow-hidden pl-3">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  歌词
                </span>
                {renderLyricToolbar()}
              </div>
              <LyricList {...lyricProps} scrollRef={lyricScrollRefMobile} />
            </div>
          )}

          {/* 页面指示器 */}
          <div className="mt-2 flex shrink-0 justify-center gap-2">
            {[0, 1].map((p) => (
              <button
                key={p}
                onClick={() => setMobilePage(p)}
                className="transition-all"
                style={{
                  width: mobilePage === p ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: mobilePage === p ? "var(--accent)" : "var(--text-secondary)",
                  opacity: mobilePage === p ? 1 : 0.4,
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label={p === 0 ? "封面页" : "歌词页"}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 播放队列面板 */}
      {showQueue && (
        <QueuePanel
          onClose={() => setShowQueue(false)}
          onPlay={(track, ctx) => {
            playTrack(track, ctx);
            setShowQueue(false);
          }}
        />
      )}

      {/* 歌词样式设置面板 */}
      {showLyricSettings && (
        <LyricSettingsPanel onClose={() => setShowLyricSettings(false)} />
      )}

      {/* 隐藏的 .lrc 文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".lrc,.txt"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
