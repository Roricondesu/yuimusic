export type RepeatMode = "off" | "all" | "one";

export type TrackSource = "itunes" | "audius" | "jamendo" | "osu";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  src: string;
  source: TrackSource;
  /** 是否为版权试听版（如 iTunes 30 秒预览） */
  preview?: boolean;
  /** osu! 专用：beatmapset id，用于下载 .osz 提取完整音频 */
  osuSetId?: number;
  /** osu! 下载镜像：sayobot（国内快）| osu.direct */
  osuMirror?: "sayobot" | "osu.direct";
}

export type TabKey =
  | "home"
  | "library"
  | "charts"
  | "downloads"
  | "favorites"
  | "playlists"
  | "settings";

/** 下载项状态 */
export interface DownloadItem {
  track: Track;
  status: "downloading" | "completed" | "failed";
  /** 下载进度 0-1 */
  progress: number;
  mirror: "sayobot" | "osu.direct";
  createdAt: number;
}

export type Theme = "light" | "dark";
export type Quality = "low" | "normal" | "high";
export type EqPreset = "flat" | "bass" | "vocal" | "electronic";

/** 预设主题色 key */
export type AccentKey =
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "green"
  | "teal"
  | "indigo";

export interface LyricLine {
  time: number; // 秒
  text: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  createdAt: number;
  /** 自定义封面色（HEX） */
  color?: string;
}

export interface AppSettings {
  theme: Theme;
  accent: AccentKey;
  quality: Quality;
  crossfade: number;
  volumeLimit: number;
  eqPreset: EqPreset;
  reduceMotion: boolean;
  autoplay: boolean;
  gapless: boolean;
  bassBoost: number;
  spatialAudio: boolean;
  showLyrics: boolean;
  sleepTimer: number;
  /** 偏好的音乐来源（混源 / iTunes / Audius / Jamendo / osu!） */
  preferredSource: "mixed" | "itunes" | "audius" | "jamendo" | "osu";
  /** Jamendo API client_id（空则使用默认测试 key，可能被限流/停用） */
  jamendoClientId: string;
  /** 播放速度（0.5 - 2.0） */
  playbackSpeed: number;
  /** 歌词字号 */
  lyricFontSize: "small" | "medium" | "large";
  /** 歌词非当前行效果 */
  lyricEffect: "none" | "blur" | "fade";
  /** 歌词对齐方式 */
  lyricAlign: "left" | "center" | "right";
  /** 歌词字体粗细 */
  lyricWeight: "normal" | "medium" | "bold";
  /** 歌词字体族 */
  lyricFontFamily: "system" | "serif" | "mono";
  /** 歌词滚动是否使用回弹动画（接近焦点时减速回弹） */
  lyricBounceScroll: boolean;
  /** 歌词字距 */
  lyricLetterSpacing: "compact" | "normal" | "loose";
  /** 歌词行高 */
  lyricLineHeight: "tight" | "normal" | "relaxed";
  /** 单声道音频 */
  monoAudio: boolean;
  /** 默认搜索词（空则 pop） */
  defaultQuery: string;
  /** osu! 下载镜像源 */
  osuMirror: "sayobot" | "osu.direct";
  /** 歌词来源：auto（并行竞速）| lrclib（海外）| netease（网易云）| kugou（酷狗） */
  lyricsSource: "auto" | "lrclib" | "netease" | "kugou";
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Track[];
  history: Track[];
  favorites: Track[];
  playlists: Playlist[];
  /** 已下载到本地的曲目（Blob 已存入 IndexedDB） */
  downloadedTracks: Track[];
  showNowPlaying: boolean;
  lyrics: LyricLine[];
  lyricsLoading: boolean;
  currentLyricIndex: number;
  /** 当前播放上下文（来自哪个歌单/列表） */
  contextQueue: Track[];
  /** osu! 谱面下载进度（0-1），-1 表示无下载 */
  osuDownloadProgress: number;
  /** 手动下载进度：trackId → 0-1，不在列表中表示无下载 */
  downloadProgress: Record<string, number>;
}

export interface LibraryState {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  query: string;
  source: AppSettings["preferredSource"];
}

export interface iTunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  artworkUrl600?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

export interface JamendoResult {
  id: string;
  name: string;
  artist_id: string;
  artist_name: string;
  album_id?: string;
  album_name?: string;
  duration: number;
  image: string;
  audio: string;
  audiodownload?: string;
}
