# osu! game — 产品需求文档（PRD）

## 1. 项目概述

**项目名称**：osu-game（独立子项目，位于 `/workspace/osu-game/`）

**目标**：构建一个移动端友好的网页版 osu! 节奏游戏，复用 yuimusic 项目的视觉语言（液态玻璃 / macOS 风），支持 4 种游戏模式与谱面下载。

**用户场景**：
- 用户在手机浏览器打开页面 → 搜索喜欢的歌曲 → 下载 .osz 谱面 → 选择模式开始游戏 → 触屏点击获得分数
- 用户在桌面浏览器也可游玩（鼠标 / 键盘）

## 2. 核心功能

### 2.1 谱面浏览与搜索
- 通过 `osu.direct` 公共镜像搜索 beatmapset（无需 API key）
- 支持按流派 / 关键词 / 热门排序
- 显示封面、标题、艺人、BPM、难度（星级）、模式标识

### 2.2 谱面下载
- 通过 `sayobot` mini 镜像下载 .osz（无视频，体积最小）
- 解压 .osz（zip 格式）提取 .osu 与音频文件
- 本地缓存（IndexedDB / 内存）避免重复下载

### 2.3 4 种游戏模式
| 模式 | 玩法 | 输入 |
|---|---|---|
| osu!standard | 点击圆圈、滑条、转盘 | 触屏点击 / 鼠标 |
| osu!taiko | 节奏鼓（红/蓝音符落到判定圈） | 触屏左右半屏 / 键盘 D K |
| osu!catch | 接水果（水果从顶部落下，盘子接住） | 触屏左右滑动 / ← → |
| osu!mania | 下落式键击（音符落到判定线） | 触屏 4 列 / D F J K |

### 2.4 游戏判定与计分
- 三段判定：300 / 100 / 50 / Miss
- 连击（Combo）系统
- 准确率（Accuracy）显示
- 结算页显示分数、最大连击、准确率

### 2.5 模式选择与难度选择
- 每个 beatmapset 可能包含多个难度（不同星级）
- 玩家可先选模式过滤 → 再选难度开始

## 3. 非功能需求

### 3.1 移动端友好
- 响应式布局，触屏为大优先（最小 320px 宽度可用）
- 安全区适配（`env(safe-area-inset-*)`）
- 触屏延迟 < 50ms（无 300ms click 延迟）
- 横屏游戏（standard/taiko/catch/mania 都横屏游玩）

### 3.2 性能
- 游戏循环 60fps（Canvas 渲染）
- 单谱面内存占用 < 100MB
- .osz 下载有进度反馈

### 3.3 UI 风格一致性（参考 yuimusic）
- 液态玻璃卡片（`solid-card` 类）
- macOS 风控件（GlassButton / GlassSwitch / GlassSlider）
- 浅色/深色主题切换
- 主题色（accent）动态注入 CSS 变量
- 系统字体栈：`-apple-system, BlinkMacSystemFont, "SF Pro Text"`
- 卡片错峰入场动画（`stagger-fade-up`）

## 4. 页面结构

```
/                首页（推荐 / 热门谱面）
/search          搜索页
/set/:setId      谱面详情（难度列表 + 下载 + 开始游戏按钮）
/game/:setId/:mode/:diff   游戏页（全屏 Canvas）
/settings        设置（主题、音量、判定偏移）
```

## 5. 技术依赖

- **构建**：Vite 6 + React 18 + TypeScript 5
- **样式**：Tailwind CSS 3
- **状态**：Zustand
- **路由**：react-router-dom 7
- **图标**：lucide-react
- **解压**：JSZip（.osz 是 zip）
- **API**：osu.direct 公共镜像（无 key）

## 6. 不在范围内

- 在线对战 / 排行榜
- 谱面编辑器
- 视频背景播放
- 用户账号系统
- 鼓掌 / 哒哒声等音效合成（仅播放谱面自带音频）

## 7. 验收标准

- [ ] 移动端浏览器可搜索谱面
- [ ] 可下载并解压 .osz
- [ ] 4 种模式均可启动并游玩
- [ ] 游戏过程 60fps 流畅
- [ ] 结算页显示分数
- [ ] UI 视觉与 yuimusic 风格统一
