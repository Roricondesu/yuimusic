import React from "react";
import { useAppStore } from "../../store/useAppStore";

export const Background: React.FC = () => {
  const reduceMotion = useAppStore((s) => s.settings.reduceMotion);

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="absolute rounded-full opacity-25"
        style={{
          width: "55vmax",
          height: "55vmax",
          top: "-12vmax",
          right: "-18vmax",
          background: "var(--surface-elevated)",
          filter: "blur(80px)",
          animation: reduceMotion
            ? undefined
            : "float 28s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full opacity-20"
        style={{
          width: "45vmax",
          height: "45vmax",
          bottom: "-12vmax",
          left: "-12vmax",
          background: "var(--surface-elevated)",
          filter: "blur(64px)",
          animation: reduceMotion
            ? undefined
            : "float 24s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
};
