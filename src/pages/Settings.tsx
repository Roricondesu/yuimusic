import {
  SlidersHorizontal,
  Music2,
  Info,
  Monitor,
  Headphones,
  Clock,
  Waves,
  Moon,
  Download,
  Shield,
  Github,
  Palette,
  Database,
  ChevronDown,
  Image as ImageIcon,
  Upload,
  Trash2,
  Maximize2,
  Activity,
  RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassSwitch } from "@/components/glass/GlassSwitch";
import { GlassSlider } from "@/components/glass/GlassSlider";
import {
  saveBackgroundImage,
  clearBackgroundImage,
} from "@/components/layout/Background";
import { ACCENTS } from "@/utils/accents";
import type { AppSettings, TrackSource } from "@/types";
import {
  pingAllSources,
  latencyLevel,
  type SourcePingResult,
} from "@/utils/sourceHealth";
import React, { memo, useEffect, useRef, useState } from "react";

type Scheme = "light" | "dark";

// 单一订阅点：顶层 Settings 只调用一次，再以 prop 形式向下传递，
// 避免每个 GlassSwitch/GlassSlider/GlassButton 各自订阅 theme 造成级联渲染。
const useScheme = (): Scheme => {
  const theme = useAppStore((s) => s.settings.theme);
  return theme === "dark" ? "dark" : "light";
};

const QUALITIES: AppSettings["quality"][] = ["low", "normal", "high"];
const QUALITY_LABELS: Record<AppSettings["quality"], string> = {
  low: "低",
  normal: "标准",
  high: "高",
};
const QUALITY_DESC: Record<AppSettings["quality"], string> = {
  low: "64 kbps · 省流量",
  normal: "128 kbps · 均衡",
  high: "256 kbps · 高清",
};

const EQ_PRESETS: { key: AppSettings["eqPreset"]; label: string; desc: string }[] = [
  { key: "flat", label: "平直", desc: "原声还原" },
  { key: "bass", label: "重低音", desc: "强化低频" },
  { key: "vocal", label: "人声", desc: "突出中频" },
  { key: "electronic", label: "电子", desc: "清晰高频" },
];

const SLEEP_OPTIONS = [0, 15, 30, 45, 60];

const SOURCE_OPTIONS: {
  key: AppSettings["preferredSource"];
  label: string;
  desc: string;
}[] = [
  { key: "mixed", label: "混源", desc: "6 源并行（Audius/Jamendo/osu!/IA/iTunes/Deezer），完整优先，中文搜索经 MusicBrainz 别名增强" },
  { key: "audius", label: "Audius", desc: "去中心化完整免费音乐" },
  { key: "jamendo", label: "Jamendo", desc: "独立音乐人 CC 授权完整音乐，需 client_id" },
  { key: "osu", label: "osu!", desc: "从 osu.direct 下载 .osz 并解压提取音频" },
  { key: "ia", label: "Internet Archive", desc: "公有领域老歌/现场录音/CC 内容" },
  { key: "deezer", label: "Deezer", desc: "欧洲版权音乐，30 秒试听" },
  { key: "itunes", label: "iTunes", desc: "主流版权音乐，30 秒试听" },
];

const LYRIC_SOURCE_OPTIONS: {
  key: AppSettings["lyricsSource"];
  label: string;
  desc: string;
}[] = [
  { key: "auto", label: "智能竞速", desc: "多源并行，先到先用（推荐）" },
  { key: "kugou", label: "酷狗音乐", desc: "中文歌词覆盖好，相对稳定" },
  { key: "netease", label: "网易云音乐", desc: "国内访问快，中文歌词覆盖好" },
  { key: "lrclib", label: "LRCLIB", desc: "海外开源歌词库，英文歌词好" },
];

// 所有布尔型设置项，供 SimpleSwitch 复用
type BooleanSettingKey =
  | "autoplay"
  | "gapless"
  | "spatialAudio"
  | "monoAudio"
  | "showSourceBadge"
  | "autoLoadLyrics"
  | "keepScreenOn"
  | "compactMode"
  | "miniPlayer"
  | "showVisualizer";

