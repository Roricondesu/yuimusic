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
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassSwitch } from "@/components/glass/GlassSwitch";
import { GlassSlider } from "@/components/glass/GlassSlider";
import { ACCENTS } from "@/utils/accents";
import type { AppSettings } from "@/types";
import React, { memo } from "react";

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
  { key: "mixed", label: "混源", desc: "Audius + iTunes + Jamendo + osu! 并行，完整优先，中文搜索经 MusicBrainz 别名增强" },
  { key: "audius", label: "Audius", desc: "完整免费音乐" },
  { key: "jamendo", label: "Jamendo", desc: "独立音乐人 CC 授权完整音乐，需 client_id" },
  { key: "osu", label: "osu!", desc: "从 osu.direct 下载 .osz 并解压提取音频" },
  { key: "itunes", label: "iTunes", desc: "版权 30 秒试听" },
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

const SectionCard: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 1,
}) => (
  <section className={`animate-enter animate-enter-${delay}`}>
    <div className="solid-card p-5">{children}</div>
  </section>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="mb-4 flex items-center gap-2">
    <span style={{ color: "var(--text-secondary)" }}>{icon}</span>
    <h2 className="text-base font-semibold md:text-lg" style={{ color: "var(--text-primary)" }}>
      {title}
    </h2>
  </div>
);

// === 外观 ===
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

const MotionToggle = memo(function MotionToggle() {
  const reduceMotion = useAppStore((s) => s.settings.reduceMotion);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
  return (
    <GlassSwitch
      checked={reduceMotion}
      onCheckedChange={(checked) => updateSetting("reduceMotion", checked)}
      scheme={scheme}
      ariaLabel="减少动态效果"
    />
  );
});

const LyricsToggle = memo(function LyricsToggle() {
  const showLyrics = useAppStore((s) => s.settings.showLyrics);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
  return (
    <GlassSwitch
      checked={showLyrics}
      onCheckedChange={(checked) => updateSetting("showLyrics", checked)}
      scheme={scheme}
      ariaLabel="显示歌词"
    />
  );
});

const AppearanceSection = memo(function AppearanceSection() {
  return (
    <SectionCard delay={2}>
      <SectionHeader icon={<Monitor size={18} />} title="外观" />
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
          <MotionToggle />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>显示歌词</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>在播放页自动加载歌词</div>
          </div>
          <LyricsToggle />
        </div>
      </div>
    </SectionCard>
  );
});

// === 音乐来源 ===
const SourceSection = memo(function SourceSection() {
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
    <SectionCard delay={2}>
      <SectionHeader icon={<Database size={18} />} title="音乐来源" />
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
          打开曲库时自动搜索的关键词，留空则使用"pop"。
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
    </SectionCard>
  );
});

// === 播放 ===
const VolumeLimitSlider = memo(function VolumeLimitSlider() {
  const value = useAppStore((s) => s.settings.volumeLimit);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
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

const CrossfadeSlider = memo(function CrossfadeSlider() {
  const value = useAppStore((s) => s.settings.crossfade);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
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

const BassBoostSlider = memo(function BassBoostSlider() {
  const value = useAppStore((s) => s.settings.bassBoost);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
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

const PlaybackSpeedSlider = memo(function PlaybackSpeedSlider() {
  const value = useAppStore((s) => s.settings.playbackSpeed);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
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
  ariaLabel,
}: {
  settingKey: "autoplay" | "gapless" | "spatialAudio" | "monoAudio";
  ariaLabel: string;
}) {
  const value = useAppStore((s) => s.settings[settingKey]);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
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

const PlaybackSection = memo(function PlaybackSection() {
  return (
    <SectionCard delay={3}>
      <SectionHeader icon={<Headphones size={18} />} title="播放" />
      <div className="flex flex-col gap-5">
        <VolumeLimitSlider />
        <CrossfadeSlider />
        <BassBoostSlider />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>自动播放</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>播放结束后自动播放下一首</div>
          </div>
          <SimpleSwitch settingKey="autoplay" ariaLabel="自动播放" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>无缝播放</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>消除歌曲之间的间隙</div>
          </div>
          <SimpleSwitch settingKey="gapless" ariaLabel="无缝播放" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>空间音频</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>模拟环绕立体声效果</div>
          </div>
          <SimpleSwitch settingKey="spatialAudio" ariaLabel="空间音频" />
        </div>
        <PlaybackSpeedSlider />
        <LyricFontSizeSelector />
        <LyricEffectSelector />
        <LyricsSourceSelector />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>单声道播放</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>变速时保持音高不变</div>
          </div>
          <SimpleSwitch settingKey="monoAudio" ariaLabel="单声道播放" />
        </div>
      </div>
    </SectionCard>
  );
});

// === 音质 ===
const QualitySection = memo(function QualitySection() {
  const quality = useAppStore((s) => s.settings.quality);
  const updateSetting = useAppStore((s) => s.updateSetting);
  return (
    <SectionCard delay={4}>
      <SectionHeader icon={<Waves size={18} />} title="流媒体音质" />
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
    </SectionCard>
  );
});

// === 均衡器 ===
const EQSection = memo(function EQSection() {
  const eqPreset = useAppStore((s) => s.settings.eqPreset);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
  return (
    <SectionCard delay={4}>
      <SectionHeader icon={<SlidersHorizontal size={18} />} title="均衡器" />
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
    </SectionCard>
  );
});

// === 定时关闭 ===
const SleepSection = memo(function SleepSection() {
  const sleepTimer = useAppStore((s) => s.settings.sleepTimer);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
  return (
    <SectionCard delay={5}>
      <SectionHeader icon={<Moon size={18} />} title="定时关闭" />
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
    </SectionCard>
  );
});

// === 下载与缓存 ===
const DownloadSection = memo(function DownloadSection() {
  return (
    <SectionCard delay={5}>
      <SectionHeader icon={<Download size={18} />} title="下载与缓存" />
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
    </SectionCard>
  );
});

// === 关于 ===
const AboutSection = memo(function AboutSection() {
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
  return (
    <SectionCard delay={5}>
      <SectionHeader icon={<Info size={18} />} title="关于" />
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>版本</span><span style={{ color: "var(--text-primary)" }}>0.2.0</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>玻璃引擎</span><span style={{ color: "var(--text-primary)" }}>@samasante/liquid-glass</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>音乐来源</span><span style={{ color: "var(--text-primary)" }}>Audius · iTunes · Jamendo · osu!</span></div>
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
    </SectionCard>
  );
});

export default function Settings() {
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
          <AppearanceSection />
          <PlaybackSection />
          <QualitySection />
          <EQSection />
        </div>
        <div className="flex flex-col gap-5">
          <SourceSection />
          <SleepSection />
          <DownloadSection />
          <AboutSection />
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
