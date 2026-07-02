import React, { useEffect, useRef, useState } from "react";

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
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [letterStep, setLetterStep] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const ratio = Math.min(1, elapsed / duration);
      setProgress(Math.round(ratio * 100));

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

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background: "var(--bg-base)",
        transition: "opacity 0.5s ease, visibility 0.5s ease",
        opacity: exiting ? 0 : 1,
        visibility: exiting ? "hidden" : "visible",
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      {/* 文字：居中显示，逐字亮起 */}
      <div
        className="mb-8 flex items-center justify-center"
        style={{
          fontFamily:
            '"SF Mono", "Menlo", "Monaco", "Cascadia Code", "Source Code Pro", monospace',
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: "0.18em",
          paddingLeft: "0.18em", // 补偿 letter-spacing 居中
        }}
      >
        {WORD.split("").map((ch, i) => {
          const lit = i < letterStep;
          return (
            <span
              key={i}
              style={{
                color: lit ? "var(--text-primary)" : "transparent",
                textShadow: lit ? "none" : undefined,
                WebkitTextStroke: lit
                  ? "none"
                  : `1px ${"var(--text-secondary)"}`,
                opacity: lit ? 1 : 0.5,
                transition:
                  "color 0.3s ease, opacity 0.3s ease, -webkit-text-stroke 0.3s ease",
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>

      {/* 简洁白色线条进度条 */}
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: "min(70vw, 240px)", height: 2 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--surface-elevated)" }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: "var(--text-primary)",
            transition: "width 0.08s linear",
          }}
        />
      </div>
    </div>
  );
};

SplashScreen.displayName = "SplashScreen";
