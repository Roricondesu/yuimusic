import React from "react";
import { Glass, type GlassOptics } from "@samasante/liquid-glass";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  scheme?: "light" | "dark";
  children: React.ReactNode;
}

const CARD_OPTICS: Partial<GlassOptics> = {
  mapSize: 256,
  clipToShape: true,
  softEdge: true,
  depth: 0.32,
  curvature: 0.22,
  dispersion: 0.42, // 色散增强：边缘 RGB 分离更明显
  strength: 0.08,
  bend: 0.28,
  bendWidth: 0.03,
  frost: 0.9, // 降低模糊度，保留通透感
  specular: 0.95,
  sheenAngle: 50,
  glow: 0.08,
  glowSpread: 0.6,
  glowFalloff: 0.8,
  sheen: 0.85,
  sheenWidth: 2,
  sheenFalloff: 1.5,
};

export const GlassCard: React.FC<GlassCardProps> = ({
  scheme = "dark",
  children,
  style,
  ...rest
}) => {
  const isDark = scheme === "dark";
  const optics: Partial<GlassOptics> = {
    ...CARD_OPTICS,
    brightness: 0,
    sheenDark: !isDark,
  };

  return (
    <Glass
      optics={optics}
      style={{
        width: "100%",
        borderRadius: 22,
        padding: 20,
        boxSizing: "border-box",
        color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.84)",
        background: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.22)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.22), 0 14px 38px rgba(0,0,0,0.14), 0 3px 8px rgba(0,0,0,0.08)",
        transition: "transform 0.4s var(--ease-silk), box-shadow 0.4s var(--ease-silk)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Glass>
  );
};
GlassCard.displayName = "GlassCard";
