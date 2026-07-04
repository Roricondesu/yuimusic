import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Disc3, Play, Pause, ListPlus, Heart, Check } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { GlassButton } from "@/components/glass/GlassButton";
import { formatTime } from "@/utils/formatTime";
import { SourceIcon } from "@/components/common/SourceIcon";
import { CoverImage } from "@/components/common/CoverImage";
import type { Track, AppSettings } from "@/types";

const GENRES = ["流行", "摇滚", "嘻哈", "电子", "R&B", "爵士", "古典", "独立音乐"];

const SOURCE_TABS: { key: AppSettings["preferredSource"]; label: string }[] = [
  { key: "mixed", label: "全部来源" },
  { key: "audius", label: "Audius" },
  { key: "jamendo", label: "Jamendo" },
  { key: "osu", label: "osu!" },
  { key: "qq", label: "QQ 音乐" },
  { key: "itunes", label: "iTunes" },
];

export default function Library() {
  const tracks = useAppStore((s) => s.library.tracks);
  const loading = useAppStore((s) => s.library.loading);
  const error = useAppStore((s) => s.library.error);
  const source = useAppStore((s) => s.library.source);
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const playTrack = useAppStore((s) => s.playTrack);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const searchTracks = useAppStore((s) => s.searchTracks);
  const setLibrarySource = useAppStore((s) => s.setLibrarySource);
  const theme = useAppStore((s) => s.settings.theme);
  const defaultQuery = useAppStore((s) => s.settings.defaultQuery);
  const scheme = theme === "dark" ? "dark" : "light";

  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const playlists = useAppStore((s) => s.player.playlists);
  const addToPlaylist = useAppStore((s) => s.addToPlaylist);
  const isTrackInPlaylist = useAppStore((s) => s.isTrackInPlaylist);

  const [query, setQuery] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const handleGridMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    cardRefs.current.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--mouse-x", `${x}%`);
      card.style.setProperty("--mouse-y", `${y}%`);
      card.classList.add("glow-active");
    });
  }, []);

  const handleGridMouseLeave = useCallback(() => {
    cardRefs.current.forEach((card) => {
      card.classList.remove("glow-active");
    });
  }, []);

  useEffect(() => {
    if (tracks.length === 0 && !loading) {
      searchTracks(defaultQuery || "pop");
    }
  }, []);

  const handleSearch = useCallback(() => {
    setActiveGenre(null);
    searchTracks(query);
  }, [query, searchTracks]);

  const handleGenre = (genre: string) => {
    setQuery(genre);
    setActiveGenre(genre);
    searchTracks(genre);
  };

  const handlePlay = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracks);
    }
  };

  const handleAddToPlaylist = (playlistId: string, track: Track) => {
    addToPlaylist(playlistId, track);
    setMenuFor(null);
  };

  const previewCount = tracks.filter((t) => t.preview).length;
  const fullCount = tracks.length - previewCount;

  const countText = loading
    ? "正在搜索…"
    : tracks.length > 0
      ? `共 ${tracks.length} 首 · 完整 ${fullCount} · 试听 ${previewCount}`
      : "搜索 Audius、iTunes、Jamendo 与 osu! 音乐";

  return (
    <div className="flex flex-col gap-5">
      <section className="animate-enter animate-enter-1">
        <div className="solid-card p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight md:text-2xl" style={{ color: "var(--text-primary)" }}>
                浏览曲库
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {countText}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-full px-3 py-2"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
              >
                <Search size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="搜索歌曲、歌手…"
                  className="w-full bg-transparent text-sm outline-none md:w-56"
                  style={{ color: "var(--text-primary)", border: "none", padding: 0 }}
                />
              </div>
              <GlassButton scheme={scheme} onClick={handleSearch}>
                搜索
              </GlassButton>
            </div>
          </div>

          {/* 来源切换 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              来源：
            </span>
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setLibrarySource(tab.key)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-transform active:scale-95"
                style={{
                  border: "1px solid",
                  borderColor: source === tab.key ? "var(--accent)" : "var(--border)",
                  color: source === tab.key ? "var(--accent)" : "var(--text-primary)",
                  background: source === tab.key ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 流派 */}
          <div className="mt-3 flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenre(genre)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-transform active:scale-95"
                style={{
                  border: "1px solid",
                  borderColor: activeGenre === genre ? "var(--accent)" : "var(--border)",
                  color: activeGenre === genre ? "var(--accent)" : "var(--text-primary)",
                  background: activeGenre === genre ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                }}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="solid-card p-4 text-sm" style={{ color: "#ff453a", background: "rgba(255,69,58,0.08)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-enter flex items-center justify-center py-16">
          <Disc3
            size={40}
            style={{ color: "var(--text-secondary)", animation: "spin-slow 2s linear infinite" }}
          />
        </div>
      ) : (
        <section
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onMouseMove={handleGridMouseMove}
          onMouseLeave={handleGridMouseLeave}
        >
          {tracks.map((track, i) => {
            const active = currentTrack?.id === track.id;
            const liked = isFavorite(track.id);
            return (
              <div
                key={track.id}
                ref={setCardRef(track.id)}
                className="solid-card glow-card group relative text-left transition-transform hover:-translate-y-0.5"
                style={{
                  border: "none",
                  padding: 0,
                  animation: `stagger-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both`,
                  animationDelay: `${0.06 + i * 0.03}s`,
                }}
              >
                <button
                  onClick={() => handlePlay(track)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}
                >
                  <div className="relative shrink-0 overflow-hidden rounded-xl" style={{ width: 64, height: 64 }}>
                    <CoverImage
                      src={track.cover}
                      alt={track.title}
                      className="h-full w-full object-cover"
                      iconSize={28}
                    />
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
                        {isPlaying ? <Pause size={22} color="#fff" fill="#fff" /> : <Play size={22} color="#fff" fill="#fff" />}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                        {track.title}
                      </span>
                      <SourceIcon source={track.source} size={10} />
                    </div>
                    <div className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                      {track.artist}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      <span className="truncate">{track.album}</span>
                      <span>·</span>
                      <span>{formatTime(track.duration)}</span>
                    </div>
                  </div>

                  {/* 操作按钮：小屏默认显示，桌面端悬浮显示 */}
                  <div className="flex items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(track);
                      }}
                      className="rounded-full p-1.5"
                      style={{
                        border: "none",
                        background: "rgba(0,0,0,0.3)",
                        color: liked ? "#ff375f" : "#fff",
                        cursor: "pointer",
                        backdropFilter: "blur(8px)",
                      }}
                      aria-label="收藏"
                    >
                      <Heart size={14} fill={liked ? "currentColor" : "none"} />
                    </button>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === track.id ? null : track.id);
                        }}
                        className="rounded-full p-1.5"
                        style={{
                          border: "none",
                          background: "rgba(0,0,0,0.3)",
                          color: "#fff",
                          cursor: "pointer",
                          backdropFilter: "blur(8px)",
                        }}
                        aria-label="加入歌单"
                      >
                        <ListPlus size={14} />
                      </button>
                      {menuFor === track.id && (
                        <div
                          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl py-1 shadow-2xl"
                          style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                        >
                          {playlists.length === 0 ? (
                            <div className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                              还没有歌单
                            </div>
                          ) : (
                            playlists.map((pl) => {
                              const inList = isTrackInPlaylist(pl.id, track.id);
                              return (
                                <button
                                  key={pl.id}
                                  onClick={() => handleAddToPlaylist(pl.id, track)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
                                  style={{ border: "none", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}
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
                  </div>
                </button>
              </div>
            );
          })}
        </section>
      )}

      {!loading && tracks.length === 0 && !error && (
        <div className="animate-enter flex flex-col items-center justify-center gap-3 py-16">
          <Search size={40} style={{ color: "var(--text-secondary)" }} />
          <p style={{ color: "var(--text-secondary)" }}>搜索音乐开始播放</p>
        </div>
      )}
    </div>
  );
}
