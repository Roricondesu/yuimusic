import { create } from "zustand";
import type {
  Track,
  PlayerState,
  AppSettings,
  LibraryState,
  TabKey,
  RepeatMode,
  Playlist,
  DownloadItem,
} from "../types";
import { fetchLyrics, findLyricIndex } from "../utils/lyrics";
import { searchTracks, downloadTrackAudio } from "../utils/musicSources";
import { applyAccent } from "../utils/accents";
import { getItem, setItem, setBlob, getBlob, removeBlob, STORAGE_KEYS } from "../lib/storage";

const applyTheme = (theme: AppSettings["theme"]) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
};

// 默认设置，用于合并持久化的部分数据
const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accent: "blue",
  quality: "high",
  crossfade: 0,
  volumeLimit: 1,
  eqPreset: "flat",
  reduceMotion: false,
  autoplay: true,
  gapless: false,
  bassBoost: 0,
  spatialAudio: false,
  showLyrics: true,
  sleepTimer: 0,
  preferredSource: "mixed",
  jamendoClientId: "",
  playbackSpeed: 1,
  lyricFontSize: "medium",
  lyricEffect: "fade",
  lyricAlign: "center",
  lyricWeight: "normal",
  lyricFontFamily: "system",
  monoAudio: false,
  defaultQuery: "",
  osuMirror: "sayobot",
  lyricsSource: "auto",
};

const DEFAULT_QUERY = "pop";

const randomIndex = (length: number, exclude?: number) => {
  if (length <= 1) return 0;
  let idx = Math.floor(Math.random() * length);
  while (exclude !== undefined && idx === exclude) {
    idx = Math.floor(Math.random() * length);
  }
  return idx;
};

