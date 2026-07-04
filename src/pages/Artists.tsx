import { useState, useCallback, useEffect, useRef } from "react";
import {
  Mic2,
  Search,
  Disc3,
  Play,
  Pause,
  ChevronRight,
  Users,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { SourceIcon } from "@/components/common/SourceIcon";
import { CoverImage } from "@/components/common/CoverImage";
import { formatTime } from "@/utils/formatTime";
import { searchTracks } from "@/utils/musicSources";
import { mergeSameTracks } from "@/utils/musicSources";
import type { Track } from "@/types";

/** 热门歌手快捷入口（按语言分组） */
const HOT_ARTISTS: { lang: string; artists: string[] }[] = [
  { lang: "华语", artists: ["周杰伦", "邓紫棋", "陈奕迅", "林俊杰", "王菲", "薛之谦"] },
  { lang: "欧美", artists: ["Taylor Swift", "Ed Sheeran", "Adele", "Drake", "The Weeknd", "Billie Eilish"] },
  { lang: "日语", artists: ["YOASOBI", "米津玄師", "ONE OK ROCK", "Aimer", "LiSA", "Official髭男dism"] },
  { lang: "韩语", artists: ["BTS", "BLACKPINK", "IU", "TWICE", "EXO", "Stray Kids"] },
];

export default function Artists() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedArtist, setSearchedArtist] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const jamendoClientId = useAppStore((s) => s.settings.jamendoClientId);
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const playTrack = useAppStore((s) => s.playTrack);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const showNowPlaying = useAppStore((s) => s.showNowPlaying);

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setSearchedArtist(term.trim());
    try {
      const { tracks } = await searchTracks(term.trim(), "mixed", 40, jamendoClientId);
      // 同曲目多来源合并，避免同一首歌重复
      setResults(mergeSameTracks(tracks));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [jamendoClientId]);

  // 默认载入一个热门歌手
  useEffect(() => {
    doSearch("YOASOBI");
  }, [doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handlePickArtist = (name: string) => {
    setQuery(name);
    doSearch(name);
  };

  const handlePlay = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, results);
    }
  };

  // 按专辑/来源简单归类的展示，这里直接平铺列表
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
            <Mic2 size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              歌手
            </div>
            <h1
              className="text-xl font-bold tracking-tight md:text-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              歌手查询
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              按歌手名搜索 · 跨来源聚合结果
            </p>
          </div>
        </div>
      </section>

      {/* 搜索框 */}
      <section className="animate-enter animate-enter-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-full px-4 py-2.5"
            style={{
              background: "rgba(128,128,128,0.08)",
              border: "1px solid var(--border)",
            }}
          >
            <Search size={16} style={{ color: "var(--text-secondary)" }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入歌手名…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-transform active:scale-95"
            style={{
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              cursor: loading || !query.trim() ? "not-allowed" : "pointer",
              opacity: loading || !query.trim() ? 0.5 : 1,
            }}
          >
            搜索
          </button>
        </form>
      </section>

      {/* 热门歌手快捷入口 */}
      <section className="animate-enter animate-enter-3">
        <div className="solid-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              热门歌手
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {HOT_ARTISTS.map((group) => (
              <div key={group.lang}>
                <div
                  className="mb-1.5 text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {group.lang}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.artists.map((name) => {
                    const active = searchedArtist.toLowerCase() === name.toLowerCase();
                    return (
                      <button
                        key={name}
                        onClick={() => handlePickArtist(name)}
                        className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                        style={{
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "var(--accent-soft)" : "transparent",
                          color: active ? "var(--accent)" : "var(--text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 结果标题 */}
      {searchedArtist && !loading && (
        <section className="animate-enter animate-enter-4">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {searchedArtist}
            </span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              · {results.length} 首
            </span>
          </div>
        </section>
      )}

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

      {/* 结果列表 */}
      {!loading && results.length > 0 && (
        <section className="animate-enter animate-enter-4">
          <div className="solid-card" style={{ padding: 0 }}>
            <div className="px-2 pb-2">
              {results.map((track, i) => {
                const active = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    {/* 序号 / 播放按钮 */}
                    <span
                      className="flex w-7 shrink-0 items-center justify-center text-sm font-bold tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
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
                            color: "var(--text-secondary)",
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
                            color: active ? "var(--accent)" : "var(--text-primary)",
                          }}
                        >
                          {track.title}
                        </span>
                        <SourceIcon source={track.source} size={11} />
                        {track.alternatives && track.alternatives.length > 0 && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              background: "var(--accent-soft)",
                              color: "var(--accent)",
                            }}
                          >
                            {track.alternatives.length + 1} 源
                          </span>
                        )}
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
      )}

      {/* 空状态 */}
      {!loading && results.length === 0 && searchedArtist && (
        <div className="solid-card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Mic2 size={48} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
          <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
            未找到「{searchedArtist}」的相关曲目
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            试试其他歌手名，或检查网络连接
          </p>
        </div>
      )}
    </div>
  );
}