// 可折叠分组容器：header（图标 + 标题 + chevron）点击切换展开/收起。
// 关键性能优化：收起时真正卸载子树（GlassSwitch/GlassSlider 等重组件），
// 仅在展开时挂载，避免大量 liquid-glass 实例常驻导致整页卡顿。
// 使用 grid-template-rows 0fr/1fr 动画过渡高度；收起时延迟卸载以播放动画。
const CollapsibleSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  delay?: number;
  children: React.ReactNode;
}> = ({ icon, title, defaultOpen = false, delay = 1, children }) => {
  // open：视觉高度状态；render：子树是否挂载
  const [open, setOpen] = useState(defaultOpen);
  const [render, setRender] = useState(defaultOpen);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = () => {
    if (open) {
      // 收起：先动画收起高度，结束后再卸载子树
      setOpen(false);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => setRender(false), 320);
    } else {
      // 展开：先挂载子树（高度 0fr），下一帧再展开到 1fr 触发过渡
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true));
      });
    }
  };

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  return (
    <section className={`animate-enter animate-enter-${delay}`}>
      <div className="solid-card p-5">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggle();
            }
          }}
          className="flex w-full items-center justify-between"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--text-secondary)" }}>{icon}</span>
            <h2 className="text-base font-semibold md:text-lg" style={{ color: "var(--text-primary)" }}>
              {title}
            </h2>
          </div>
          <ChevronDown
            size={18}
            style={{
              color: "var(--text-secondary)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.3s ease",
            }}
          />
        </div>
        <div
          className="grid transition-all duration-300 ease-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            {render && <div className="mt-4">{children}</div>}
          </div>
        </div>
      </div>
    </section>
  );
};

// === 外观 ===
// ThemeToggle 是主题切换器本身，保持对 theme 的订阅。
const ThemeToggle = memo(function ThemeToggle() {
  const theme = useAppStore((s) => s.settings.theme);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const scheme = theme === "dark" ? "dark" : "light";
  return (
    <GlassSwitch
      checked={theme === "dark"}
      onCheckedChange={(checked) => updateSetting("theme", checked ? "dark" : "light")}
      scheme={scheme}
      ariaLabel="切换深色主题"
    />
  );
});

const AccentPicker = memo(function AccentPicker() {
  const accent = useAppStore((s) => s.settings.accent);
  const setAccent = useAppStore((s) => s.setAccent);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Palette size={14} style={{ color: "var(--text-secondary)" }} />
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>主题色</div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          · {ACCENTS.find((a) => a.key === accent)?.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {ACCENTS.map((a) => {
          const selected = accent === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setAccent(a.key)}
              className="transition-transform hover:scale-110 active:scale-95"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: a.color,
                border: selected ? "3px solid var(--text-primary)" : "3px solid transparent",
                cursor: "pointer",
                boxShadow: selected ? `0 0 0 2px ${a.color}40` : "none",
              }}
              aria-label={a.label}
              title={a.label}
            />
          );
        })}
      </div>
    </div>
  );
});

const MotionToggle = memo(function MotionToggle({ scheme }: { scheme: Scheme }) {
  const reduceMotion = useAppStore((s) => s.settings.reduceMotion);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <GlassSwitch
      checked={reduceMotion}
      onCheckedChange={(checked) => updateSetting("reduceMotion", checked)}
      scheme={scheme}
      ariaLabel="减少动态效果"
    />
  );
});

const LyricsToggle = memo(function LyricsToggle({ scheme }: { scheme: Scheme }) {
  const showLyrics = useAppStore((s) => s.settings.showLyrics);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <GlassSwitch
      checked={showLyrics}
      onCheckedChange={(checked) => updateSetting("showLyrics", checked)}
      scheme={scheme}
      ariaLabel="显示歌词"
    />
  );
});

const SplashDurationSlider = memo(function SplashDurationSlider({ scheme }: { scheme: Scheme }) {
  const value = useAppStore((s) => s.settings.splashDuration);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>启动页时长</div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {(value / 1000).toFixed(1)} 秒
        </span>
      </div>
      <div className="py-1">
        <GlassSlider
          value={value}
          onValueChange={(v) => updateSetting("splashDuration", v)}
          min={1000}
          max={4000}
          step={200}
          thumbHeight={18}
          thumbWidth={18}
          height={5}
          rubberOvershoot={0.02}
          scheme={scheme}
          ariaLabel="启动页时长"
        />
      </div>
    </div>
  );
});

const AppearanceSection = memo(function AppearanceSection({ scheme }: { scheme: Scheme }) {
  return (
    <CollapsibleSection icon={<Monitor size={18} />} title="外观" delay={2}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>深色主题</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>在浅色与深色界面间切换</div>
          </div>
          <ThemeToggle />
        </div>
        <AccentPicker />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>减少动态效果</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>关闭背景漂浮动画</div>
          </div>
          <MotionToggle scheme={scheme} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>显示歌词</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>在播放页自动加载歌词</div>
          </div>
          <LyricsToggle scheme={scheme} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>显示来源徽标</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>在曲目标签上展示来源</div>
          </div>
          <SimpleSwitch settingKey="showSourceBadge" scheme={scheme} ariaLabel="显示来源徽标" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>自动加载歌词</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>进入播放页时自动获取歌词</div>
          </div>
          <SimpleSwitch settingKey="autoLoadLyrics" scheme={scheme} ariaLabel="自动加载歌词" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>紧凑模式</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>缩小卡片间距与内边距</div>
          </div>
          <SimpleSwitch settingKey="compactMode" scheme={scheme} ariaLabel="紧凑模式" />
        </div>
        <SplashDurationSlider scheme={scheme} />
      </div>
    </CollapsibleSection>
  );
});

