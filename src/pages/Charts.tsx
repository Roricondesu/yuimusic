import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  Play,
  Pause,
  Disc3,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { SourceIcon } from "@/components/common/SourceIcon";
import { CoverImage } from "@/components/common/CoverImage";
import { formatTime } from "@/utils/formatTime";
import { fetchCharts, type ChartSection } from "@/utils/musicSources";
import type { Track } from "@/types";

/** 前三名排名样式 */
const RANK_STYLES: Record<number, string> = {
  1: "#ffb800",
  2: "#c0c0c0",
  3: "#cd7f32",
};

function ChartSectionView({
  section,
  index,
}: {
  section: ChartSection;
  index: number;
}) {
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const playTrack = useAppStore((s) => s.playTrack);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const showNowPlaying = useAppStore((s) => s.showNowPlaying);

  const handlePlay = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, section.tracks);
    }
  };

  const handlePlayAll = () => {
    if (section.tracks.length === 0) return;
    playTrack(section.tracks[0], section.tracks);
  };

  return (
    <section
      className="animate-enter"
      style={{ animationDelay: `${0.1 + index * 0.08}s` }}
    >
      <div className="solid-card" style={{ padding: 0 }}>
        {/* 分区头部 */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <SourceIcon source={section.source} size={16} />
            <h2
              className="text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {section.title}
            </h2>
            <span
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {section.tracks.length} 首
            </span>
          </div>
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-1 text-xs font-medium"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--accent)",
              cursor: "pointer",
            }}
          >
            <Play size={12} fill="currentColor" />
            播放全部
          </button>
        </div>

        {/* 排行列表 */}
        <div className="px-2 pb-2">
          {section.tracks.map((track, i) => {
            const active = currentTrack?.id === track.id;
            const rankStyle = RANK_STYLES[i + 1];
            return (
              <div
                key={track.id}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                {/* 排名 */}
                <span
                  className="flex w-7 shrink-0 items-center justify-center text-sm font-bold tabular-nums"
                  style={{
                    color: rankStyle || "var(--text-secondary)",
                  }}
                >
                  {active && isPlaying ? (
                    <button
                      onClick={() => handlePlay(track)}
                      style={{ color: "var(--accent)" }}
                    >
                      <Pause size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlay(track)}
                      className="group-hover:hidden"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: rankStyle || "var(--text-secondary)",
                      }}
                    >
                      {i + 1}
                    </button>
                  )}
                  {!(active && isPlaying) && (
                    <button
                      onClick={() => handlePlay(track)}
                      className="hidden group-hover:inline-flex"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  )}
                </span>

                {/* 封面 */}
                <div
                  className="shrink-0 overflow-hidden rounded-md"
                  style={{
                    width: 44,
                    height: 44,
                    background: "rgba(128,128,128,0.15)",
                  }}
                >
                  <CoverImage
                    src={track.cover}
                    alt={track.title}
                    className="h-full w-full object-cover"
                    iconSize={20}
                  />
                </div>

                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="truncate text-sm font-medium"
                      style={{
                        color: active
                          ? "var(--accent)"
                          : "var(--text-primary)",
                      }}
                    >
                      {track.title}
                    </span>
                    <SourceIcon source={track.source} size={11} />
                  </div>
                  <div
                    className="truncate text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {track.artist}
                  </div>
                </div>

                {/* 时长 */}
                <span
                  className="hidden text-xs tabular-nums sm:block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatTime(track.duration)}
                </span>

                {/* 展开按钮 */}
                <button
                  onClick={() => {
                    handlePlay(track);
                    showNowPlaying(true);
                  }}
                  className="p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    color: "var(--text-secondary)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  aria-label="展开"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Charts() {
  const [sections, setSections] = useState<ChartSection[]>([]);
  const [loading, setLoading] = useState(true);
  const jamendoClientId = useAppStore((s) => s.settings.jamendoClientId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCharts(jamendoClientId);
      setSections(data);
    } catch {
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [jamendoClientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      {/* 头部 */}
      <section className="animate-enter animate-enter-1">
        <div
          className="solid-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6"
          style={{
            background: `linear-gradient(135deg, var(--accent-soft), transparent 70%)`,
          }}
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-2xl shadow-md"
            style={{
              width: 80,
              height: 80,
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            <TrendingUp size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              排行榜
            </div>
            <h1
              className="text-xl font-bold tracking-tight md:text-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              音乐榜单
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              各来源热门趋势 · 实时更新
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-transform active:scale-95 md:self-start"
            style={{
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-primary)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            刷新
          </button>
        </div>
      </section>

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Disc3
            size={40}
            style={{
              color: "var(--text-secondary)",
              animation: "spin-slow 2s linear infinite",
            }}
          />
        </div>
      )}

      {/* 榜单分区 */}
      {!loading && sections.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sections.map((section, i) => (
            <ChartSectionView key={section.title} section={section} index={i} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && sections.length === 0 && (
        <div className="solid-card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TrendingUp
            size={48}
            style={{ color: "var(--text-secondary)", opacity: 0.5 }}
          />
          <p
            className="text-base font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            暂时无法获取榜单
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            请检查网络连接后刷新重试
          </p>
        </div>
      )}
    </div>
  );
}
