import React, { useEffect, useRef, useState } from "react";
import { GlassSlider } from "../glass/GlassSlider";

export interface SeekBarProps {
  progress: number; // 0..1
  onSeek: (progress: number) => void;
  disabled?: boolean;
  scheme?: "light" | "dark";
  thumbHeight?: number;
  height?: number;
}

export const SeekBar: React.FC<SeekBarProps> = ({
  progress,
  onSeek,
  disabled = false,
  scheme = "dark",
  thumbHeight = 16,
  height = 4,
}) => {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(240);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setWidth(Math.max(40, Math.floor(rect.width)));
    };

    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        minHeight: 16,
      }}
    >
      <GlassSlider
        value={pct}
        onValueChange={(v) => onSeek(v / 100)}
        min={0}
        max={100}
        step={0.1}
        disabled={disabled}
        scheme={scheme}
        width={width}
        thumbHeight={thumbHeight}
        thumbWidth={thumbHeight}
        height={height}
        rubberOvershoot={0.02}
        ariaLabel="进度条"
      />
    </div>
  );
};
