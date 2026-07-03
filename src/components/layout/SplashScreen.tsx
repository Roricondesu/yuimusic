import React, { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useAppStore } from "@/store/useAppStore";

interface SplashScreenProps {
  /** 动画总时长（毫秒），默认 2400ms */
  duration?: number;
  onFinished?: () => void;
}

const WORD = "YUIMUSIC";

export const SplashScreen: React.FC<SplashScreenProps> = ({
  duration = 2400,
  onFinished,
}) => {
  const [exiting, setExiting] = useState(false);
  const [letterStep, setLetterStep] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";

  useEffect(() => {
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const ratio = Math.min(1, elapsed / duration);

      // 字母逐个亮起：在 0~70% 区间内完成
      const step = Math.min(WORD.length, Math.floor((ratio / 0.7) * WORD.length));
      setLetterStep(step);

      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setExiting(true), 120);
        setTimeout(() => onFinished?.(), 620);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, onFinished]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // 鼠标偏离中心的比例，最大倾斜 12deg
    const x = ((e.clientY - cy) / (rect.height / 2)) * 12;
    const y = ((e.clientX - cx) / (rect.width / 2)) * -12;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background: "var(--bg-base)",
        transition: "opacity 0.5s ease, visibility 0.5s ease",
        opacity: exiting ? 0 : 1,
        visibility: exiting ? "hidden" : "visible",
        pointerEvents: exiting ? "none" : "auto",
        perspective: 800,
      }}
    >
      {/* 文字：居中显示，逐字亮起，使用与 BottomPlayer 同款的 GlassCard；外层 wrapper 负责鼠标倾斜 */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 0.25s var(--ease-silk)",
          transformStyle: "preserve-3d",
        }}
      >
        <GlassCard
          scheme={scheme}
          style={{
            width: "auto",
            borderRadius: 18,
            padding: "1rem 1.6rem",
            paddingLeft: "calc(1.6rem + 0.18em)", // 补偿 letter-spacing 居中
            fontFamily:
              '"SF Mono", "Menlo", "Monaco", "Cascadia Code", "Source Code Pro", monospace',
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: "0.18em",
          }}
        >
          {WORD.split("").map((ch, i) => {
            const lit = i < letterStep;
            return (
              <span
                key={i}
                style={{
                  color: lit ? "var(--text-primary)" : "transparent",
                  textShadow: lit
                    ? "0 0 18px rgba(255,255,255,0.15)"
                    : undefined,
                  WebkitTextStroke: lit
                    ? "none"
                    : `1px ${"var(--text-secondary)"}`,
                  opacity: lit ? 1 : 0.45,
                  transition:
                    "color 0.3s ease, opacity 0.3s ease, -webkit-text-stroke 0.3s ease",
                }}
              >
                {ch}
              </span>
            );
          })}
        </GlassCard>
      </div>
    </div>
  );
};

SplashScreen.displayName = "SplashScreen";
