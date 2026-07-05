# osu! game — 技术架构文档

## 1. 项目结构

```
/workspace/osu-game/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx                 # 入口
    ├── App.tsx                  # 路由 + 全局布局
    ├── index.css                # Tailwind + yuimusic 同款 CSS 变量
    ├── types/
    │   └── index.ts             # BeatmapSet / Beatmap / GameMode / HitObject
    ├── store/
    │   └── useGameStore.ts      # Zustand 全局状态
    ├── api/
    │   └── osuDirect.ts         # osu.direct 搜索 + sayobot 下载
    ├── utils/
    │   ├── osuParser.ts         # .osu 文件解析
    │   ├── audioLoader.ts       # 音频文件 → AudioBuffer / Blob URL
    │   ├── cache.ts             # 内存缓存（避免重复下载）
    │   └── formatTime.ts        # 时间格式化
    ├── components/
    │   ├── glass/
    │   │   ├── GlassButton.tsx
    │   │   ├── GlassSwitch.tsx
    │   │   └── GlassSlider.tsx
    │   ├── common/
    │   │   ├── BeatmapCard.tsx
    │   │   ├── ModeBadge.tsx
    │   │   └── DifficultyBadge.tsx
    │   └── layout/
    │       ├── TopNav.tsx
    │       └── Background.tsx
    ├── engine/
    │   ├── GameEngine.ts        # 游戏循环基类
    │   ├── Judger.ts            # 判定逻辑（300/100/50/Miss）
    │   ├── modes/
    │   │   ├── StandardEngine.ts
    │   │   ├── TaikoEngine.ts
    │   │   ├── CatchEngine.ts
    │   │   └── ManiaEngine.ts
    │   └── renderer/
    │       └── Canvas2D.ts      # Canvas 渲染辅助
    ├── pages/
    │   ├── Home.tsx             # 热门谱面
    │   ├── Search.tsx           # 搜索
    │   ├── BeatmapSetDetail.tsx # 谱面详情 + 下载
    │   ├── Game.tsx             # 游戏页（全屏 Canvas）
    │   └── Settings.tsx         # 设置
    └── hooks/
        ├── useTheme.ts
        └── useOrientation.ts    # 横屏检测
```

## 2. 关键模块设计

### 2.1 osu.direct API（`api/osuDirect.ts`）

```typescript
// 搜索 beatmapset
searchBeatmapsets(query: string, mode?: GameMode, limit?: number): Promise<BeatmapSet[]>
// 下载 .osz（sayobot mini 镜像）
downloadOsz(setId: number, onProgress?: (ratio: number) => void): Promise<ArrayBuffer>
// 通过 setId 获取 beatmapset 详情（含 beatmaps 数组）
fetchBeatmapSet(setId: number): Promise<BeatmapSet>
```

复用 yuimusic 中已验证的镜像：
- 搜索：`https://osu.direct/api/v2/search`
- 下载：`https://dl.sayobot.cn/beatmaps/download/mini/{setId}`（mini 版无视频，体积最小）
- 详情：`https://osu.direct/api/v2/s/{setId}`

### 2.2 .osu 解析器（`utils/osuParser.ts`）

osu! .osu 文件是 INI 风格文本格式，分多个 section：
- `[General]`：AudioFilename, Mode, StackLeniency...
- `[Metadata]`：Title, Artist, Creator, BeatmapID...
- `[Difficulty]`：HPDrainRate, CircleSize, OverallDifficulty, ApproachRate, SliderMultiplier, SliderTickRate
- `[TimingPoints]`：时间点列表（BPM、音量、 kiai 时间）
- `[HitObjects]`：核心击打对象

**HitObject 行格式**（逗号分隔）：
```
x,y,time,type,hitSound,objectParams,hitSample
```
- `type` 位掩码：1=circle, 2=slider, 8=spinner, 128=mania hold
- slider 的 `objectParams` 含 sliderType + curvePoints + repeats + length
- mania hold 的 `objectParams` 含 endTime

解析后输出统一 `HitObject` 结构：
```typescript
interface HitObject {
  x: number;          // 0-512 (osu 坐标系)
  y: number;          // 0-384
  time: number;       // 毫秒
  type: 'circle' | 'slider' | 'spinner' | 'hold';
  // slider 专属
  curvePoints?: { x: number; y: number }[];
  slides?: number;
  length?: number;
  // hold 专属
  endTime?: number;
  // mania 列号（由 x 计算）
  column?: number;
  newCombo?: boolean;
}
```

### 2.3 游戏引擎（`engine/`）

**GameEngine 基类**：
- 持有 Canvas 2D context、AudioContext、当前时间
- `loadBeatmap(beatmap, audioBlob)` → 预处理 hitObjects、创建音频源
- `start()` / `pause()` / `resume()` / `restart()`
- `loop(timestamp)` → requestAnimationFrame 循环
- 抽象方法（子类实现）：
  - `update(timeMs: number)`：判定窗口检查
  - `render()`：绘制
  - `onInput(type: InputType)`：处理输入

