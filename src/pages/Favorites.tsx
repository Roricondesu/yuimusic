import { Heart, Play, Pause, Trash2, Music2, ListPlus, Check } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { formatTime } from "../utils/formatTime";
import { SourceIcon } from "../components/common/SourceIcon";
import { CoverImage } from "../components/common/CoverImage";
import type { Track } from "../types";

export default function Favorites() {
  const favorites = useAppStore((s) => s.player.favorites);
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const playTrack = useAppStore((s) => s.playTrack);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const playlists = useAppStore((s) => s.player.playlists);
  const addToPlaylist = useAppStore((s) => s.addToPlaylist);
  const isTrackInPlaylist = useAppStore((s) => s.isTrackInPlaylist);

  const [menuFor, setMenuFor] = useState<string | null>(null);

  const handlePlay = (trackId: string) => {
    const track = favorites.find((t) => t.id === trackId);
    if (!track) return;
    if (currentTrack?.id === trackId) {
      togglePlay();
    } else {
      playTrack(track, favorites);
    }
  };

  const handlePlayAll = () => {
    if (favorites.length === 0) return;
    playTrack(favorites[0], favorites);
  };

  const handleAddToPlaylist = (playlistId: string, track: Track) => {
    addToPlaylist(playlistId, track);
    setMenuFor(null);
  };

  const totalDuration = favorites.reduce((acc, t) => acc + t.duration, 0);
  const previewCount = favorites.filter((t) => t.preview).length;

  return (
    <div className="flex flex-col gap-5">
      {/* 头部 */}
      <section className="animate-enter animate-enter-1">
        <div
          className="solid-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6"
          style={{
            background: `linear-gradient(135deg, rgba(255,59,80,0.12), transparent 70%)`,
          }}
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-2xl shadow-md"
            style={{
              width: 80,
              height: 80,
              background: "rgba(255,59,80,0.15)",
              color: "#ff3b50",
            }}
          >
            <Heart size={36} fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              歌单
            </div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl" style={{ color: "var(--text-primary)" }}>
              我喜欢的音乐
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {favorites.length} 首歌曲 · {Math.round(totalDuration / 60)} 分钟
              {previewCount > 0 && ` · 含 ${previewCount} 首试听`}
            </p>
          </div>
          {favorites.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-transform hover:scale-105 active:scale-95 md:self-start"
              style={{ border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}
            >
              <Play size={16} fill="currentColor" />
              播放全部
            </button>
          )}
        </div>
      </section>

      {favorites.length === 0 ? (
        <section className="animate-enter animate-enter-2">
          <div className="solid-card flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Music2 size={48} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
            <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
              还没有收藏的歌曲
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              点击歌曲旁的心形图标即可收藏
            </p>
          </div>
        </section>
      ) : (
        <section className="animate-enter animate-enter-2">
          <div className="solid-card p-3 md:p-5">
            <div className="flex flex-col">
              {favorites.map((track, i) => {
                const active = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span
                      className="w-6 text-center text-xs tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {active && isPlaying ? (
                        <button onClick={() => handlePlay(track.id)} style={{ color: "var(--accent)" }}>
                          <Pause size={14} fill="currentColor" />
                        </button>
                      ) : (
                        <span className="group-hover:hidden">{i + 1}</span>
                      )}
                      {!active || !isPlaying ? (
                        <button
                          onClick={() => handlePlay(track.id)}
                          className="hidden group-hover:inline-flex"
                          style={{ color: "var(--text-primary)" }}
                        >
                          <Play size={14} fill="currentColor" />
                        </button>
                      ) : null}
                    </span>

                    <div
                      className="shrink-0 overflow-hidden rounded-md"
                      style={{ width: 40, height: 40, background: "rgba(128,128,128,0.15)" }}
                    >
                      <CoverImage src={track.cover} alt={track.title} className="h-full w-full object-cover" iconSize={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="truncate text-sm font-medium"
                          style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}
                        >
                          {track.title}
                        </span>
                        <SourceIcon source={track.source} size={11} />
                      </div>
                      <div className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                        {track.artist}
                      </div>
                    </div>

                    {/* 加入歌单 */}
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setMenuFor(menuFor === track.id ? null : track.id)}
                        className="p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: "var(--text-secondary)", border: "none", background: "transparent", cursor: "pointer" }}
                        aria-label="加入歌单"
                      >
                        <ListPlus size={16} />
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

                    <span className="hidden text-xs sm:block" style={{ color: "var(--text-secondary)" }}>
                      {formatTime(track.duration)}
                    </span>

                    <button
                      onClick={() => toggleFavorite(track)}
                      className="p-2 transition-colors hover:text-[var(--accent)]"
                      style={{ color: "#ff3b50", border: "none", background: "transparent", cursor: "pointer" }}
                      aria-label="取消收藏"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
