import React, { useState } from "react";
import { Music, Search, Heart, ListMusic, Download, Settings, ChevronRight, X } from "lucide-react";

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <Music size={32} />,
    title: "欢迎来到 YUI MUSIC",
    desc: "液态玻璃风格的跨源音乐播放器，聚合 Apple Music、Audius、Jamendo 与 osu! 谱面音频。",
  },
  {
    icon: <Search size={32} />,
    title: "搜索与浏览",
    desc: "在曲库中搜索任意歌曲，或浏览排行榜发现新音乐。首页每日为你推荐精选内容。",
  },
  {
    icon: <Heart size={32} />,
    title: "收藏与歌单",
    desc: "点击心形图标收藏喜欢的歌曲，创建自定义歌单，随时重温你的音乐品味。",
  },
  {
    icon: <Download size={32} />,
    title: "下载管理",
    desc: "支持下载 osu! 谱面并自动提取音频，离线也能听。在下载管理 tab 查看进度。",
  },
  {
    icon: <ListMusic size={32} />,
    title: "歌词与正在播放",
    desc: "点击底部播放栏展开全屏播放页，享受逐行高亮的歌词滚动体验。",
  },
  {
    icon: <Settings size={32} />,
    title: "个性化设置",
    desc: "在设置中切换主题、音源、歌词效果，以及调整音量限制和播放速度等参数。",
  },
];

export const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleFinish = () => {
    setVisible(false);
    localStorage.setItem("yui_onboarding_done", "1");
  };

  const handleSkip = () => {
    setVisible(false);
    localStorage.setItem("yui_onboarding_done", "1");
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-6"
      style={{
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        className="solid-card relative w-full max-w-sm p-6 md:p-8"
        style={{
          animation: "stagger-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* 跳过 */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 p-1"
          style={{ border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          aria-label="跳过引导"
        >
          <X size={18} />
        </button>

        {/* 图标 */}
        <div
          className="mb-5 flex items-center justify-center rounded-2xl"
          style={{
            width: 64,
            height: 64,
            background: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          {current.icon}
        </div>

        {/* 标题 */}
        <h2 className="mb-2 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          {current.title}
        </h2>
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {current.desc}
        </p>

        {/* 进度点 */}
        <div className="mb-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                background: i === step ? "var(--accent)" : "var(--surface-elevated)",
              }}
            />
          ))}
        </div>

        {/* 按钮 */}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-full py-2.5 text-sm font-medium"
              style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-sm font-semibold"
            style={{ border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}
          >
            {isLast ? "开始使用" : "下一步"}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

/** 检查是否需要显示引导 */
export function shouldShowOnboarding(): boolean {
  try {
    return !localStorage.getItem("yui_onboarding_done");
  } catch {
    return false;
  }
}
