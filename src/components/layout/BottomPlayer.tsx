import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ChevronUp,
  ListPlus,
  Check,
  Music,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { GlassCard } from "../glass/GlassCard";
import { SeekBar } from "./SeekBar";
import { SourceIcon } from "../common/SourceIcon";
import { CoverImage } from "../common/CoverImage";
import { formatTime } from "../../utils/formatTime";

export const BottomPlayer: React.FC = () => {
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const progress = useAppStore((s) => s.player.progress);
  const currentTime = useAppStore((s) => s.player.currentTime);
  const duration = useAppStore((s) => s.player.duration);
  const volume = useAppStore((s) => s.player.volume);
  const shuffle = useAppStore((s) => s.player.shuffle);
  const repeat = useAppStore((s) => s.player.repeat);
  const theme = useAppStore((s) => s.settings.theme);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const nextTrack = useAppStore((s) => s.nextTrack);
  const prevTrack = useAppStore((s) => s.prevTrack);
  const seekTo = useAppStore((s) => s.seekTo);
  const setVolume = useAppStore((s) => s.setVolume);
  const toggleShuffle = useAppStore((s) => s.toggleShuffle);
  const cycleRepeat = useAppStore((s) => s.cycleRepeat);
  const showNowPlaying = useAppStore((s) => s.showNowPlaying);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const playlists = useAppStore((s) => s.player.playlists);
  const addToPlaylist = useAppStore((s) => s.addToPlaylist);
  const isTrackInPlaylist = useAppStore((s) => s.isTrackInPlaylist);

  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);

  const scheme = theme === "dark" ? "dark" : "light";
  const isDark = scheme === "dark";
  const hasTrack = !!currentTrack;
  const displayDuration = duration || currentTrack?.duration || 0;
  const isMuted = volume === 0;
  const liked = currentTrack ? isFavorite(currentTrack.id) : false;

  const iconBtn = (active?: boolean): React.CSSProperties => ({
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
  });

  const handleAddToPlaylist = (playlistId: string) => {
    if (currentTrack) addToPlaylist(playlistId, currentTrack);
    setShowPlaylistMenu(false);
  };

  /* 无歌曲时的紧凑提示 */
  const EmptyState = () => (
    <div className="flex items-center justify-center gap-3">
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{
          width: 44,
          height: 44,
          background: "rgba(128,128,128,0.15)",
        }}
      >
        <Music size={20} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
      </div>
      <div className="min-w-0">
        <div
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          未选择歌曲
        </div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          请选择歌曲开始播放
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed left-0 right-0 z-40 flex px-3 pb-3 md:px-6 md:pb-5 ${hasTrack ? "bottom-0 justify-center" : "-bottom-24 justify-start"}`}
      style={{ pointerEvents: "none", transition: "bottom 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <GlassCard
        scheme={scheme}
        style={{
          pointerEvents: "auto",
          borderRadius: 20,
          padding: hasTrack ? "12px 16px" : "10px 18px",
          width: hasTrack ? "100%" : "fit-content",
          maxWidth: hasTrack ? "min(calc(100vw - 24px), 1100px)" : "calc(100vw - 24px)",
          minWidth: hasTrack ? undefined : 200,
          transition: "padding 0.4s cubic-bezier(0.22, 1, 0.36, 1), width 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* === 桌面端 === */}
        <div className="hidden md:flex md:items-center md:justify-center">
          {hasTrack && currentTrack ? (
            <div className="flex w-full items-center gap-4">
              {/* 左：封面信息 */}
              <div
                className="flex min-w-0 items-center gap-3"
                style={{ width: 280, flexShrink: 0 }}
              >
                <div
                  className="shrink-0 overflow-hidden rounded-lg"
                  style={{
                    width: 48,
                    height: 48,
                    background: "rgba(128,128,128,0.15)",
                    cursor: "pointer",
                  }}
                  onClick={() => showNowPlaying(true)}
                >
                  <CoverImage
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                    className="h-full w-full object-cover"
                    iconSize={20}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {currentTrack.title}
                    </span>
                    <SourceIcon source={currentTrack.source} size={11} />
                  </div>
                  <div
                    className="truncate text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {currentTrack.artist}
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  <button
                    style={iconBtn()}
                    onClick={() => setShowPlaylistMenu((v) => !v)}
                    aria-label="加入歌单"
                  >
                    <ListPlus size={16} />
                  </button>
                  {showPlaylistMenu && (
                    <div
                      className="absolute bottom-full right-0 mb-2 w-48 rounded-xl py-1 shadow-2xl"
                      style={{
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {playlists.length === 0 ? (
                        <div
                          className="px-3 py-2 text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          还没有歌单
                        </div>
                      ) : (
                        playlists.map((pl) => {
                          const inList = isTrackInPlaylist(
                            pl.id,
                            currentTrack.id,
                          );
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
                              {inList && (
                                <Check size={12} style={{ color: "var(--accent)" }} />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <button
                  style={iconBtn(liked)}
                  onClick={() => toggleFavorite(currentTrack)}
                  aria-label="收藏"
                >
                  <Heart size={16} fill={liked ? "currentColor" : "none"} />
                </button>
                <button
                  style={iconBtn()}
                  onClick={() => showNowPlaying(true)}
                  aria-label="展开"
                >
                  <ChevronUp size={16} />
                </button>
              </div>

              {/* 中：控制按钮 */}
              <div
                className="flex items-center justify-center gap-1"
                style={{ flexShrink: 0 }}
              >
                <button
                  style={iconBtn(shuffle)}
                  onClick={toggleShuffle}
                  aria-label="随机播放"
                >
                  <Shuffle size={16} />
                </button>
                <button
                  style={iconBtn()}
                  onClick={prevTrack}
                  aria-label="上一首"
                >
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
                  {isPlaying ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" />
                  )}
                </button>
                <button
                  style={iconBtn()}
                  onClick={nextTrack}
                  aria-label="下一首"
                >
                  <SkipForward size={20} />
                </button>
                <button
                  style={iconBtn(repeat !== "off")}
                  onClick={cycleRepeat}
                  aria-label={`循环: ${repeat}`}
                >
                  {repeat === "one" ? (
                    <Repeat1 size={16} />
                  ) : (
                    <Repeat size={16} />
                  )}
                </button>
              </div>

              {/* 进度条 */}
              <div
                className="flex items-center gap-2"
                style={{ flex: 1, minWidth: 0 }}
              >
                <span
                  className="text-[10px] tabular-nums"
                  style={{
                    color: "var(--text-secondary)",
                    width: 32,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {formatTime(currentTime)}
                </span>
                <SeekBar
                  progress={progress}
                  onSeek={seekTo}
                  scheme={scheme}
                />
                <span
                  className="text-[10px] tabular-nums"
                  style={{
                    color: "var(--text-secondary)",
                    width: 32,
                    flexShrink: 0,
                  }}
                >
                  {formatTime(displayDuration)}
                </span>
              </div>

              {/* 右：音量 */}
              <div
                className="flex items-center gap-1"
                style={{
                  width: 130,
                  flexShrink: 0,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  style={iconBtn(isMuted)}
                  onClick={() => setVolume(isMuted ? 0.8 : 0)}
                  aria-label={isMuted ? "取消静音" : "静音"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div style={{ width: 90 }}>
                  <SeekBar
                    progress={volume}
                    onSeek={setVolume}
                    scheme={scheme}
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>

        {/* === 移动端 === */}
        <div className="flex flex-col md:hidden">
          {hasTrack && currentTrack ? (
            <div className="flex flex-col gap-2">
              <div
                className="flex items-center gap-2"
                style={{ justifyContent: "space-between" }}
              >
                <div
                  className="shrink-0 overflow-hidden rounded-lg"
                  style={{
                    width: 40,
                    height: 40,
                    background: "rgba(128,128,128,0.15)",
                    cursor: "pointer",
                  }}
                  onClick={() => showNowPlaying(true)}
                >
                  <CoverImage
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                    className="h-full w-full object-cover"
                    iconSize={20}
                  />
                </div>
                <div className="min-w-0 flex-1" style={{ minWidth: 80 }}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {currentTrack.title}
                    </span>
                    <SourceIcon source={currentTrack.source} size={11} />
                  </div>
                  <div
                    className="truncate text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {currentTrack.artist}
                  </div>
                </div>
                <div
                  className="flex items-center gap-1"
                  style={{ flexShrink: 0 }}
                >
                  <button
                    style={iconBtn()}
                    onClick={prevTrack}
                    aria-label="上一首"
                  >
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
                    {isPlaying ? (
                      <Pause size={18} fill="currentColor" />
                    ) : (
                      <Play size={18} fill="currentColor" />
                    )}
                  </button>
                  <button
                    style={iconBtn()}
                    onClick={nextTrack}
                    aria-label="下一首"
                  >
                    <SkipForward size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] tabular-nums"
                  style={{
                    color: "var(--text-secondary)",
                    width: 28,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {formatTime(currentTime)}
                </span>
                <SeekBar
                  progress={progress}
                  onSeek={seekTo}
                  scheme={scheme}
                />
                <span
                  className="text-[10px] tabular-nums"
                  style={{
                    color: "var(--text-secondary)",
                    width: 28,
                    flexShrink: 0,
                  }}
                >
                  {formatTime(displayDuration)}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </GlassCard>
    </div>
  );
};