// === 通用数字滑块（背景 / 界面分组共用） ===
const NumberSlider = memo(function NumberSlider({
  settingKey,
  label,
  min,
  max,
  step,
  unit,
  scheme,
}: {
  settingKey: keyof AppSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  scheme: Scheme;
}) {
  const value = useAppStore((s) => s.settings[settingKey] as number);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {step < 1 ? value.toFixed(2) : Math.round(value)}{unit}
        </span>
      </div>
      <div className="py-1">
        <GlassSlider
          value={value}
          onValueChange={(v) => updateSetting(settingKey, v as never)}
          min={min}
          max={max}
          step={step}
          thumbHeight={18}
          thumbWidth={18}
          height={5}
          rubberOvershoot={0.02}
          scheme={scheme}
          ariaLabel={label}
        />
      </div>
    </div>
  );
});

// 通用颜色选择器
const ColorField = memo(function ColorField({
  label,
  settingKey,
}: {
  label: string;
  settingKey: keyof AppSettings;
}) {
  const value = useAppStore((s) => s.settings[settingKey] as string);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{value.toUpperCase()}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => updateSetting(settingKey, e.target.value as never)}
          style={{
            width: 36,
            height: 28,
            border: "1px solid var(--border)",
            borderRadius: 8,
            cursor: "pointer",
            background: "transparent",
            padding: 0,
          }}
          aria-label={label}
        />
      </div>
    </div>
  );
});

// === 背景 ===
const BACKGROUND_MODES: { key: AppSettings["backgroundMode"]; label: string; desc: string }[] = [
  { key: "default", label: "默认", desc: "渐变光斑" },
  { key: "image", label: "图片", desc: "自定义上传" },
  { key: "gradient", label: "渐变", desc: "双色渐变" },
  { key: "solid", label: "纯色", desc: "单色背景" },
];

