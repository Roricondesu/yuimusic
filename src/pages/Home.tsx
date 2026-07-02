import { useEffect, useMemo } from "react";
import {
  Play,
  Disc3,
  Clock,
  Flame,
  ChevronRight,
  ListMusic,
  Sparkles,
  Music2,
  Zap,
  Radio,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { GlassButton } from "@/components/glass/GlassButton";
import { SourceIcon } from "@/components/common/SourceIcon";
import { CoverImage } from "@/components/common/CoverImage";
import { generateRecommendations } from "@/utils/recommendation";
import { formatTime } from "@/utils/formatTime";
import type { Track } from "@/types";

const GENRES = ["流行", "摇滚", "嘻哈", "电子", "爵士", "古典", "R&B", "独立"];
const MOODS = ["放松", "运动", "专注", "派对", "通勤", "深夜"];

const DEFAULT_ARTISTS = [
  "周杰伦",
  "Taylor Swift",
  "Ed Sheeran",
  "The Weeknd",
  "Billie Eilish",
  "Adele",
  "BTS",
  "林俊杰",
  "邓紫棋",
  "陈奕迅",
  "Justin Bieber",
  "Dua Lipa",
  "Bruno Mars",
  "Lady Gaga",
  "Rihanna",
  "Coldplay",
  "Maroon 5",
  "Post Malone",
  "Ariana Grande",
  "Drake",
];

function pickRandomArtist() {
  return DEFAULT_ARTISTS[Math.floor(Math.random() * DEFAULT_ARTISTS.length)];
}

function SourceBadge({ track }: { track: Track }) {
  return <SourceIcon source={track.source} size={11} />;
}

function PlayOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
      style={{ background: "rgba(0,0,0,0.35)" }}
    >
      <Play size={18} fill="#fff" color="#fff" />
    </div>
  );
}

