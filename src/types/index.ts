export type RepeatMode = "off" | "all" | "one";

export type TrackSource =
  | "itunes"
  | "audius"
  | "jamendo"
  | "osu"
  | "bilibili"
  | "ia"
  | "deezer";

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
  /** osu! 专用：beatmapset id，用于下载 .osz 提取音频 */
  osuSetId?: number;
  /** osu! 下载镜像：sayobot（国内快）| osu.direct */
  osuMirror?: "sayobot" | "osu.direct";
  /** Bilibili 音频区 au_id，用于按需解析流地址 */
  bilibiliAuId?: number;
  /** Bilibili 视频 bvid（兜底用） */
  bilibiliBvid?: string;
  /**
   * 同曲目不同来源的备选版本（名字+歌手相同视为同曲目）。
   * 主 Track 是首选来源，alternatives 是其他来源的可切换版本。
   * 仅在搜索结果合并时填充，播放时可切换。
   */
  alternatives?: Track[];
}

/** 歌词语言模式：原文 / 译文 / 双语 */
export type LyricLanguage = "original" | "translation" | "bilingual";

export type TabKey =
  | "home"
  | "library"
  | "charts"
  | "artists"
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
  /** 译文（双语模式下填充） */
  translation?: string;
}

/** 歌词获取结果，携带原文与译文以便切换语言模式 */
export interface FetchedLyrics {
  lines: LyricLine[];
  /** 译文行（按原文时间戳对齐），无则空 */
  translationLines: LyricLine[];
  /** 歌词来源标识，用于展示 */
  sourceLabel: string;
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
  /** 歌词语言：原文 / 译文 / 双语 */
  lyricLanguage: LyricLanguage;
  /** 歌词时间偏移（毫秒，正值延后，负值提前） */
  lyricOffset: number;
  /** 显示歌词来源徽标 */
  showLyricSource: boolean;
  /** 在曲目标签上显示来源徽标 */
  showSourceBadge: boolean;
  /** 进入播放页时自动加载歌词 */
  autoLoadLyrics: boolean;
  /** 播放时保持屏幕常亮 */
  keepScreenOn: boolean;
  /** 紧凑模式（缩小卡片间距与内边距） */
  compactMode: boolean;
  /** 启动页动画总时长（毫秒） */
  splashDuration: number;
  // === 背景自定义 ===
  /** 背景模式：default（默认渐变光斑）| image（自定义图片）| gradient（渐变）| solid（纯色） */
  backgroundMode: "default" | "image" | "gradient" | "solid";
  /** 纯色背景 hex */
  backgroundSolid: string;
  /** 渐变起始色 hex */
  backgroundGradientFrom: string;
  /** 渐变结束色 hex */
  backgroundGradientTo: string;
  /** 渐变角度 0-360 */
  backgroundGradientAngle: number;
  /** 背景图片模糊 0-40 px */
  backgroundBlur: number;
  /** 背景变暗度 0-0.8 */
  backgroundDim: number;
  /** 背景图片缩放 100-130%（避免模糊露出边缘） */
  backgroundScale: number;
  /** 背景图片版本号，上传新图后自增以触发重载 */
  backgroundImageNonce: number;
  // === 界面自定义 ===
  /** 界面缩放 0.85-1.15 */
  uiScale: number;
  /** 卡片不透明度 0.6-1 */
  cardOpacity: number;
  /** 封面圆角 0-24 px */
  coverRadius: number;
  /** 滚动条样式 */
  scrollbarStyle: "auto" | "thin" | "hidden";
  /** 底部播放栏高度紧凑模式 */
  miniPlayer: boolean;
  /** 显示音波可视化（占位，后续接入） */
  showVisualizer: boolean;
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
  /** 当前歌词来源标签（用于展示，如「网易云」「本地导入」） */
  lyricSourceLabel: string;
  /** 最近一次获取的原始歌词（含原文+译文），用于切换语言模式时即时应用 */
  fetchedLyrics: FetchedLyrics | null;
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