const BackgroundImageUploader = memo(function BackgroundImageUploader() {
  const updateSetting = useAppStore((s) => s.updateSetting);
  const nonce = useAppStore((s) => s.settings.backgroundImageNonce);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      await saveBackgroundImage(file);
      updateSetting("backgroundMode", "image");
      updateSetting("backgroundImageNonce", nonce + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>背景图片</div>
        {busy && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>处理中…</span>}
      </div>
      <div className="flex gap-2">
        <label
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          <Upload size={14} />
          上传图片
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={async () => {
            await clearBackgroundImage();
            updateSetting("backgroundMode", "default");
            updateSetting("backgroundImageNonce", nonce + 1);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          <Trash2 size={14} />
          清除
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        建议高分辨率宽屏图片。图片仅存本地，不上传服务器。
      </p>
    </div>
  );
});

const BackgroundSection = memo(function BackgroundSection({ scheme }: { scheme: Scheme }) {
  const mode = useAppStore((s) => s.settings.backgroundMode);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <CollapsibleSection icon={<ImageIcon size={18} />} title="背景" delay={3}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>背景模式</div>
          <div className="grid grid-cols-2 gap-2">
            {BACKGROUND_MODES.map((opt) => {
              const active = mode === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => updateSetting("backgroundMode", opt.key)}
                  className="rounded-lg px-3 py-2.5 text-left transition-colors"
                  style={{
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    background: active ? "var(--accent-soft)" : "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{opt.label}</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {mode === "image" && (
          <>
            <BackgroundImageUploader />
            <NumberSlider settingKey="backgroundBlur" label="模糊" min={0} max={40} step={1} unit="px" scheme={scheme} />
            <NumberSlider settingKey="backgroundScale" label="缩放" min={100} max={130} step={1} unit="%" scheme={scheme} />
          </>
        )}

        {mode === "gradient" && (
          <>
            <ColorField label="起始色" settingKey="backgroundGradientFrom" />
            <ColorField label="结束色" settingKey="backgroundGradientTo" />
            <NumberSlider settingKey="backgroundGradientAngle" label="角度" min={0} max={360} step={15} unit="°" scheme={scheme} />
          </>
        )}

        {mode === "solid" && <ColorField label="背景颜色" settingKey="backgroundSolid" />}

        {(mode === "image" || mode === "gradient" || mode === "solid") && (
          <NumberSlider settingKey="backgroundDim" label="变暗" min={0} max={0.8} step={0.05} unit="" scheme={scheme} />
        )}
      </div>
    </CollapsibleSection>
  );
});

// === 界面 ===
const SCROLLBAR_OPTIONS: { key: AppSettings["scrollbarStyle"]; label: string }[] = [
  { key: "auto", label: "默认" },
  { key: "thin", label: "细窄" },
  { key: "hidden", label: "隐藏" },
];

const InterfaceSection = memo(function InterfaceSection({ scheme }: { scheme: Scheme }) {
  const scrollbarStyle = useAppStore((s) => s.settings.scrollbarStyle);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <CollapsibleSection icon={<Maximize2 size={18} />} title="界面" delay={4}>
      <div className="flex flex-col gap-4">
        <NumberSlider settingKey="uiScale" label="界面缩放" min={0.85} max={1.15} step={0.01} unit="×" scheme={scheme} />
        <NumberSlider settingKey="cardOpacity" label="卡片不透明度" min={0.6} max={1} step={0.02} unit="" scheme={scheme} />
        <NumberSlider settingKey="coverRadius" label="封面圆角" min={0} max={24} step={1} unit="px" scheme={scheme} />

        <div>
          <div className="mb-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>滚动条样式</div>
          <div className="flex gap-1.5">
            {SCROLLBAR_OPTIONS.map((opt) => {
              const active = scrollbarStyle === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => updateSetting("scrollbarStyle", opt.key)}
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                  style={{
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    background: active ? "var(--accent-soft)" : "var(--surface)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>迷你播放栏</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>缩小底部播放栏高度（开发中）</div>
          </div>
          <SimpleSwitch settingKey="miniPlayer" scheme={scheme} ariaLabel="迷你播放栏" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>音波可视化</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>播放时显示音波动画（开发中）</div>
          </div>
          <SimpleSwitch settingKey="showVisualizer" scheme={scheme} ariaLabel="音波可视化" />
        </div>
      </div>
    </CollapsibleSection>
  );
});

// === 音乐来源 ===
const SourceSection = memo(function SourceSection({ scheme }: { scheme: Scheme }) {
  const preferredSource = useAppStore((s) => s.settings.preferredSource);
  const jamendoClientId = useAppStore((s) => s.settings.jamendoClientId);
  const defaultQuery = useAppStore((s) => s.settings.defaultQuery);
  const osuMirror = useAppStore((s) => s.settings.osuMirror);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const setLibrarySource = useAppStore((s) => s.setLibrarySource);

  const handleSourceChange = (key: AppSettings["preferredSource"]) => {
    updateSetting("preferredSource", key);
    setLibrarySource(key);
  };

  return (
    <CollapsibleSection icon={<Database size={18} />} title="音乐来源" delay={2}>
      <div className="flex flex-col gap-2">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSourceChange(opt.key)}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors"
            style={{
              border: "1px solid",
              borderColor: preferredSource === opt.key ? "var(--accent)" : "transparent",
              background: preferredSource === opt.key ? "var(--accent-soft)" : "transparent",
              cursor: "pointer",
            }}
          >
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{opt.label}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{opt.desc}</div>
            </div>
            {preferredSource === opt.key && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Jamendo client_id</div>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {jamendoClientId ? "已填写" : "使用默认测试 key"}
          </span>
        </div>
        <input
          type="text"
          value={jamendoClientId}
          onChange={(e) => updateSetting("jamendoClientId", e.target.value)}
          placeholder="在 devportal.jamendo.com 注册后获取"
          className="w-full rounded-lg border-none px-3 py-2 text-sm outline-none"
          style={{ background: "rgba(128,128,128,0.08)", color: "var(--text-primary)" }}
        />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          混源模式下 Jamendo 会补充 CC 授权完整曲目。默认测试 key 可能已被暂停，建议填写自己的 key。
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>默认搜索词</div>
        <input
          type="text"
          value={defaultQuery}
          onChange={(e) => updateSetting("defaultQuery", e.target.value)}
          placeholder="留空则默认搜索 pop"
          className="w-full rounded-lg border-none px-3 py-2 text-sm outline-none"
          style={{ background: "rgba(128,128,128,0.08)", color: "var(--text-primary)" }}
        />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          打开曲库时自动搜索的关键词，留空则使用“pop”。
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>osu! 下载镜像</div>
        <div className="flex gap-2">
          {([
            { key: "sayobot", label: "Sayobot（国内）", desc: "mini 版，体积最小，CDN 加速" },
            { key: "osu.direct", label: "osu.direct（海外）", desc: "海外节点" },
          ] as const).map((opt) => {
            const active = osuMirror === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => updateSetting("osuMirror", opt.key)}
                className="flex-1 rounded-lg px-3 py-2.5 text-left transition-colors"
                style={{
                  border: "1px solid",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div className="text-xs font-medium" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                  {opt.label}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          搜索始终通过 osu.direct（支持跨域），下载谱面时可选择更快的镜像。推荐国内用户使用 Sayobot。
        </p>
      </div>
    </CollapsibleSection>
  );
});

// === 来源连接延迟检测 ===
const ALL_PING_SOURCES: TrackSource[] = [
  "audius",
  "jamendo",
  "osu",
  "ia",
  "itunes",
  "deezer",
];

const SOURCE_LABEL: Record<TrackSource, string> = {
  itunes: "iTunes",
  audius: "Audius",
  jamendo: "Jamendo",
  osu: "osu!",
  ia: "Internet Archive",
  deezer: "Deezer",
};

const SourceHealthSection = memo(function SourceHealthSection({ scheme }: { scheme: Scheme }) {
  const [results, setResults] = useState<Partial<Record<TrackSource, SourcePingResult>>>(
    () => ({}),
  );
  const [testing, setTesting] = useState(false);
  const [done, setDone] = useState(false);

  const runTest = async () => {
    setTesting(true);
    setDone(false);
    setResults({});
    await pingAllSources(ALL_PING_SOURCES, (r) => {
      setResults((prev) => ({ ...prev, [r.source]: r }));
    });
    setTesting(false);
    setDone(true);
  };

  return (
    <CollapsibleSection icon={<Activity size={18} />} title="来源连接检测" delay={3}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            测量各来源 API 的连接延迟（RTT），判断当前网络下的可用性与速度。
          </p>
          <button
            onClick={runTest}
            disabled={testing}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
            style={{
              border: "1px solid var(--accent)",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              cursor: testing ? "wait" : "pointer",
              opacity: testing ? 0.6 : 1,
            }}
            aria-label="开始检测"
          >
            <RefreshCw size={13} className={testing ? "animate-spin" : ""} />
            {testing ? "检测中…" : done ? "重新检测" : "开始检测"}
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {ALL_PING_SOURCES.map((src) => {
            const r = results[src];
            const level = latencyLevel(r?.latency ?? null);
            return (
              <div
                key={src}
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ background: "rgba(128,128,128,0.06)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: r ? level.color : "var(--text-secondary)",
                      opacity: r ? 1 : 0.4,
                      transition: "background 0.3s",
                    }}
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {SOURCE_LABEL[src]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {testing && !r && (
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      等待…
                    </span>
                  )}
                  {r && (
                    <>
                      <span
                        className="text-xs font-medium"
                        style={{ color: level.color }}
                      >
                        {level.label}
                      </span>
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--text-secondary)", minWidth: 56, textAlign: "right" }}
                      >
                        {r.latency != null ? `${r.latency} ms` : r.error || "失败"}
                      </span>
                    </>
                  )}
                  {!testing && !r && !done && (
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      未检测
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {done && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            延迟等级：<span style={{ color: "#22c55e" }}>●</span> 优秀 (&lt;500ms) ·
            <span style={{ color: "#eab308" }}> ●</span> 正常 (&lt;1500ms) ·
            <span style={{ color: "#f97316" }}> ●</span> 较慢 (≥1500ms) ·
            <span style={{ color: "#ef4444" }}> ●</span> 不可达
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
});

// === 播放 ===
const VolumeLimitSlider = memo(function VolumeLimitSlider({ scheme }: { scheme: Scheme }) {
  const value = useAppStore((s) => s.settings.volumeLimit);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>音量限制</div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="py-1">
        <GlassSlider
          value={Math.round(value * 100)}
          onValueChange={(v) => updateSetting("volumeLimit", v / 100)}
          min={0}
          max={100}
          step={1}
          thumbHeight={18}
          thumbWidth={18}
          height={5}
          rubberOvershoot={0.02}
          scheme={scheme}
          ariaLabel="音量限制"
        />
      </div>
    </div>
  );
});

const CrossfadeSlider = memo(function CrossfadeSlider({ scheme }: { scheme: Scheme }) {
  const value = useAppStore((s) => s.settings.crossfade);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>交叉淡化</div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {value} 秒
        </span>
      </div>
      <div className="py-1">
        <GlassSlider
          value={value}
          onValueChange={(v) => updateSetting("crossfade", v)}
          min={0}
          max={12}
          step={1}
          thumbHeight={18}
          thumbWidth={18}
          height={5}
          rubberOvershoot={0.02}
          scheme={scheme}
          ariaLabel="交叉淡化时长"
        />
      </div>
    </div>
  );
});

const BassBoostSlider = memo(function BassBoostSlider({ scheme }: { scheme: Scheme }) {
  const value = useAppStore((s) => s.settings.bassBoost);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>低音增强</div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          +{value} dB
        </span>
      </div>
      <div className="py-1">
        <GlassSlider
          value={value}
          onValueChange={(v) => updateSetting("bassBoost", v)}
          min={0}
          max={12}
          step={1}
          thumbHeight={18}
          thumbWidth={18}
          height={5}
          rubberOvershoot={0.02}
          scheme={scheme}
          ariaLabel="低音增强"
        />
      </div>
    </div>
  );
});

const PlaybackSpeedSlider = memo(function PlaybackSpeedSlider({ scheme }: { scheme: Scheme }) {
  const value = useAppStore((s) => s.settings.playbackSpeed);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>播放速度</div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {value.toFixed(2)}x
        </span>
      </div>
      <div className="py-1">
        <GlassSlider
          value={value * 100}
          onValueChange={(v) => updateSetting("playbackSpeed", v / 100)}
          min={50}
          max={200}
          step={5}
          thumbHeight={18}
          thumbWidth={18}
          height={5}
          rubberOvershoot={0.02}
          scheme={scheme}
          ariaLabel="播放速度"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--text-secondary)" }}>
        <span>0.5x</span>
        <span>1.0x</span>
        <span>2.0x</span>
      </div>
    </div>
  );
});

const SimpleSwitch = memo(function SimpleSwitch({
  settingKey,
  scheme,
  ariaLabel,
}: {
  settingKey: BooleanSettingKey;
  scheme: Scheme;
  ariaLabel: string;
}) {
  const value = useAppStore((s) => s.settings[settingKey]);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <GlassSwitch
      checked={value as boolean}
      onCheckedChange={(checked) => updateSetting(settingKey, checked)}
      scheme={scheme}
      ariaLabel={ariaLabel}
    />
  );
});

const LyricFontSizeSelector = memo(function LyricFontSizeSelector() {
  const size = useAppStore((s) => s.settings.lyricFontSize);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const labels = { small: "小", medium: "中", large: "大" };
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>歌词字号</div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>调整播放页歌词大小</div>
      </div>
      <div className="flex gap-1.5">
        {(["small", "medium", "large"] as const).map((s) => {
          const active = size === s;
          return (
            <button
              key={s}
              onClick={() => updateSetting("lyricFontSize", s)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                border: "1px solid",
                borderColor: active ? "var(--accent)" : "transparent",
                background: active ? "var(--accent-soft)" : "rgba(128,128,128,0.08)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {labels[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
});

const LyricEffectSelector = memo(function LyricEffectSelector() {
  const effect = useAppStore((s) => s.settings.lyricEffect);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const labels = { none: "无", blur: "模糊", fade: "淡出" };
  const desc = {
    none: "普通列表样式",
    blur: "非当前行轻微模糊",
    fade: "非当前行逐渐透明",
  };
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>歌词效果</div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{desc[effect]}</div>
      </div>
      <div className="flex gap-1.5">
        {(["none", "blur", "fade"] as const).map((e) => {
          const active = effect === e;
          return (
            <button
              key={e}
              onClick={() => updateSetting("lyricEffect", e)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                border: "1px solid",
                borderColor: active ? "var(--accent)" : "transparent",
                background: active ? "var(--accent-soft)" : "rgba(128,128,128,0.08)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {labels[e]}
            </button>
          );
        })}
      </div>
    </div>
  );
});

const LyricsSourceSelector = memo(function LyricsSourceSelector() {
  const source = useAppStore((s) => s.settings.lyricsSource);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>歌词来源</div>
      <div className="flex gap-2">
        {LYRIC_SOURCE_OPTIONS.map((opt) => {
          const active = source === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => updateSetting("lyricsSource", opt.key)}
              className="flex-1 rounded-lg px-3 py-2.5 text-left transition-colors"
              style={{
                border: "1px solid",
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "var(--accent-soft)" : "transparent",
                cursor: "pointer",
              }}
            >
              <div className="text-xs font-medium" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                {opt.label}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        智能竞速模式同时请求多个歌词源，先返回有效歌词的源胜出，并缓存到本地避免重复请求。
      </p>
    </div>
  );
});

const LYRIC_LANGUAGE_OPTIONS: { key: AppSettings["lyricLanguage"]; label: string; desc: string }[] = [
  { key: "original", label: "原文", desc: "仅显示原语言歌词" },
  { key: "translation", label: "译文", desc: "仅显示翻译歌词" },
  { key: "bilingual", label: "双语", desc: "原文 + 译文合并" },
];

const LyricLanguageSelector = memo(function LyricLanguageSelector() {
  const language = useAppStore((s) => s.settings.lyricLanguage);
  const switchLyricLanguage = useAppStore((s) => s.switchLyricLanguage);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>歌词语言</div>
      <div className="flex gap-2">
        {LYRIC_LANGUAGE_OPTIONS.map((opt) => {
          const active = language === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => {
                updateSetting("lyricLanguage", opt.key);
                // 即时应用到当前已加载的歌词
                switchLyricLanguage(opt.key);
              }}
              className="flex-1 rounded-lg px-3 py-2 text-left transition-colors"
              style={{
                border: "1px solid",
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "var(--accent-soft)" : "transparent",
                cursor: "pointer",
              }}
            >
              <div className="text-xs font-medium" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                {opt.label}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        译文来自网易云翻译歌词（tlyric）。双语模式按时间戳对齐合并。
      </p>
    </div>
  );
});

const LyricOffsetSlider = memo(function LyricOffsetSlider({ scheme }: { scheme: Scheme }) {
  const value = useAppStore((s) => s.settings.lyricOffset);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>歌词时间偏移</div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {value > 0 ? `+${value}` : value} ms
        </span>
      </div>
      <div className="py-1">
        <GlassSlider
          value={value}
          onValueChange={(v) => updateSetting("lyricOffset", v)}
          min={-3000}
          max={3000}
          step={100}
          thumbHeight={18}
          thumbWidth={18}
          height={5}
          rubberOvershoot={0.02}
          scheme={scheme}
          ariaLabel="歌词时间偏移"
        />
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        正值延后显示，负值提前显示。用于歌词与音频不同步时微调。
      </p>
    </div>
  );
});

const LyricSourceBadgeToggle = memo(function LyricSourceBadgeToggle({ scheme }: { scheme: Scheme }) {
  const showLyricSource = useAppStore((s) => s.settings.showLyricSource);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>显示歌词来源</div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>在播放页展示歌词来源标签</div>
      </div>
      <GlassSwitch
        checked={showLyricSource}
        onCheckedChange={(checked) => updateSetting("showLyricSource", checked)}
        scheme={scheme}
        ariaLabel="显示歌词来源"
      />
    </div>
  );
});

const PlaybackSection = memo(function PlaybackSection({ scheme }: { scheme: Scheme }) {
  return (
    <CollapsibleSection icon={<Headphones size={18} />} title="播放" delay={3}>
      <div className="flex flex-col gap-5">
        <VolumeLimitSlider scheme={scheme} />
        <CrossfadeSlider scheme={scheme} />
        <BassBoostSlider scheme={scheme} />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>自动播放</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>播放结束后自动播放下一首</div>
          </div>
          <SimpleSwitch settingKey="autoplay" scheme={scheme} ariaLabel="自动播放" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>无缝播放</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>消除歌曲之间的间隙</div>
          </div>
          <SimpleSwitch settingKey="gapless" scheme={scheme} ariaLabel="无缝播放" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>空间音频</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>模拟环绕立体声效果</div>
          </div>
          <SimpleSwitch settingKey="spatialAudio" scheme={scheme} ariaLabel="空间音频" />
        </div>
        <PlaybackSpeedSlider scheme={scheme} />
        <LyricFontSizeSelector />
        <LyricEffectSelector />
        <LyricsSourceSelector />
        <LyricLanguageSelector />
        <LyricOffsetSlider scheme={scheme} />
        <LyricSourceBadgeToggle scheme={scheme} />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>单声道播放</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>变速时保持音高不变</div>
          </div>
          <SimpleSwitch settingKey="monoAudio" scheme={scheme} ariaLabel="单声道播放" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>屏幕常亮</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>播放时保持屏幕常亮</div>
          </div>
          <SimpleSwitch settingKey="keepScreenOn" scheme={scheme} ariaLabel="屏幕常亮" />
        </div>
      </div>
    </CollapsibleSection>
  );
});

// === 音质 ===
const QualitySection = memo(function QualitySection({ scheme }: { scheme: Scheme }) {
  const quality = useAppStore((s) => s.settings.quality);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <CollapsibleSection icon={<Waves size={18} />} title="流媒体音质" delay={4}>
      <div className="flex flex-col gap-2">
        {QUALITIES.map((q) => (
          <button
            key={q}
            onClick={() => updateSetting("quality", q)}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors"
            style={{
              border: "1px solid",
              borderColor: quality === q ? "var(--accent)" : "transparent",
              background: quality === q ? "var(--accent-soft)" : "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{QUALITY_LABELS[q]}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{QUALITY_DESC[q]}</div>
            </div>
            {quality === q && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
            )}
          </button>
        ))}
      </div>
    </CollapsibleSection>
  );
});

// === 均衡器 ===
const EQSection = memo(function EQSection({ scheme }: { scheme: Scheme }) {
  const eqPreset = useAppStore((s) => s.settings.eqPreset);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <CollapsibleSection icon={<SlidersHorizontal size={18} />} title="均衡器" delay={4}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EQ_PRESETS.map((preset) => (
          <GlassButton
            key={preset.key}
            scheme={scheme}
            active={eqPreset === preset.key}
            onClick={() => updateSetting("eqPreset", preset.key)}
            style={{ flexDirection: "column", gap: 2, padding: "12px 8px" }}
          >
            <Music2 size={16} />
            <span>{preset.label}</span>
            <span className="text-[10px] font-normal opacity-60">{preset.desc}</span>
          </GlassButton>
        ))}
      </div>
    </CollapsibleSection>
  );
});

// === 定时关闭 ===
const SleepSection = memo(function SleepSection({ scheme }: { scheme: Scheme }) {
  const sleepTimer = useAppStore((s) => s.settings.sleepTimer);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <CollapsibleSection icon={<Moon size={18} />} title="定时关闭" delay={5}>
      <div className="flex flex-wrap gap-2">
        {SLEEP_OPTIONS.map((min) => (
          <GlassButton
            key={min}
            scheme={scheme}
            active={sleepTimer === min}
            onClick={() => updateSetting("sleepTimer", min)}
          >
            <Clock size={14} />
            {min === 0 ? "关闭" : `${min} 分钟`}
          </GlassButton>
        ))}
      </div>
    </CollapsibleSection>
  );
});

// === 下载与缓存 ===
const DownloadSection = memo(function DownloadSection({ scheme }: { scheme: Scheme }) {
  return (
    <CollapsibleSection icon={<Download size={18} />} title="下载与缓存" delay={5}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "rgba(128,128,128,0.06)" }}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>已下载内容</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>0 MB · 0 首歌曲</div>
          </div>
          <button
            className="text-xs font-medium"
            style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
          >
            清除
          </button>
        </div>
        <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "rgba(128,128,128,0.06)" }}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>播放缓存</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>12.4 MB</div>
          </div>
          <button
            className="text-xs font-medium"
            style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
          >
            清除
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
});

// === 关于 ===
const AboutSection = memo(function AboutSection({ scheme }: { scheme: Scheme }) {
  return (
    <CollapsibleSection icon={<Info size={18} />} title="关于" delay={5}>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>版本</span><span style={{ color: "var(--text-primary)" }}>0.2.0</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>玻璃引擎</span><span style={{ color: "var(--text-primary)" }}>@samasante/liquid-glass</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>音乐来源</span><span style={{ color: "var(--text-primary)" }}>Audius · iTunes · Jamendo · osu! · Internet Archive · Deezer</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>元数据增强</span><span style={{ color: "var(--text-primary)" }}>MusicBrainz</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>歌词来源</span><span style={{ color: "var(--text-primary)" }}>LRCLIB · 网易云音乐 · 酷狗音乐</span></div>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div>引用与文档：</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[
            { label: "Audius API", href: "https://docs.audius.org/developers/api/rest-api" },
            { label: "iTunes Search API", href: "https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html" },
            { label: "MusicBrainz API", href: "https://musicbrainz.org/doc/MusicBrainz_API" },
            { label: "Jamendo API", href: "https://developer.jamendo.com/v3.0/docs" },
            { label: "osu.direct", href: "https://osu.direct" },
            { label: "Internet Archive", href: "https://archive.org" },
            { label: "Deezer API", href: "https://developers.deezer.com/api" },
            { label: "LRCLIB", href: "https://lrclib.net/" },
          ].map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <GlassButton scheme={scheme} style={{ flex: 1 }}><Github size={14} />源码</GlassButton>
        <GlassButton scheme={scheme} style={{ flex: 1 }}><Shield size={14} />隐私政策</GlassButton>
      </div>
    </CollapsibleSection>
  );
});

export default function Settings() {
  // 顶层只订阅一次 theme，派生 scheme 后向下传递，避免子组件各自订阅。
  const scheme = useScheme();
  return (
    <div className="flex flex-col gap-5">
      <section className="animate-enter animate-enter-1">
        <div className="solid-card p-5 md:p-6">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl" style={{ color: "var(--text-primary)" }}>
            设置
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            自定义你的聆听体验
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-5">
          <AppearanceSection scheme={scheme} />
          <BackgroundSection scheme={scheme} />
          <InterfaceSection scheme={scheme} />
          <PlaybackSection scheme={scheme} />
          <QualitySection scheme={scheme} />
          <EQSection scheme={scheme} />
        </div>
        <div className="flex flex-col gap-5">
          <SourceSection scheme={scheme} />
          <SourceHealthSection scheme={scheme} />
          <SleepSection scheme={scheme} />
          <DownloadSection scheme={scheme} />
          <AboutSection scheme={scheme} />
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
