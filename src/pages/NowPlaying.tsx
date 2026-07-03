import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ChevronDown,
  Heart,
  Volume2,
  VolumeX,
  ListMusic,
  ChevronLeft,
  Download,
  Check,
  Loader2,
  X,
  Mic2,
  ListPlus,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { GlassCard } from "../components/glass/GlassCard";
import { SeekBar } from "../components/layout/SeekBar";
import { formatTime } from "../utils/formatTime";
import { SourceIcon } from "../components/common/SourceIcon";
import { CoverImage } from "../components/common/CoverImage";
import type { LyricLine, Track } from "../types";

/* ---------- 歌词列表（三栏布局，当前行放大） ---------- */
function LyricList({
  lyrics,
  loading,
  currentIndex,
  fontSize,
  effect,
  isDark,
  scrollRef,
  onSeek,
  duration,
  reduceMotion,
}: {
  lyrics: LyricLine[];
  loading: boolean;
  currentIndex: number;
  fontSize: number;
  effect: "none" | "blur" | "fade";
  isDark: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onSeek: (p: number) => void;
  duration: number;
  reduceMotion: boolean;
}) {
  const lastIdxRef = useRef(-1);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || currentIndex < 0) return;
    if (lastIdxRef.current === currentIndex) return;
    lastIdxRef.current = currentIndex;

    const el = container.querySelector(
      `[data-idx="${currentIndex}"]`,
    ) as HTMLElement | null;
    if (!el) return;

    const target =
      el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({
      top: Math.max(0, target),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [currentIndex, scrollRef, reduceMotion]);

  useEffect(() => {
    lastIdxRef.current = -1;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [lyrics, scrollRef]);

  // 当前行字号放大 1.4x，邻近行递减
  const sizeFor = useCallback(
    (i: number) => {
      const dist = Math.abs(i - currentIndex);
      if (dist === 0) return Math.round(fontSize * 1.4);
      if (dist === 1) return Math.round(fontSize * 1.05);
      return fontSize;
    },
    [fontSize, currentIndex],
  );

  const itemStyle = useCallback(
    (i: number): React.CSSProperties => {
      const active = i === currentIndex;
      const dist = Math.abs(i - currentIndex);
      const baseColor = active
        ? "var(--text-primary)"
        : isDark
          ? "rgba(255,255,255,0.3)"
          : "rgba(0,0,0,0.3)";

      if (active || effect === "none") {
        return {
          fontSize: sizeFor(i),
          fontWeight: active ? 700 : 400,
          color: active ? "var(--accent)" : baseColor,
          transform: active ? "scale(1.02)" : "scale(1)",
          lineHeight: 1.6,
        };
      }
      if (effect === "fade") {
        return {
          fontSize: sizeFor(i),
          fontWeight: 400,
          color: baseColor,
          opacity: Math.max(0.15, 1 - dist * 0.25),
          transform: "scale(1)",
          lineHeight: 1.6,
        };
      }
      return {
        fontSize: sizeFor(i),
        fontWeight: 400,
        color: baseColor,
        opacity: Math.max(0.25, 1 - dist * 0.12),
        filter: dist > 0 ? `blur(${Math.min(3, dist * 0.5)}px)` : undefined,
        transform: "scale(1)",
        lineHeight: 1.6,
      };
    },
    [currentIndex, effect, isDark, sizeFor],
  );

  return (
    <div
      ref={scrollRef}
      className="lyric-scroll flex-1 overflow-y-auto"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
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
        <div className="flex flex-col items-center py-10">
          {lyrics.map((line, i) => (
            <p
              key={i}
              data-idx={i}
              className="lyric-line cursor-pointer py-2 text-center transition-[color,opacity,filter,transform,font-size] duration-500"
              onClick={() => onSeek(duration > 0 ? line.time / duration : 0)}
              style={itemStyle(i)}
            >
              {line.text || "♪"}
            </p>
          ))}
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
          width: "min(50vw, 260px)",
          height: "min(50vw, 260px)",
          maxWidth: 260,
          maxHeight: 260,
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
      className="absolute inset-0 z-30 flex flex-col"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(20px)" }}
      onClick={onClose}
    >
      <div
        className="mt-auto max-h-[60%] overflow-hidden rounded-t-3xl"
        style={{ background: "var(--surface)" }}
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

/* ---------- 主组件 ---------- */
export default function NowPlaying() {
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const progress = useAppStore((s) => s.player.progress);
  const currentTime = useAppStore((s) => s.player.currentTime);
  const duration = useAppStore((s) => s.player.duration);
  const volume = useAppStore((s) => s.player.volume);
  const shuffle = useAppStore((s) => s.player.shuffle);
  const repeat = useAppStore((s) => s.player.repeat);
  const theme = useAppStore((s) => s.settings.theme);
  const lyricFontSize = useAppStore((s) => s.settings.lyricFontSize);
  const lyricEffect = useAppStore((s) => s.settings.lyricEffect);
  const reduceMotion = useAppStore((s) => s.settings.reduceMotion);
  const lyrics = useAppStore((s) => s.player.lyrics);
  const lyricsLoading = useAppStore((s) => s.player.lyricsLoading);
  const currentLyricIndex = useAppStore((s) => s.player.currentLyricIndex);
  const osuDownloadProgress = useAppStore((s) => s.player.osuDownloadProgress);
  const downloadProgress = useAppStore((s) => s.player.downloadProgress);
  const playlists = useAppStore((s) => s.player.playlists);

  const togglePlay = useAppStore((s) => s.togglePlay);
  const nextTrack = useAppStore((s) => s.nextTrack);
  const prevTrack = useAppStore((s) => s.prevTrack);
  const seekTo = useAppStore((s) => s.seekTo);
  const setVolume = useAppStore((s) => s.setVolume);
  const toggleShuffle = useAppStore((s) => s.toggleShuffle);
  const cycleRepeat = useAppStore((s) => s.cycleRepeat);
  const setShowNowPlaying = useAppStore((s) => s.showNowPlaying);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const playTrack = useAppStore((s) => s.playTrack);
  const downloadTrack = useAppStore((s) => s.downloadTrack);
  const isDownloaded = useAppStore((s) => s.isDownloaded);
  const removeDownloadedTrack = useAppStore((s) => s.removeDownloadedTrack);
  const addToPlaylist = useAppStore((s) => s.addToPlaylist);
  const isTrackInPlaylist = useAppStore((s) => s.isTrackInPlaylist);

  const scheme = theme === "dark" ? "dark" : "light";
  const isDark = scheme === "dark";
  const displayDuration = duration || currentTrack?.duration || 0;
  const isMuted = volume === 0;
  const liked = currentTrack ? isFavorite(currentTrack.id) : false;
  const downloaded = currentTrack ? isDownloaded(currentTrack.id) : false;
  const dlProgress = currentTrack ? downloadProgress[currentTrack.id] : undefined;

  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const lyricScrollRefMobile = useRef<HTMLDivElement>(null);
  const [mobilePage, setMobilePage] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);

  const fontSize = useMemo(
    () =>
      lyricFontSize === "small" ? 14 : lyricFontSize === "large" ? 20 : 17,
    [lyricFontSize],
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
      padding: 6,
      borderRadius: 8,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.15s ease, color 0.15s ease, transform 0.15s ease",
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

  const handleAddToPlaylist = (playlistId: string) => {
    if (currentTrack) addToPlaylist(playlistId, currentTrack);
    setShowPlaylistMenu(false);
  };

  useEffect(() => {
    setMobilePage(0);
    setShowQueue(false);
    setShowPlaylistMenu(false);
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
    effect: lyricEffect,
    isDark,
    onSeek: seekTo,
    duration: displayDuration,
    reduceMotion,
  };

  const downloadBtn = (size: number) => {
    if (downloaded) {
      return (
        <button
          onClick={() => removeDownloadedTrack(currentTrack.id)}
          style={iconBtn(true)}
          aria-label="已下载，点击删除"
          className="hover:scale-110"
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
        className="hover:scale-110"
      >
        <Download size={size} />
      </button>
    );
  };

  const favBtn = (size: number) => (
    <button
      onClick={() => toggleFavorite(currentTrack)}
      style={iconBtn(liked)}
      aria-label="收藏"
      className="hover:scale-110"
    >
      <Heart size={size} fill={liked ? "currentColor" : "none"} />
    </button>
  );

  const playlistMenuBtn = (size: number) => (
    <div style={{ position: "relative" }}>
      <button
        style={iconBtn()}
        onClick={() => setShowPlaylistMenu((v) => !v)}
        aria-label="加入歌单"
        className="hover:scale-110"
      >
        <ListPlus size={size} />
      </button>
      {showPlaylistMenu && (
        <div
          className="absolute bottom-full right-0 mb-2 w-48 rounded-xl py-1 shadow-2xl z-20"
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          {playlists.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              还没有歌单
            </div>
          ) : (
            playlists.map((pl) => {
              const inList = isTrackInPlaylist(pl.id, currentTrack.id);
              return (
                <button
                  key={pl.id}
                  onClick={() => handleAddToPlaylist(pl.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <span className="truncate">{pl.name}</span>
                  {inList && <Check size={12} style={{ color: "var(--accent)" }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="absolute inset-0 z-[60] flex flex-col overflow-hidden"
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
          className="hover:scale-110"
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
          className="hover:scale-110"
        >
          <ListMusic size={22} />
        </button>
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 md:px-6">
        {/* 桌面端：左中右三栏布局 */}
        <div className="hidden min-h-0 flex-1 grid-cols-[1fr_1.2fr_1fr] items-center gap-6 md:grid">
          {/* 左栏：上一首歌词（预览） */}
          <div className="flex h-full min-h-0 flex-col justify-center">
            <LyricList {...lyricProps} scrollRef={lyricScrollRef} />
          </div>

          {/* 中栏：封面 + 信息 */}
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <VinylCover track={currentTrack} isPlaying={isPlaying} reduceMotion={reduceMotion} />

            <div className="flex w-full max-w-sm flex-col items-center gap-2">
              <h1
                className="flex items-center gap-2 text-xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                <span className="truncate">{currentTrack.title}</span>
                <SourceIcon source={currentTrack.source} size={13} />
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {currentTrack.artist}
              </p>

              {/* 下载进度条 */}
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

              {/* 操作按钮 */}
              <div className="mt-1 flex items-center gap-2">
                {favBtn(20)}
                {downloadBtn(20)}
                {playlistMenuBtn(20)}
              </div>
            </div>
          </div>

          {/* 右栏：下一首歌词（预览） */}
          <div className="flex h-full min-h-0 flex-col justify-center">
            <LyricList {...lyricProps} scrollRef={lyricScrollRef} />
          </div>
        </div>

        {/* 移动端：横向滑动双页 */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
          <div
            className="flex flex-1 overflow-hidden transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(${mobilePage === 0 ? "0%" : "-100%"})`,
            }}
          >
            {/* 封面页 */}
            <div className="flex w-full shrink-0 flex-col items-center justify-center gap-4 overflow-hidden">
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
                  {favBtn(20)}
                  {downloadBtn(18)}
                  {playlistMenuBtn(18)}
                </div>

                {mobilePage === 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <ChevronLeft size={12} />
                    <span>左滑查看歌词</span>
                  </div>
                )}
              </div>
            </div>

            {/* 歌词页 */}
            <div className="flex w-full shrink-0 flex-col overflow-hidden pl-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  歌词
                </span>
                <button
                  onClick={() => setMobilePage(0)}
                  className="flex items-center gap-0.5 text-xs"
                  style={{ color: "var(--accent)", border: "none", background: "transparent", cursor: "pointer" }}
                >
                  <ChevronLeft size={12} /> 封面
                </button>
              </div>
              <LyricList {...lyricProps} scrollRef={lyricScrollRefMobile} />
            </div>
          </div>

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

      {/* 底部玻璃播放栏（沿用 BottomPlayer 风格） */}
      <div className="relative z-20 shrink-0 px-3 pb-3 md:px-6 md:pb-5">
        <GlassCard
          scheme={scheme}
          style={{
            borderRadius: 20,
            padding: "12px 16px",
            maxWidth: "min(calc(100vw - 24px), 1100px)",
            margin: "0 auto",
          }}
        >
          {/* 桌面端控制栏 */}
          <div className="hidden md:flex md:items-center md:justify-center">
            <div className="flex w-full items-center gap-4">
              {/* 左：封面信息 */}
              <div className="flex min-w-0 items-center gap-3" style={{ width: 240, flexShrink: 0 }}>
                <div
                  className="shrink-0 overflow-hidden rounded-lg"
                  style={{ width: 44, height: 44, background: "rgba(128,128,128,0.15)" }}
                >
                  <CoverImage
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                    className="h-full w-full object-cover"
                    iconSize={18}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {currentTrack.title}
                    </span>
                    <SourceIcon source={currentTrack.source} size={11} />
                  </div>
                  <div className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {currentTrack.artist}
                  </div>
                </div>
              </div>

              {/* 中：控制 + 进度 */}
              <div className="flex flex-1 flex-col items-center gap-1">
                <div className="flex items-center justify-center gap-2">
                  <button style={iconBtn(shuffle)} onClick={toggleShuffle} aria-label="随机播放" className="hover:scale-110">
                    <Shuffle size={16} />
                  </button>
                  <button style={iconBtn()} onClick={prevTrack} aria-label="上一首" className="hover:scale-110">
                    <SkipBack size={20} />
                  </button>
                  <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? "暂停" : "播放"}
                    style={{
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      cursor: "pointer",
                      padding: 10,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.15s ease",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }}
                    className="hover:scale-105"
                  >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  <button style={iconBtn()} onClick={nextTrack} aria-label="下一首" className="hover:scale-110">
                    <SkipForward size={20} />
                  </button>
                  <button style={iconBtn(repeat !== "off")} onClick={cycleRepeat} aria-label={`循环: ${repeat}`} className="hover:scale-110">
                    {repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
                  </button>
                </div>
                {/* 进度条 */}
                <div className="flex w-full items-center gap-2">
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)", width: 32, textAlign: "right", flexShrink: 0 }}>
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex flex-1 items-center" style={{ minHeight: 20 }}>
                    <SeekBar progress={progress} onSeek={seekTo} scheme={scheme} />
                  </div>
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)", width: 32, flexShrink: 0 }}>
                    {formatTime(displayDuration)}
                  </span>
                </div>
              </div>

              {/* 右：音量 + 操作 */}
              <div className="flex items-center gap-1" style={{ width: 160, flexShrink: 0, justifyContent: "flex-end" }}>
                {favBtn(16)}
                {downloadBtn(16)}
                <button style={iconBtn(isMuted)} onClick={() => setVolume(isMuted ? 0.8 : 0)} aria-label={isMuted ? "取消静音" : "静音"}>
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div style={{ width: 70 }}>
                  <SeekBar progress={volume} onSeek={setVolume} scheme={scheme} />
                </div>
              </div>
            </div>
          </div>

          {/* 移动端控制栏 */}
          <div className="flex flex-col md:hidden">
            <div className="flex items-center gap-2" style={{ justifyContent: "space-between" }}>
              <div className="min-w-0 flex-1" style={{ minWidth: 80 }}>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {currentTrack.title}
                  </span>
                  <SourceIcon source={currentTrack.source} size={11} />
                </div>
                <div className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                  {currentTrack.artist}
                </div>
              </div>
              <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                {favBtn(16)}
                {downloadBtn(16)}
                <button style={iconBtn()} onClick={prevTrack} aria-label="上一首">
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? "暂停" : "播放"}
                  style={{
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    cursor: "pointer",
                    padding: 9,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  }}
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button style={iconBtn()} onClick={nextTrack} aria-label="下一首">
                  <SkipForward size={18} />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)", width: 28, textAlign: "right", flexShrink: 0 }}>
                {formatTime(currentTime)}
              </span>
              <SeekBar progress={progress} onSeek={seekTo} scheme={scheme} />
              <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)", width: 28, flexShrink: 0 }}>
                {formatTime(displayDuration)}
              </span>
            </div>
          </div>
        </GlassCard>
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
    </div>
  );
}
