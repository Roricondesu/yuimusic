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
import { searchTracks } from "../utils/musicSources";
import { applyAccent } from "../utils/accents";

const applyTheme = (theme: AppSettings["theme"]) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
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
    showNowPlaying: false,
    lyrics: [],
    lyricsLoading: false,
    currentLyricIndex: -1,
    contextQueue: [],
    osuDownloadProgress: -1,
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
    set({
      player: { ...get().player, playlists: [playlist, ...get().player.playlists] },
    });
    return id;
  },

  deletePlaylist: (id) => {
    set({
      player: {
        ...get().player,
        playlists: get().player.playlists.filter((p) => p.id !== id),
      },
      openPlaylistId: get().openPlaylistId === id ? null : get().openPlaylistId,
    });
  },

  renamePlaylist: (id, name) => {
    set({
      player: {
        ...get().player,
        playlists: get().player.playlists.map((p) =>
          p.id === id ? { ...p, name } : p,
        ),
      },
    });
  },

  addToPlaylist: (playlistId, track) => {
    set({
      player: {
        ...get().player,
        playlists: get().player.playlists.map((p) =>
          p.id === playlistId
            ? {
                ...p,
                tracks: p.tracks.some((t) => t.id === track.id)
                  ? p.tracks
                  : [...p.tracks, track],
              }
            : p,
        ),
      },
    });
  },

  removeFromPlaylist: (playlistId, trackId) => {
    set({
      player: {
        ...get().player,
        playlists: get().player.playlists.map((p) =>
          p.id === playlistId
            ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
            : p,
        ),
      },
    });
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
    set({
      downloads: [
        {
          track,
          status: "downloading",
          progress: 0,
          mirror,
          createdAt: Date.now(),
        },
        ...get().downloads,
      ],
    });
  },

  updateDownload: (trackId, progress) => {
    set({
      downloads: get().downloads.map((d) =>
        d.track.id === trackId && d.status === "downloading"
          ? { ...d, progress }
          : d,
      ),
    });
  },

  completeDownload: (trackId) => {
    set({
      downloads: get().downloads.map((d) =>
        d.track.id === trackId
          ? { ...d, status: "completed", progress: 1 }
          : d,
      ),
    });
  },

  failDownload: (trackId) => {
    set({
      downloads: get().downloads.map((d) =>
        d.track.id === trackId ? { ...d, status: "failed" } : d,
      ),
    });
  },

  removeDownload: (trackId) => {
    set({
      downloads: get().downloads.filter((d) => d.track.id !== trackId),
    });
  },

  clearDownloads: () => {
    set({ downloads: [] });
  },

  settings: {
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
    monoAudio: false,
    defaultQuery: "",
    osuMirror: "sayobot",
    lyricsSource: "auto",
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ settings: { ...get().settings, theme } });
  },

  setAccent: (accent) => {
    applyAccent(accent);
    set({ settings: { ...get().settings, accent } });
  },

  updateSetting: (key, value) => {
    if (key === "theme") applyTheme(value as AppSettings["theme"]);
    if (key === "accent") applyAccent(value as AppSettings["accent"]);
    set({ settings: { ...get().settings, [key]: value } });
  },

  init: () => {
    const { settings } = get();
    applyTheme(settings.theme);
    applyAccent(settings.accent);
  },
}));
