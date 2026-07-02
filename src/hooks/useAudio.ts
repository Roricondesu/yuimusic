import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { getOsuAudioUrl } from "../utils/musicSources";

/** 一段极短的静音 WAV，用于首次用户手势时解锁音频自动播放 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export const useAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 标记用户是否正在拖动进度条，避免 onTimeUpdate 与 seek 反馈循环 */
  const seekingRef = useRef(false);
  /** 是否已经通过用户手势解锁音频播放 */
  const unlockedRef = useRef(false);
  /** osu! blob 换源时的 loadedmetadata 监听器集合，切歌时需全部清理 */
  const osuMetaHandlersRef = useRef<Set<() => void>>(new Set());

  const currentTrack = useAppStore((s) => s.player.currentTrack);
  const isPlaying = useAppStore((s) => s.player.isPlaying);
  const volume = useAppStore((s) => s.player.volume);
  const volumeLimit = useAppStore((s) => s.settings.volumeLimit);
  const currentTime = useAppStore((s) => s.player.currentTime);
  const playbackSpeed = useAppStore((s) => s.settings.playbackSpeed);
  const monoAudio = useAppStore((s) => s.settings.monoAudio);
  const osuMirror = useAppStore((s) => s.settings.osuMirror);
  const loadTracks = useAppStore((s) => s.loadTracks);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setProgress = useAppStore((s) => s.setProgress);
  const setDuration = useAppStore((s) => s.setDuration);
  const nextTrack = useAppStore((s) => s.nextTrack);

  // 记录当前实际加载的音频 URL，避免 osu! 后台提取完成后被重新覆盖
  const actualSrcRef = useRef<string>("");
  /** 当前 osu 曲目是否已经切换成本地 blob URL（用于切歌/暂停后不再回退到 preview） */
  const osuBlobTrackIdRef = useRef<string | null>(null);
  const osuLoadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "metadata";
    }
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      if (seekingRef.current) return;
      const duration = audio.duration || 0;
      if (duration > 0) {
        setProgress(audio.currentTime / duration, audio.currentTime);
      }
    };
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => nextTrack();
    const onError = () => {
      const track = useAppStore.getState().player.currentTrack;
      // 仅当当前是 osu 曲目且 src 是 blob URL（非 preview）时回退
      if (
        track?.source === "osu" &&
        actualSrcRef.current &&
        actualSrcRef.current !== track.src &&
        !actualSrcRef.current.startsWith("blob:")
      ) {
        // 已经不是 blob 了，不处理
        return;
      }
      if (
        track?.source === "osu" &&
        actualSrcRef.current.startsWith("blob:") &&
        track.src
      ) {
        audio.src = track.src;
        audio.load();
        actualSrcRef.current = track.src;
        audio.play().catch(() => setPlaying(false));
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    // 首次用户手势时解锁音频自动播放，避免某些浏览器把 effect 里的 play() 判定为自动播放
    const unlock = async () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      const silent = new Audio(SILENT_WAV);
      silent.volume = 0;
      try {
        await silent.play();
      } catch {
        // 浏览器仍可能拒绝，忽略即可
      } finally {
        silent.pause();
      }
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [setProgress, setDuration, nextTrack, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // 切歌时清理所有待执行的 osu onMeta 监听器，避免新歌曲的 loadedmetadata 被旧回调误处理
    osuMetaHandlersRef.current.forEach((handler) =>
      audio.removeEventListener("loadedmetadata", handler),
    );
    osuMetaHandlersRef.current.clear();

    const isOsuPreview =
      currentTrack.source === "osu" &&
      currentTrack.preview &&
      currentTrack.osuSetId != null;

    if (isOsuPreview) {
      // 先用官方 preview 播放，保证即时响应。
      // 如果完整音频 blob 已经就绪（切歌/暂停后不再回退到 preview）则跳过。
      const hasBlobReady =
        osuBlobTrackIdRef.current === currentTrack.id &&
        audio.src.startsWith("blob:");
      if (!hasBlobReady && audio.src !== currentTrack.src) {
        audio.src = currentTrack.src;
        audio.load();
        actualSrcRef.current = currentTrack.src;
        osuBlobTrackIdRef.current = null;
      }
      // 后台下载 .osz 并解压提取完整音频
      if (!osuLoadingRef.current.has(currentTrack.id)) {
        osuLoadingRef.current.add(currentTrack.id);
        useAppStore.setState((s) => ({
          player: { ...s.player, osuDownloadProgress: 0 },
        }));
        // 在下载管理中注册
        useAppStore.getState().addDownload(currentTrack, osuMirror);
        getOsuAudioUrl(
          currentTrack.osuSetId!,
          currentTrack.src,
          (ratio) => {
            useAppStore.setState((s) => ({
              player: { ...s.player, osuDownloadProgress: ratio },
            }));
            useAppStore.getState().updateDownload(currentTrack.id, ratio);
          },
          osuMirror,
        )
          .then((url) => {
            useAppStore.setState((s) => ({
              player: { ...s.player, osuDownloadProgress: -1 },
            }));
            // 根据返回 URL 判断下载是否成功
            if (url.startsWith("blob:")) {
              useAppStore.getState().completeDownload(currentTrack.id);
            } else {
              useAppStore.getState().failDownload(currentTrack.id);
            }
            const current = useAppStore.getState().player.currentTrack;
            // 仅当用户仍在听同一首 osu 曲目，且新 URL 与 preview 不同时才切换
            if (
              current?.id === currentTrack.id &&
              audioRef.current &&
              url !== currentTrack.src &&
              url.startsWith("blob:")
            ) {
              const time = audioRef.current.currentTime;
              audioRef.current.src = url;
              audioRef.current.load();
              actualSrcRef.current = url;
              osuBlobTrackIdRef.current = currentTrack.id;

              // 等 metadata 加载完成后再恢复播放进度
              const onMeta = () => {
                if (!audioRef.current) return;
                audioRef.current.removeEventListener("loadedmetadata", onMeta);
                osuMetaHandlersRef.current.delete(onMeta);
                // 如果切歌导致 src 已被覆盖，不再恢复
                if (audioRef.current.src !== url) return;
                if (isFinite(time) && time > 0) {
                  audioRef.current.currentTime = time;
                }
                // 用 store 里的播放意图判断，而不是 audio.paused：
                // 这样即使 preview 解码失败，完整音频下载完后仍能自动续播
                if (useAppStore.getState().player.isPlaying) {
                  audioRef.current.play().catch(() => setPlaying(false));
                }
              };
              osuMetaHandlersRef.current.add(onMeta);
              audioRef.current.addEventListener("loadedmetadata", onMeta);
            }
          })
          .catch(() => {
            useAppStore.getState().failDownload(currentTrack.id);
          })
          .finally(() => {
            osuLoadingRef.current.delete(currentTrack.id);
          });
      }
      if (isPlaying) {
        // preview 可能解码失败或被浏览器拦截，这里不把它视为暂停：
        // 保持 isPlaying 为 true，等完整音频 blob 就绪后由 onMeta 续播
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
      return;
    }

    // 非 osu 曲目：正常播放
    if (audio.src !== currentTrack.src) {
      audio.src = currentTrack.src;
      audio.load();
      actualSrcRef.current = currentTrack.src;
    }
    if (isPlaying) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying, setPlaying, osuMirror]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, volume * volumeLimit));
  }, [volume, volumeLimit]);

  // 播放速度
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // 保持音高（播放变速时不变调）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.preservesPitch = true;
    // @ts-expect-error - Firefox 非标准属性
    audio.mozPreservesPitch = true;
  }, [monoAudio]);

  // 仅在用户拖动进度条时 seek 音频，正常播放不触发
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const diff = Math.abs(audio.currentTime - currentTime);
    if (diff > 0.5 && isFinite(currentTime)) {
      seekingRef.current = true;
      audio.currentTime = currentTime;
      requestAnimationFrame(() => {
        seekingRef.current = false;
      });
    }
  }, [currentTime]);

  return null;
};