/** 横向卡片（大封面 + 标题） */
function CardRow({
  tracks,
  onPlay,
}: {
  tracks: Track[];
  onPlay: (t: Track) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
      {tracks.map((track, i) => (
        <button
          key={track.id}
          onClick={() => onPlay(track)}
          className="solid-card group shrink-0 text-left transition-transform hover:-translate-y-1 active:scale-[0.98]"
          style={{
            border: "none",
            padding: 0,
            width: 156,
            animation: `stagger-fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both`,
            animationDelay: `${0.08 + i * 0.04}s`,
          }}
        >
          <div
            className="relative overflow-hidden rounded-xl"
            style={{ aspectRatio: "1 / 1", margin: 10, width: "calc(100% - 20px)" }}
          >
            <CoverImage
              src={track.cover}
              alt={track.title}
              className="h-full w-full object-cover"
              iconSize={28}
            />
            <PlayOverlay />
          </div>
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1.5">
              <span
                className="truncate text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {track.title}
              </span>
              <SourceBadge track={track} />
            </div>
            <div
              className="truncate text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {track.artist}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/** 列表式曲目行 */
function TrackRow({
  track,
  onPlay,
}: {
  track: Track;
  onPlay: (t: Track) => void;
}) {
  return (
    <button
      onClick={() => onPlay(track)}
      className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      style={{ border: "none", background: "transparent", cursor: "pointer" }}
    >
      <div
        className="relative shrink-0 overflow-hidden rounded-lg"
        style={{ width: 48, height: 48 }}
      >
        <CoverImage
          src={track.cover}
          alt={track.title}
          className="h-full w-full object-cover"
          iconSize={20}
        />
        <PlayOverlay />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="truncate text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {track.title}
          </span>
          <SourceBadge track={track} />
        </div>
        <div
          className="truncate text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {track.artist}
        </div>
      </div>
      <span
        className="hidden text-xs tabular-nums sm:block"
        style={{ color: "var(--text-secondary)" }}
      >
        {formatTime(track.duration)}
      </span>
    </button>
  );
}

/** 分区标题 */
function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--text-secondary)" }}>{icon}</span>
        <h2
          className="text-base font-semibold md:text-lg"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const tracks = useAppStore((s) => s.library.tracks);
  const loading = useAppStore((s) => s.library.loading);
  const history = useAppStore((s) => s.player.history);
  const favorites = useAppStore((s) => s.player.favorites);
  const playlists = useAppStore((s) => s.player.playlists);
  const playTrack = useAppStore((s) => s.playTrack);
  const searchTracks = useAppStore((s) => s.searchTracks);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setOpenPlaylist = useAppStore((s) => s.setOpenPlaylist);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";

  const recs = useMemo(
    () => generateRecommendations(tracks, history, favorites),
    [tracks, history, favorites],
  );

  useEffect(() => {
    if (tracks.length === 0 && !loading) {
      searchTracks(pickRandomArtist());
    }
  }, []);

  const handlePlay = (track: Track, context?: Track[]) => {
    playTrack(track, context || tracks);
  };

  const playGenre = (genre: string) => {
    searchTracks(genre);
    setActiveTab("library");
  };

  const playMood = (mood: string) => {
    const queryMap: Record<string, string> = {
      放松: "chill",
      运动: "workout",
      专注: "focus",
      派对: "party",
      通勤: "commute",
      深夜: "late night",
    };
    searchTracks(queryMap[mood] || mood);
    setActiveTab("library");
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 顶部 Bento：问候 + 每日精选 + 快速播放 */}
      <section className="animate-enter animate-enter-1">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* 问候与精选 */}
          <div
            className="solid-card relative overflow-hidden md:col-span-7"
            style={{
              padding: 0,
              background: `linear-gradient(135deg, var(--accent-soft), transparent 65%)`,
            }}
          >
            <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div
                className="shrink-0 overflow-hidden rounded-2xl shadow-lg"
                style={{ width: "100%", maxWidth: 200, aspectRatio: "1 / 1" }}
              >
                {recs.featured ? (
                  <CoverImage
                    src={recs.featured.cover}
                    alt={recs.featured.title}
                    className="h-full w-full object-cover"
                    iconSize={48}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: "var(--surface-elevated)" }}
                  >
                    <Disc3 size={48} style={{ color: "var(--text-secondary)" }} />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div
                  className="w-fit rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {recs.greeting}
                </div>
                <h1
                  className="text-2xl font-bold tracking-tight md:text-3xl"
                  style={{ color: "var(--text-primary)" }}
                >
                  {recs.featured?.title ?? "Liquid Music"}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {recs.featured
                    ? `${recs.featured.artist} · ${recs.featured.album}`
                    : "由 Audius 与 iTunes 驱动"}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <GlassButton
                    scheme={scheme}
                    onClick={() => recs.featured && handlePlay(recs.featured)}
                    disabled={!recs.featured}
                  >
                    <Play size={16} fill="currentColor" />
                    立即播放
                  </GlassButton>
                  <GlassButton
                    scheme={scheme}
                    onClick={() => setActiveTab("library")}
                  >
                    浏览曲库
                  </GlassButton>
                </div>
              </div>
            </div>
          </div>

          {/* 快速播放列表 */}
          <div className="solid-card md:col-span-5" style={{ padding: 0 }}>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <Zap size={16} style={{ color: "var(--accent)" }} />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  快速播放
                </h2>
              </div>
              <button
                onClick={() => recs.quickPicks[0] && handlePlay(recs.quickPicks[0], recs.quickPicks)}
                className="text-xs font-medium"
                style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
              >
                播放全部
              </button>
            </div>
            <div className="max-h-[260px] overflow-y-auto px-2 pb-3">
              {loading && recs.quickPicks.length === 0 ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="solid-card h-12" style={{ border: "none" }} />
                  ))}
                </div>
              ) : (
                recs.quickPicks.slice(0, 8).map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onPlay={(t) => handlePlay(t, recs.quickPicks)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 第二行 Bento：我的歌单 + 完整版专区 */}
      <section className="animate-enter animate-enter-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* 我的歌单 */}
          {playlists.length > 0 && (
            <div className="solid-card md:col-span-5" style={{ padding: 0 }}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <ListMusic size={16} style={{ color: "var(--text-secondary)" }} />
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    我的歌单
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab("playlists")}
                  className="flex items-center gap-0.5 text-xs font-medium"
                  style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
                >
                  全部 <ChevronRight size={12} />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto px-3 pb-3 hide-scrollbar">
                {playlists.slice(0, 8).map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      setActiveTab("playlists");
                      setOpenPlaylist(pl.id);
                    }}
                    className="solid-card group shrink-0 text-left transition-transform hover:-translate-y-1"
                    style={{ width: 130, padding: 0, border: "none" }}
                  >
                    <div
                      className="flex items-center justify-center rounded-xl"
                      style={{
                        margin: 8,
                        width: "calc(100% - 16px)",
                        aspectRatio: "1 / 1",
                        background: pl.color || "var(--accent)",
                        color: "#fff",
                      }}
                    >
                      <ListMusic size={28} />
                    </div>
                    <div className="px-2.5 pb-2.5">
                      <div
                        className="truncate text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {pl.name}
                      </div>
                      <div
                        className="truncate text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {pl.tracks.length} 首
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 完整版专区 */}
          <div
            className={`solid-card ${playlists.length > 0 ? "md:col-span-7" : "md:col-span-12"}`}
            style={{ padding: 0 }}
          >
            <div className="p-4">
              <SectionHeader
                icon={<Music2 size={16} />}
                title="完整版推荐"
                action={
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    无需担心 30 秒中断
                  </span>
                }
              />
              <div>
              {loading && recs.fullVersions.length === 0 ? (
                <div className="flex gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="solid-card shrink-0" style={{ width: 150, height: 200 }} />
                  ))}
                </div>
              ) : (
                <CardRow
                  tracks={recs.fullVersions}
                  onPlay={(t) => handlePlay(t, recs.fullVersions)}
                />
              )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 热门趋势 */}
      <section className="animate-enter animate-enter-3">
        <SectionHeader
          icon={<Flame size={18} />}
          title="热门趋势"
          action={
            <button
              onClick={() => setActiveTab("library")}
              className="flex items-center gap-0.5 text-xs font-medium"
              style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
            >
              查看全部 <ChevronRight size={14} />
            </button>
          }
        />
        {loading && recs.trending.length === 0 ? (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="solid-card shrink-0" style={{ width: 156, height: 210 }} />
            ))}
          </div>
        ) : (
          <CardRow tracks={recs.trending} onPlay={(t) => handlePlay(t)} />
        )}
      </section>

      {/* 为你推荐 */}
      <section className="animate-enter animate-enter-4">
        <SectionHeader
          icon={<Sparkles size={18} />}
          title="为你推荐"
          action={
            history.length === 0 && favorites.length === 0 ? (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                多播放几首，推荐会更准
              </span>
            ) : undefined
          }
        />
        {loading && recs.forYou.length === 0 ? (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="solid-card shrink-0" style={{ width: 156, height: 210 }} />
            ))}
          </div>
        ) : (
          <CardRow tracks={recs.forYou} onPlay={(t) => handlePlay(t)} />
        )}
      </section>

      {/* 随机发现 */}
      <section className="animate-enter animate-enter-5">
        <SectionHeader icon={<Radio size={18} />} title="随机发现" />
        {loading && recs.discoveries.length === 0 ? (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="solid-card shrink-0" style={{ width: 156, height: 210 }} />
            ))}
          </div>
        ) : (
          <CardRow tracks={recs.discoveries} onPlay={(t) => handlePlay(t)} />
        )}
      </section>

      {/* 场景与流派 */}
      <section className="animate-enter animate-enter-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 流派 */}
          <div className="solid-card p-4">
            <SectionHeader icon={<Disc3 size={16} />} title="流派" />
            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => playGenre(genre)}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-transform active:scale-95"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* 场景 */}
          <div className="solid-card p-4">
            <SectionHeader icon={<Clock size={16} />} title="场景" />
            <div className="flex flex-wrap gap-2">
              {MOODS.map((mood) => (
                <button
                  key={mood}
                  onClick={() => playMood(mood)}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-transform active:scale-95"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 最近播放 */}
      {history.length > 0 && (
        <section className="animate-enter animate-enter-5">
          <SectionHeader icon={<Clock size={16} />} title="最近播放" />
          <div className="solid-card p-3">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {history.slice(0, 6).map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  onPlay={(t) => handlePlay(t, history)}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
