import {
  Download,
  DownloadCloud,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Pause,
  Trash2,
  Music2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { SourceIcon } from "@/components/common/SourceIcon";
import { CoverImage } from "@/components/common/CoverImage";
import { formatTime } from "@/utils/formatTime";
import type { DownloadItem } from "@/types";

/** 状态徽标 */
function StatusBadge({ item }: { item: DownloadItem }) {
  if (item.status === "downloading") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Loader2 size={10} className="animate-spin" />
        {Math.round(item.progress * 100)}%
      </span>
    );
  }
  if (item.status === "completed") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}
      >
        <CheckCircle2 size={10} />
        已完成
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: "rgba(255,69,58,0.12)", color: "#ff453a" }}
    >
      <XCircle size={10} />
      失败
    </span>
  );
}

export default function Downloads() {
  const downloads = useAppStore((s) => s.downloads);
  const clearDownloads = useAppStore((s) => s.clearDownloads);
  const removeDownload = useAppStore((s) => s.removeDownload);
  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const playTrack = useAppStore((s) => s.playTrack);
  const togglePlay = useAppStore((s) => s.togglePlay);

  const downloading = downloads.filter((d) => d.status === "downloading");
  const completed = downloads.filter((d) => d.status === "completed");
  const failed = downloads.filter((d) => d.status === "failed");

  const handlePlay = (item: DownloadItem) => {
    if (currentTrack?.id === item.track.id) {
      togglePlay();
    } else {
      playTrack(item.track, downloads.map((d) => d.track));
    }
  };

  const summary = [
    { label: "下载中", count: downloading.length, color: "var(--accent)" },
    { label: "已完成", count: completed.length, color: "#4ade80" },
    { label: "失败", count: failed.length, color: "#ff453a" },
  ];

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
            <DownloadCloud size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              下载管理
            </div>
            <h1
              className="text-xl font-bold tracking-tight md:text-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              下载管理
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              各来源下载记录与进度
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {summary.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{ color: s.color }}
                  >
                    {s.count}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {downloads.length > 0 && (
            <button
              onClick={clearDownloads}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-transform active:scale-95 md:self-start"
              style={{
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <Trash2 size={12} />
              清空列表
            </button>
          )}
        </div>
      </section>

      {/* 提示 */}
      <section className="animate-enter animate-enter-2">
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs"
          style={{
            background: "var(--accent-soft)",
            color: "var(--text-secondary)",
          }}
        >
          <Download size={14} style={{ color: "var(--accent)" }} />
          <span>
            播放 osu! 谱面时，应用会自动后台下载 .osz
            文件并提取完整音频，下载记录会显示在此处。
          </span>
        </div>
      </section>

      {/* 下载列表 */}
      {downloads.length === 0 ? (
        <section className="animate-enter animate-enter-2">
          <div className="solid-card flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Music2
              size={48}
              style={{ color: "var(--text-secondary)", opacity: 0.5 }}
            />
            <p
              className="text-base font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              暂无下载记录
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              播放 osu! 谱面后，下载会自动出现在这里
            </p>
          </div>
        </section>
      ) : (
        <section className="animate-enter animate-enter-2">
          <div className="solid-card p-3 md:p-5">
            <div className="flex flex-col">
              {downloads.map((item, i) => {
                const active = currentTrack?.id === item.track.id;
                const canPlay =
                  item.status === "completed" || item.status === "downloading";
                return (
                  <div
                    key={item.track.id}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    {/* 序号 / 播放按钮 */}
                    <span className="w-6 shrink-0 text-center">
                      {canPlay ? (
                        <button
                          onClick={() => handlePlay(item)}
                          style={{
                            color: active
                              ? "var(--accent)"
                              : "var(--text-primary)",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          aria-label="播放"
                        >
                          {active && isPlaying ? (
                            <Pause size={14} fill="currentColor" />
                          ) : (
                            <Play size={14} fill="currentColor" />
                          )}
                        </button>
                      ) : (
                        <span
                          className="text-xs tabular-nums"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {i + 1}
                        </span>
                      )}
                    </span>

                    {/* 封面 */}
                    <div
                      className="shrink-0 overflow-hidden rounded-md"
                      style={{
                        width: 40,
                        height: 40,
                        background: "rgba(128,128,128,0.15)",
                      }}
                    >
                      <CoverImage
                        src={item.track.cover}
                        alt={item.track.title}
                        className="h-full w-full object-cover"
                        iconSize={18}
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
                          {item.track.title}
                        </span>
                        <SourceIcon source={item.track.source} size={11} />
                        <StatusBadge item={item} />
                      </div>
                      <div
                        className="truncate text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {item.track.artist}
                        {item.track.source === "osu" &&
                          ` · 镜像: ${item.mirror === "sayobot" ? "Sayobot" : "osu.direct"}`}
                      </div>

                      {/* 下载进度条 */}
                      {item.status === "downloading" && (
                        <div
                          className="mt-1.5 h-1 w-full overflow-hidden rounded-full"
                          style={{ background: "var(--surface-elevated)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round(item.progress * 100)}%`,
                              background: "var(--accent)",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 时长 */}
                    <span
                      className="hidden text-xs tabular-nums sm:block"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatTime(item.track.duration)}
                    </span>

                    {/* 删除 */}
                    <button
                      onClick={() => removeDownload(item.track.id)}
                      className="p-2 opacity-0 transition-opacity hover:text-[var(--accent)] group-hover:opacity-100"
                      style={{
                        color: "var(--text-secondary)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                      aria-label="移除"
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
