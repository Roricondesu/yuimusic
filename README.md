# YUIMUSIC · Liquid Glass Music

一款基于 React + TypeScript 的 Web 端流媒体音乐播放器，主打 Apple 风格「液态玻璃（Liquid Glass）」视觉效果。聚合 Audius、iTunes、Jamendo、osu! 四个音乐来源，支持多源歌词获取、CJK 搜索增强、完整播放器功能与逐行高亮歌词。

## 功能特性

- **多源音乐聚合**：Audius（去中心化完整免费音乐）、iTunes（30 秒版权试听）、Jamendo（CC 授权独立音乐）、osu!（谱面提取完整音频）
- **多源歌词竞速获取**：LRCLIB / 网易云 / 酷狗三源并行，取最先返回的有效结果，支持 LRC 逐行高亮
- **CJK 搜索增强**：通过 MusicBrainz 艺人别名将中文/日文/韩文转写为拉丁名，提升非英文内容搜索命中率
- **完整播放器**：播放队列、随机/循环、收藏、自建歌单、下载管理、定时关闭、均衡器预设
- **液态玻璃 UI**：基于 `@samasante/liquid-glass` 的玻璃质感卡片、滑块、开关，背景漂浮动画
- **主题系统**：明暗模式 + 8 种主题色，CSS 变量动态注入
- **正在播放全屏页**：模糊封面背景、桌面左右分栏、移动端横向滑动、逐行高亮歌词
- **osu! 谱面解压**：后台下载 `.osz` 文件，JSZip 解压提取音频，无缝切换到完整版

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript 5.8 |
| 构建 | Vite 6 |
| 状态管理 | Zustand 5 |
| 样式 | Tailwind CSS 3 + PostCSS |
| 玻璃引擎 | @samasante/liquid-glass |
| 图标 | lucide-react |
| 压缩 | JSZip（osu! .osz 解压） |
| 包管理 | pnpm 10/11 |

## 项目结构

```
src/
├── main.tsx                  # React 入口
├── App.tsx                   # 根组件，Tab 路由 + 布局编排
├── index.css                 # 全局样式 + CSS 变量 + 动画
├── components/
│   ├── common/               # CoverImage, Onboarding, SourceIcon, YuiLogo
│   ├── glass/                # GlassButton, GlassCard, GlassSlider, GlassSwitch
│   └── layout/               # Background, BottomPlayer, SeekBar, SplashScreen, TopNav
├── hooks/
│   ├── useAudio.ts           # HTMLAudioElement 生命周期与播放控制
│   └── useTheme.ts           # 主题 hook（独立实现，项目实际使用 store 内的 setTheme）
├── pages/
│   ├── Home.tsx              # 首页：每日精选、推荐、趋势、快捷入口
│   ├── Library.tsx           # 曲库：搜索、来源切换、流派筛选
│   ├── Charts.tsx            # 排行榜：各来源热门分区
│   ├── Downloads.tsx         # 下载管理
│   ├── Favorites.tsx         # 收藏列表
│   ├── Playlists.tsx         # 自建歌单
│   ├── Settings.tsx          # 设置：外观、播放、音质、均衡器等
│   └── NowPlaying.tsx        # 正在播放全屏页
├── store/useAppStore.ts      # Zustand 全局 store
├── types/index.ts            # 类型定义
└── utils/
    ├── accents.ts            # 8 种主题色
    ├── formatTime.ts         # 时间格式化
    ├── lyrics.ts             # 多源歌词获取与 LRC 解析
    ├── musicSources.ts       # 四源音乐搜索与 osu! 解压
    ├── musicbrainz.ts        # CJK 艺人别名扩展
    └── recommendation.ts     # 推荐算法
```

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 10+（推荐通过 corepack 启用）

### 安装与运行

```bash
# 启用 corepack（可选，用于固定 pnpm 版本）
corepack enable

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 生产构建
pnpm build

# 预览构建产物
pnpm preview

# 类型检查
pnpm check

# 代码检查
pnpm lint
```

### 音乐来源配置

| 来源 | 是否需要配置 | 说明 |
|---|---|---|
| Audius | 否 | 去中心化 API，无需密钥 |
| iTunes | 否 | 30 秒版权试听 |
| Jamendo | 可选 | 内置默认 Client ID，建议在设置页填写自己的以避免限流 |
| osu! | 否 | 通过 osu.direct 搜索，Sayobot/osu.direct 下载谱面 |

Jamendo Client ID 申请：https://developer.jamendo.com/

## 部署

项目为纯静态 SPA，构建产物在 `dist/` 目录，可部署到任意静态托管平台。

### 关键配置

- `vite.config.ts` 中 `base: './'` 使用相对路径，兼容根路径和子路径部署
- `pnpm-workspace.yaml` 配置了 `allowBuilds`（pnpm 11）和 `onlyBuiltDependencies`（pnpm 10）以允许 esbuild 构建脚本
- 开发环境的 API 代理（网易云/酷狗）在 `vite.config.ts` 的 `neteaseProxyPlugin` 中配置，生产环境使用 `corsproxy.io` 公共代理

### 部署到 EdgeOne Pages / Vercel / Netlify

```bash
pnpm build
# 将 dist/ 目录部署到静态托管平台
```

### 部署到 GitHub Pages

如需部署到 `https://<user>.github.io/<repo>/` 子路径，将 `vite.config.ts` 的 `base` 改为 `'/<repo>/'`。

## 核心设计

### 音乐来源聚合

`utils/musicSources.ts` 实现四源搜索与混源策略：
- **mixed 模式**：Audius / Jamendo / osu! 三源轮询穿插，保留各 API 相关度排序，iTunes 试听放最后
- **CJK 增强**：检测搜索词中的中日韩字符 → 查询 MusicBrainz 艺人英文别名 → 组合多查询词并行搜索
- **osu! 解压**：下载 `.osz`（ZIP 格式）→ JSZip 解压 → 解析 `.osu` 文件获取 `AudioFilename` → 生成 Blob URL

### 歌词系统

`utils/lyrics.ts` 实现多源竞速歌词获取：
- 三源并行（LRCLIB / 网易云 / 酷狗），各自超时控制
- 内存 LRU 缓存（50 条）+ localStorage 持久化（200 条）
- 标题清洗：去除 `(feat.)`、`[remix]`、`(official video)` 等噪声
- 模糊匹配：Jaccard 词集 + 编辑距离 + LCS 加权相似度
- 纯文本歌词按句子长度加权分配时间戳

### 状态管理

单一 Zustand store（`store/useAppStore.ts`）管理全部状态：
- `player`：当前曲目、播放状态、队列、历史、收藏、歌单、歌词
- `library`：曲库曲目、搜索状态
- `downloads`：下载列表与进度
- `settings`：主题、音质、均衡器、定时关闭等

### 液态玻璃组件

基于 `@samasante/liquid-glass` 引擎实现：
- `GlassCard`：核心容器，配置 depth/curvature/dispersion/frost 等光学参数
- `GlassSlider`：macOS 风格滑块，含橡皮筋超界、镜头摆动、展开收起动画
- `GlassSwitch`：支持点击切换与长按拖拽的状态机开关

## 已知限制

- 状态未持久化：刷新后收藏/歌单/历史/设置会丢失（仅歌词缓存和引导标记走 localStorage）
- 部分设置项为 UI 占位：`crossfade`、`bassBoost`、`eqPreset`、`spatialAudio`、`gapless` 等尚未接入实际音频处理逻辑
- osu! 完整音频依赖第三方镜像下载，可能受网络或服务可用性影响

## License

MIT