**Judger**：
- 三个时间窗口（基于 OverallDifficulty）：
  - 300 窗口：±50ms 内
  - 100 窗口：±100ms 内
  - 50 窗口：±150ms 内
  - 超出：Miss
- 维护 Combo、Score、Accuracy、最大 Combo

**4 种模式引擎**：
- `StandardEngine`：approach circle 缩放判定，slider 跟踪
- `TaikoEngine`：音符从右向左移动，到达判定圈时按对应键
- `CatchEngine`：水果自由落体（实际水平移动 + 透视），盘子在底部水平移动
- `ManiaEngine`：音符从下向上（或上向下）移动到判定线

### 2.4 输入处理

**触屏**：
- standard：单指 / 多指点击 Canvas 坐标
- taiko：左半屏 = 红色（Don），右半屏 = 蓝色（Katsu）
- catch：左右滑动 = 盘子移动
- mania：4 列触屏热区

**键盘**（桌面）：
- standard：鼠标点击 + 空格
- taiko：D / K（红 / 蓝）
- catch：← →
- mania：D F J K

### 2.5 状态管理（Zustand）

```typescript
interface GameState {
  // 设置
  settings: { theme: 'light'|'dark'; accent: string; volume: number; offset: number; };
  // 库存
  search: { query: string; results: BeatmapSet[]; loading: boolean; };
  downloadedSets: Map<number, BeatmapSet>; // 已下载并解析的谱面
  // 游戏
  currentGame: {
    beatmap: Beatmap | null;
    mode: GameMode;
    score: number;
    combo: number;
    maxCombo: number;
    accuracy: number;
    judgements: { '300': number; '100': number; '50': number; miss: number };
    status: 'idle' | 'playing' | 'paused' | 'finished';
  };
  // actions
  searchBeatmaps(query: string): Promise<void>;
  downloadSet(setId: number): Promise<void>;
  startGame(setId: number, mode: GameMode, diffIndex: number): Promise<void>;
  endGame(): void;
  updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
}
```

## 3. 关键流程

### 3.1 谱面下载与解析流程
```
用户点击下载
  ↓
fetch sayobot mini .osz (with progress)
  ↓
JSZip.loadAsync(arrayBuffer)
  ↓
遍历 entries：
  - *.osu → text → osuParser.parse()
  - *.mp3 / *.ogg → Blob URL 缓存
  - *.jpg / *.png → Blob URL 缓存（背景）
  ↓
BeatmapSet { id, beatmaps: Beatmap[], audioUrl, bgUrl }
  ↓
存入 store.downloadedSets
```

### 3.2 游戏循环
```
startGame()
  ↓
创建 Engine 实例（根据 mode 选择）
  ↓
engine.loadBeatmap(beatmap, audioBlob)
  ↓
engine.start() → AudioContext.start() + rAF 循环
  ↓
每帧：
  1. audio.currentTime 取当前时间
  2. update(timeMs) → 检查 hitObjects 是否在判定窗口
  3. render() → 清屏 + 绘制所有可见对象
  ↓
所有 hitObjects 处理完 → endGame() → 跳转结算页
```

## 4. 移动端优化

- **横屏锁定建议**：游戏页加 CSS `@media (orientation: portrait)` 提示用户旋转
- **触屏 300ms 延迟消除**：使用 `touchstart` 而非 `click`，CSS `touch-action: none` 防止滚动
- **DPI 适配**：Canvas `width = clientWidth * devicePixelRatio`
- **音频延迟补偿**：设置项提供 offset（-200ms ~ +200ms）调整判定时间
- **音频解码**：用 `AudioContext.decodeAudioData` 一次性解码，避免流式卡顿

## 5. 性能策略

- **离屏 Canvas 缓存**：approach circle、判定圈等静态图形预渲染
- **对象池**：HitObject 复用，避免 GC
- **可见性剔除**：只渲染屏幕内的对象
- **音频 seek 优化**：用 `AudioBufferSourceNode` 而非 `<audio>` 标签（更精确）
- **Web Worker**：.osu 解析放 Worker（大谱面可能上千对象）

## 6. 错误处理

- 下载失败：重试 1 次，仍失败显示 toast
- 解析失败：跳过该难度，提示用户
- 音频解码失败：无法开始游戏，提示
- 浏览器不支持 AudioContext：降级到 `<audio>` 标签（精度略差）

## 7. 部署

- 静态部署，无后端
- Vercel / Cloudflare Pages / GitHub Pages 均可
- 跨域问题：osu.direct 和 sayobot 都已支持 CORS（yuimusic 中已验证）
