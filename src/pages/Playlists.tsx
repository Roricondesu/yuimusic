import { useState } from "react";
import {
  ListMusic,
  Plus,
  Play,
  Pause,
  Trash2,
  ChevronLeft,
  Music2,
  Clock,
  MoreVertical,
  X,
  DownloadCloud,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { formatTime } from "../utils/formatTime";
import { SourceIcon } from "../components/common/SourceIcon";
import { CoverImage } from "../components/common/CoverImage";
import type { Playlist, Track } from "../types";

const PALETTE = ["#0a84ff", "#bf5af2", "#ff375f", "#ff9f0a", "#30d158", "#5e5ce6"];

export default function Playlists() {
  const playlists = useAppStore((s) => s.player.playlists);
  const openPlaylistId = useAppStore((s) => s.openPlaylistId);
  const setOpenPlaylist = useAppStore((s) => s.setOpenPlaylist);
  const createPlaylist = useAppStore((s) => s.createPlaylist);
  const deletePlaylist = useAppStore((s) => s.deletePlaylist);
  const renamePlaylist = useAppStore((s) => s.renamePlaylist);
  const removeFromPlaylist = useAppStore((s) => s.removeFromPlaylist);
  const playPlaylist = useAppStore((s) => s.playPlaylist);
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const playTrack = useAppStore((s) => s.playTrack);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const downloadedTracks = useAppStore((s) => s.player.downloadedTracks);
  const removeDownloadedTrack = useAppStore((s) => s.removeDownloadedTrack);
  const downloadTrack = useAppStore((s) => s.downloadTrack);
  const isDownloaded = useAppStore((s) => s.isDownloaded);
  const downloadProgress = useAppStore((s) => s.player.downloadProgress);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const open = playlists.find((p) => p.id === openPlaylistId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createPlaylist(newName, "", newColor);
    setNewName("");
    setNewColor(PALETTE[0]);
    setCreating(false);
    setOpenPlaylist(id);
  };

  const handlePlayTrack = (track: Track, pl: Playlist) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, pl.tracks);
    }
  };

  // === 详情视图 ===
  if (open) {
    const totalDuration = open.tracks.reduce((acc, t) => acc + t.duration, 0);
    return (
      <div key={open.id} className="slide-in-right flex flex-col gap-5">
        <section className="animate-enter animate-enter-1">
          <button
            onClick={() => setOpenPlaylist(null)}
            className="mb-3 flex items-center gap-1 text-sm font-medium"
            style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
          >
            <ChevronLeft size={16} />
            返回歌单
          </button>

          <div className="solid-card overflow-hidden" style={{ padding: 0 }}>
            <div
              className="flex flex-col gap-5 p-6 md:flex-row md:items-end"
              style={{
                background: `linear-gradient(135deg, ${open.color || "var(--accent)"}22, transparent 70%)`,
              }}
            >
              <div
            className="flex shrink-0 items-center justify-center rounded-2xl shadow-lg"
            style={{
              width: 120,
              height: 120,
              background: open.color || "var(--accent)",
              color: "#fff",
            }}
          >
            <ListMusic size={48} />
          </div>
          <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                  歌单
                </div>
                {renaming === open.id ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renamePlaylist(open.id, renameValue);
                          setRenaming(null);
                        } else if (e.key === "Escape") {
                          setRenaming(null);
                        }
                      }}
                      className="rounded-lg px-2 py-1 text-2xl font-bold"
                      style={{
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <button
                      onClick={() => {
                        renamePlaylist(open.id, renameValue);
                        setRenaming(null);
                      }}
                      className="text-xs font-medium"
                      style={{ border: "none", background: "transparent", color: "var(--accent)" }}
                    >
                      确定
                    </button>
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold tracking-tight md:text-4xl" style={{ color: "var(--text-primary)" }}>
                    {open.name}
                  </h1>
                )}
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {open.tracks.length} 首歌曲 · {Math.round(totalDuration / 60)} 分钟
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => playPlaylist(open, 0)}
                    disabled={open.tracks.length === 0}
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
                    style={{ border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}
                  >
                    <Play size={16} fill="currentColor" />
                    播放全部
                  </button>
                  <button
                    onClick={() => setRenaming(open.id)}
                    className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--surface-elevated)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    重命名
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`删除歌单「${open.name}」？`)) {
                        deletePlaylist(open.id);
                      }
                    }}
                    className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--surface-elevated)",
                      color: "#ff453a",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="animate-enter animate-enter-2">
          {open.tracks.length === 0 ? (
            <div className="solid-card flex flex-col items-center justify-center gap-3 p-12 text-center">
              <Music2 size={48} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
              <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
                歌单还是空的
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                去曲库把喜欢的歌曲添加进来吧
              </p>
            </div>
          ) : (
            <div className="solid-card p-3 md:p-5">
              <div className="flex flex-col">
                {open.tracks.map((track, i) => {
                  const active = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <span className="w-6 text-center text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {active && isPlaying ? (
                          <button onClick={() => handlePlayTrack(track, open)} style={{ color: "var(--accent)" }}>
                            <Pause size={14} fill="currentColor" />
                          </button>
                        ) : (
                          <>
                            <span className="group-hover:hidden">{i + 1}</span>
                            <button
                              onClick={() => handlePlayTrack(track, open)}
                              className="hidden group-hover:inline-flex"
                              style={{ color: "var(--text-primary)" }}
                            >
                              <Play size={14} fill="currentColor" />
                            </button>
                          </>
                        )}
                      </span>

                      <div className="shrink-0 overflow-hidden rounded-md" style={{ width: 40, height: 40, background: "rgba(128,128,128,0.15)" }}>
                        <CoverImage src={track.cover} alt={track.title} className="h-full w-full object-cover" iconSize={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                            {track.title}
                          </span>
                          <SourceIcon source={track.source} size={11} />
                        </div>
                        <div className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                          {track.artist}
                        </div>
                      </div>

                      <span className="hidden text-xs sm:block" style={{ color: "var(--text-secondary)" }}>
                        {formatTime(track.duration)}
                      </span>

                      <button
                        onClick={() => removeFromPlaylist(open.id, track.id)}
                        className="p-2 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: "#ff453a", border: "none", background: "transparent", cursor: "pointer" }}
                        aria-label="从歌单移除"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  // === 列表视图 ===
  return (
    <div className="flex flex-col gap-5">
      <section className="animate-enter animate-enter-1">
        <div className="solid-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6">
          <div
            className="flex shrink-0 items-center justify-center rounded-2xl shadow-md"
            style={{
              width: 80,
              height: 80,
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            <ListMusic size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              歌单
            </div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl" style={{ color: "var(--text-primary)" }}>
              我的歌单
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {playlists.length} 个歌单
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-transform hover:scale-105 active:scale-95 md:self-start"
            style={{ border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}
          >
            <Plus size={16} />
            新建
          </button>
        </div>
      </section>

      {creating && (
        <section className="animate-enter animate-enter-2">
          <div className="solid-card p-5">
            <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              创建新歌单
            </h2>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="歌单名称"
              className="mb-4 w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <div className="mb-4">
              <div className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                封面颜色
              </div>
              <div className="flex gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="transition-transform hover:scale-110"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: c,
                      border: newColor === c ? "3px solid var(--text-primary)" : "3px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
                style={{ border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}
              >
                创建
              </button>
              <button
                onClick={() => setCreating(false)}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
                style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}
              >
                取消
              </button>
            </div>
          </div>
        </section>
      )}

      {downloadedTracks.length > 0 && (
        <section className="animate-enter animate-enter-2">
          <div className="solid-card p-3 md:p-5">
            <div className="mb-3 flex items-center gap-2 px-2">
              <DownloadCloud size={18} style={{ color: "var(--accent)" }} />
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                已下载音乐
              </h2>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {downloadedTracks.length} 首
              </span>
            </div>
            <div className="flex flex-col">
              {downloadedTracks.slice(0, 10).map((track) => {
                const active = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, downloadedTracks)}
                    className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <div
                      className="shrink-0 overflow-hidden rounded-md"
                      style={{ width: 40, height: 40, background: "rgba(128,128,128,0.15)" }}
                    >
                      <CoverImage
                        src={track.cover}
                        alt={track.title}
                        className="h-full w-full object-cover"
                        iconSize={18}
                      />
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
                    <span
                      className="hidden text-xs tabular-nums sm:block"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatTime(track.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDownloadedTrack(track.id);
                      }}
                      className="p-2 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "#ff453a", border: "none", background: "transparent", cursor: "pointer" }}
                      aria-label="删除下载"
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

      {playlists.length === 0 && !creating ? (
        <section className="animate-enter animate-enter-2">
          <div className="solid-card flex flex-col items-center justify-center gap-3 p-12 text-center">
            <ListMusic size={48} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
            <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
              还没有歌单
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              点击右上角「新建」创建你的第一个歌单
            </p>
          </div>
        </section>
      ) : (
        <section className="animate-enter animate-enter-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((pl, i) => (
              <div
                key={pl.id}
                className="solid-card group relative cursor-pointer overflow-hidden transition-transform hover:-translate-y-1"
                style={{ padding: 0, animation: `stagger-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${0.06 + i * 0.04}s` }}
                onClick={() => setOpenPlaylist(pl.id)}
              >
                <div
                  className="flex items-center gap-4 p-4"
                  style={{ background: `linear-gradient(135deg, ${pl.color || "var(--accent)"}22, transparent 80%)` }}
                >
                  <div
                    className="flex shrink-0 items-center justify-center rounded-xl shadow-md"
                    style={{ width: 72, height: 72, background: pl.color || "var(--accent)", color: "#fff" }}
                  >
                    <ListMusic size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                      {pl.name}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <Music2 size={12} />
                      {pl.tracks.length} 首
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 pb-3">
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Clock size={11} />
                    {new Date(pl.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPlaylist(pl, 0);
                    }}
                    disabled={pl.tracks.length === 0}
                    className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40"
                    style={{ border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}
                  >
                    <Play size={12} fill="currentColor" />
                    播放
                  </button>
                </div>
                {/* 删除菜单 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(menuFor === pl.id ? null : pl.id);
                  }}
                  className="absolute right-2 top-2 rounded-full p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "rgba(0,0,0,0.2)", color: "#fff", border: "none", cursor: "pointer" }}
                >
                  <MoreVertical size={14} />
                </button>
                {menuFor === pl.id && (
                  <div
                    className="absolute right-2 top-9 z-10 rounded-lg py-1 shadow-xl"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        if (confirm(`删除歌单「${pl.name}」？`)) deletePlaylist(pl.id);
                        setMenuFor(null);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium"
                      style={{ border: "none", background: "transparent", color: "#ff453a", cursor: "pointer" }}
                    >
                      <Trash2 size={12} />
                      删除歌单
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