const genId = () => `pl-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

// 持久化辅助：写入后异步保存到 IndexedDB
const persistFavorites = (favorites: Track[]) => setItem(STORAGE_KEYS.favorites, favorites);
const persistPlaylists = (playlists: Playlist[]) => setItem(STORAGE_KEYS.playlists, playlists);
const persistHistory = (history: Track[]) => setItem(STORAGE_KEYS.history, history);
const persistSettings = (settings: AppSettings) => setItem(STORAGE_KEYS.settings, settings);
const persistDownloads = (downloads: DownloadItem[]) => setItem(STORAGE_KEYS.downloads, downloads);
const persistDownloadedTracks = (tracks: Track[]) => setItem(STORAGE_KEYS.downloadedTracks, tracks);

interface AppState {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  /** 播放列表详情视图：null = 列表，字符串 = 详情 id */
  openPlaylistId: string | null;
  setOpenPlaylist: (id: string | null) => void;

  player: PlayerState;
  playTrack: (track: Track, context?: Track[]) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setProgress: (progress: number, currentTime?: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  seekTo: (progress: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setQueue: (queue: Track[]) => void;

  toggleFavorite: (track: Track) => void;
  isFavorite: (id: string) => boolean;

  // 播放列表
  createPlaylist: (name: string, description?: string, color?: string) => string;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  isTrackInPlaylist: (playlistId: string, trackId: string) => boolean;
  playPlaylist: (playlist: Playlist, startIndex?: number) => void;

  showNowPlaying: (show: boolean) => void;
  loadLyrics: (track: Track) => Promise<void>;
  updateCurrentLyric: () => void;

  library: LibraryState;
  loadTracks: () => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  setLibrarySource: (source: AppSettings["preferredSource"]) => void;

  // 下载管理
  downloads: DownloadItem[];
  addDownload: (track: Track, mirror: "sayobot" | "osu.direct") => void;
  updateDownload: (trackId: string, progress: number) => void;
  completeDownload: (trackId: string) => void;
  failDownload: (trackId: string) => void;
  removeDownload: (trackId: string) => void;
  clearDownloads: () => void;

  // 本地下载（离线播放）
  /** 下载曲目音频到 IndexedDB */
  downloadTrack: (track: Track) => Promise<void>;
  /** 检查曲目是否已下载 */
  isDownloaded: (trackId: string) => boolean;
  /** 获取已下载曲目的本地 Blob URL（无则返回 null） */
  getDownloadedUrl: (trackId: string) => Promise<string | null>;
  /** 删除已下载的曲目 */
  removeDownloadedTrack: (trackId: string) => Promise<void>;

  settings: AppSettings;
  setTheme: (theme: AppSettings["theme"]) => void;
  setAccent: (accent: AppSettings["accent"]) => void;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  init: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: "home",
  setActiveTab: (tab) => set({ activeTab: tab }),
  openPlaylistId: null,
  setOpenPlaylist: (id) => set({ openPlaylistId: id }),

  player: {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: "off",
    queue: [],
    history: [],
    favorites: [],
    playlists: [],
    downloadedTracks: [],
    showNowPlaying: false,
    lyrics: [],
    lyricsLoading: false,
    currentLyricIndex: -1,
    contextQueue: [],
    osuDownloadProgress: -1,
    downloadProgress: {},
  },

  playTrack: (track, context) => {
    const { player } = get();
    const newHistory = [track, ...player.history.filter((t) => t.id !== track.id)].slice(0, 30);
    const contextQueue = context && context.length ? context : player.contextQueue;
    set({
      player: {
        ...player,
        currentTrack: track,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        duration: track.duration,
        history: newHistory,
        lyrics: [],
        currentLyricIndex: -1,
        contextQueue,
        osuDownloadProgress: -1,
      },
    });
    persistHistory(newHistory);
    get().loadLyrics(track);
  },

  togglePlay: () =>
    set({ player: { ...get().player, isPlaying: !get().player.isPlaying } }),

  setPlaying: (playing) =>
    set({ player: { ...get().player, isPlaying: playing } }),

  setProgress: (progress, currentTime) => {
    const player = get().player;
    const newTime = currentTime ?? player.currentTime;
    const lyricIndex = player.lyrics.length
      ? findLyricIndex(player.lyrics, newTime)
      : -1;
    set({
      player: {
        ...player,
        progress,
        currentTime: newTime,
        currentLyricIndex: lyricIndex,
      },
    });
  },

  setDuration: (duration) =>
    set({ player: { ...get().player, duration } }),

  setVolume: (volume) =>
    set({ player: { ...get().player, volume } }),

  seekTo: (progress) => {
    const duration =
      get().player.duration || get().player.currentTrack?.duration || 0;
    if (duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, progress));
    const time = clamped * duration;
    get().setProgress(clamped, time);
  },

  nextTrack: () => {
    const { player } = get();
    const tracks =
      player.contextQueue.length > 0
        ? player.contextQueue
        : get().library.tracks;
    if (!tracks.length || !player.currentTrack) return;

    if (player.repeat === "one") {
      get().playTrack(player.currentTrack);
      return;
    }

    const currentIdx = tracks.findIndex((t) => t.id === player.currentTrack!.id);
    let next: Track;
    if (player.shuffle) {
      next = tracks[randomIndex(tracks.length, currentIdx)];
    } else {
      // 列表循环
      next = tracks[(currentIdx + 1) % tracks.length];
    }
    get().playTrack(next, tracks);
  },

  prevTrack: () => {
    const { player } = get();
    const tracks =
      player.contextQueue.length > 0
        ? player.contextQueue
        : get().library.tracks;
    if (!tracks.length || !player.currentTrack) return;
    // 播放超过 3 秒则回到开头
    if (player.currentTime > 3) {
      get().seekTo(0);
      return;
    }
    const idx = tracks.findIndex((t) => t.id === player.currentTrack!.id);
    const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
    get().playTrack(prev, tracks);
  },

  toggleShuffle: () =>
    set({ player: { ...get().player, shuffle: !get().player.shuffle } }),

  cycleRepeat: () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const next = modes[(modes.indexOf(get().player.repeat) + 1) % modes.length];
    set({ player: { ...get().player, repeat: next } });
  },

  setQueue: (queue) => set({ player: { ...get().player, queue } }),

  toggleFavorite: (track) => {
    const { player } = get();
    const exists = player.favorites.some((t) => t.id === track.id);
    const favorites = exists
      ? player.favorites.filter((t) => t.id !== track.id)
      : [track, ...player.favorites];
    set({ player: { ...player, favorites } });
    persistFavorites(favorites);
  },

  isFavorite: (id) => get().player.favorites.some((t) => t.id === id),

  createPlaylist: (name, description, color) => {
    const id = genId();
    const playlist: Playlist = {
      id,
      name: name.trim() || "新建歌单",
      description,
      tracks: [],
      createdAt: Date.now(),
      color,
    };
    const playlists = [playlist, ...get().player.playlists];
    set({ player: { ...get().player, playlists } });
    persistPlaylists(playlists);
    return id;
  },

  deletePlaylist: (id) => {
    const playlists = get().player.playlists.filter((p) => p.id !== id);
    set({
      player: { ...get().player, playlists },
      openPlaylistId: get().openPlaylistId === id ? null : get().openPlaylistId,
    });
    persistPlaylists(playlists);
  },

  renamePlaylist: (id, name) => {
    const playlists = get().player.playlists.map((p) =>
      p.id === id ? { ...p, name } : p,
    );
    set({ player: { ...get().player, playlists } });
    persistPlaylists(playlists);
  },

  addToPlaylist: (playlistId, track) => {
    const playlists = get().player.playlists.map((p) =>
      p.id === playlistId
        ? {
            ...p,
            tracks: p.tracks.some((t) => t.id === track.id)
              ? p.tracks
              : [...p.tracks, track],
          }
        : p,
    );
    set({ player: { ...get().player, playlists } });
    persistPlaylists(playlists);
  },

  removeFromPlaylist: (playlistId, trackId) => {
    const playlists = get().player.playlists.map((p) =>
      p.id === playlistId
        ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
        : p,
    );
    set({ player: { ...get().player, playlists } });
    persistPlaylists(playlists);
  },

  isTrackInPlaylist: (playlistId, trackId) => {
    const pl = get().player.playlists.find((p) => p.id === playlistId);
    return pl ? pl.tracks.some((t) => t.id === trackId) : false;
  },

  playPlaylist: (playlist, startIndex = 0) => {
    if (!playlist.tracks.length) return;
    const track = playlist.tracks[startIndex] || playlist.tracks[0];
    get().playTrack(track, playlist.tracks);
  },

  showNowPlaying: (show) =>
    set({ player: { ...get().player, showNowPlaying: show } }),

  loadLyrics: async (track) => {
    set({ player: { ...get().player, lyricsLoading: true, lyrics: [] } });
    try {
      const lyrics = await fetchLyrics(
        track.artist,
        track.title,
        track.album,
        track.duration,
        get().settings.lyricsSource,
      );
      set({
        player: {
          ...get().player,
          lyrics,
          lyricsLoading: false,
          currentLyricIndex: findLyricIndex(lyrics, get().player.currentTime),
        },
      });
    } catch {
      set({ player: { ...get().player, lyrics: [], lyricsLoading: false } });
    }
  },

  updateCurrentLyric: () => {
    const player = get().player;
    if (!player.lyrics.length) return;
    const idx = findLyricIndex(player.lyrics, player.currentTime);
    if (idx !== player.currentLyricIndex) {
      set({ player: { ...player, currentLyricIndex: idx } });
    }
  },

  library: {
    tracks: [],
    loading: true,
    error: null,
    query: DEFAULT_QUERY,
    source: "mixed",
  },

  loadTracks: async () => {
    const query = get().library.query || DEFAULT_QUERY;
    const source = get().library.source;
    const jamendoClientId = get().settings.jamendoClientId;
    set({ library: { ...get().library, tracks: [], loading: true, error: null } });
    try {
      const { tracks, partial } = await searchTracks(query, source, 24, jamendoClientId);
      set({
        library: {
          ...get().library,
          tracks,
          loading: false,
          error: partial && tracks.length === 0 ? "部分来源加载失败" : null,
        },
      });
    } catch (e) {
      set({
        library: { ...get().library, tracks: [], loading: false, error: String(e) },
      });
    }
  },

  searchTracks: async (query) => {
    const term = query.trim();
    const source = get().library.source;
    const jamendoClientId = get().settings.jamendoClientId;
    set({
      library: {
        ...get().library,
        query: term,
        tracks: [],
        loading: true,
        error: null,
      },
    });
    try {
      const { tracks, partial } = await searchTracks(term || DEFAULT_QUERY, source, 24, jamendoClientId);
      set({
        library: {
          ...get().library,
          tracks,
          loading: false,
          error: partial && tracks.length === 0 ? "部分来源加载失败，请稍后重试" : null,
        },
      });
    } catch (e) {
      set({
        library: { ...get().library, tracks: [], loading: false, error: String(e) },
      });
    }
  },

  setLibrarySource: (source) => {
    set({ library: { ...get().library, source } });
    get().loadTracks();
  },

  // === 下载管理 ===
  downloads: [],

  addDownload: (track, mirror) => {
    const existing = get().downloads.find((d) => d.track.id === track.id);
    if (existing) return;
    const downloads = [
      {
        track,
        status: "downloading" as const,
        progress: 0,
        mirror,
        createdAt: Date.now(),
      },
      ...get().downloads,
    ];
    set({ downloads });
    persistDownloads(downloads);
  },

  updateDownload: (trackId, progress) => {
    const downloads = get().downloads.map((d) =>
      d.track.id === trackId && d.status === "downloading"
        ? { ...d, progress }
        : d,
    );
    set({ downloads });
    persistDownloads(downloads);
  },

  completeDownload: (trackId) => {
    const downloads = get().downloads.map((d) =>
      d.track.id === trackId
        ? { ...d, status: "completed" as const, progress: 1 }
        : d,
    );
    set({ downloads });
    persistDownloads(downloads);
  },

  failDownload: (trackId) => {
    const downloads = get().downloads.map((d) =>
      d.track.id === trackId ? { ...d, status: "failed" as const } : d,
    );
    set({ downloads });
    persistDownloads(downloads);
  },

  removeDownload: (trackId) => {
    const downloads = get().downloads.filter((d) => d.track.id !== trackId);
    set({ downloads });
    persistDownloads(downloads);
  },

  clearDownloads: () => {
    set({ downloads: [] });
    persistDownloads([]);
  },

  // === 本地下载（离线播放） ===
  downloadTrack: async (track) => {
    // 已下载则跳过
    if (get().player.downloadedTracks.some((t) => t.id === track.id)) return;
    const mirror = get().settings.osuMirror;

    // 设置进度
    set((s) => ({
      player: {
        ...s.player,
        downloadProgress: { ...s.player.downloadProgress, [track.id]: 0 },
      },
    }));

    try {
      const blob = await downloadTrackAudio(
        track,
        (ratio) => {
          set((s) => ({
            player: {
              ...s.player,
              downloadProgress: { ...s.player.downloadProgress, [track.id]: ratio },
            },
          }));
        },
        mirror,
      );
      // 存储 Blob 到 IndexedDB
      await setBlob(`audio:${track.id}`, blob);
      // 更新已下载列表
      const downloadedTracks = [track, ...get().player.downloadedTracks];
      set((s) => {
        const dp = { ...s.player.downloadProgress };
        delete dp[track.id];
        return {
          player: {
            ...s.player,
            downloadedTracks,
            downloadProgress: dp,
          },
        };
      });
      persistDownloadedTracks(downloadedTracks);
    } catch (e) {
      // 清除进度
      set((s) => {
        const dp = { ...s.player.downloadProgress };
        delete dp[track.id];
        return { player: { ...s.player, downloadProgress: dp } };
      });
      throw e;
    }
  },

  isDownloaded: (trackId) =>
    get().player.downloadedTracks.some((t) => t.id === trackId),

  getDownloadedUrl: async (trackId) => {
    const blob = await getBlob(`audio:${trackId}`);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  },

  removeDownloadedTrack: async (trackId) => {
    await removeBlob(`audio:${trackId}`);
    const downloadedTracks = get().player.downloadedTracks.filter(
      (t) => t.id !== trackId,
    );
    set((s) => ({ player: { ...s.player, downloadedTracks } }));
    persistDownloadedTracks(downloadedTracks);
  },

  settings: { ...DEFAULT_SETTINGS },

  setTheme: (theme) => {
    applyTheme(theme);
    const settings = { ...get().settings, theme };
    set({ settings });
    persistSettings(settings);
  },

  setAccent: (accent) => {
    applyAccent(accent);
    const settings = { ...get().settings, accent };
    set({ settings });
    persistSettings(settings);
  },

  updateSetting: (key, value) => {
    if (key === "theme") applyTheme(value as AppSettings["theme"]);
    if (key === "accent") applyAccent(value as AppSettings["accent"]);
    const settings = { ...get().settings, [key]: value };
    set({ settings });
    persistSettings(settings);
  },

  init: async () => {
    // 从 IndexedDB 恢复持久化状态
    const [favorites, playlists, history, savedSettings, downloads, downloadedTracks] = await Promise.all([
      getItem<Track[]>(STORAGE_KEYS.favorites, []),
      getItem<Playlist[]>(STORAGE_KEYS.playlists, []),
      getItem<Track[]>(STORAGE_KEYS.history, []),
      getItem<Partial<AppSettings>>(STORAGE_KEYS.settings, {}),
      getItem<DownloadItem[]>(STORAGE_KEYS.downloads, []),
      getItem<Track[]>(STORAGE_KEYS.downloadedTracks, []),
    ]);

    const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
    applyTheme(settings.theme);
    applyAccent(settings.accent);

    set((state) => ({
      player: {
        ...state.player,
        favorites,
        playlists,
        history,
        downloadedTracks,
      },
      downloads,
      settings,
    }));
  },
}));
