import React from "react";
import type { TrackSource } from "../../types";

/**
 * 来源品牌图标：
 * - iTunes：苹果 logo（被咬的苹果）
 * - Audius：Audius 波形 logo
 * - Jamendo：音乐音符（独立/CC 授权音乐）
 * - osu!：osu 圆圈徽标
 * 用 SVG 绘制，替代文字徽章。
 */

export interface SourceIconProps {
  source: TrackSource;
  size?: number;
  /** 是否带圆形背景底色 */
  withBackground?: boolean;
  style?: React.CSSProperties;
}

/** iTunes / Apple 苹果 logo（单色，用 currentColor 填充） */
const AppleGlyph: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.38-2.85 1.4-2.92-.03-.01-2.69-1.03-2.72-4.09zM14.6 4.59c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
  </svg>
);

/** Audius logo（音频波形/"A"抽象） */
const AudiusGlyph: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2L3 20h3.5l1.4-3h8.2l1.4 3H21L12 2zm-3 12l3-6.5L15 14H9z" />
  </svg>
);

/** Jamendo 音乐音符 */
const JamendoGlyph: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

/** osu! 徽标（官方风格：圆环 + 内圆点，致敬 osu! cookie） */
const OsuGlyph: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    {/* 外圆环 */}
    <circle cx="12" cy="12" r="9.5" />
    {/* 内圆点 */}
    <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
  </svg>
);

const SOURCE_META: Record<
  TrackSource,
  { title: string; color: string; bg: string }
> = {
  itunes: {
    title: "iTunes · 版权试听 30 秒",
    color: "#ff9f0a",
    bg: "rgba(255,159,10,0.15)",
  },
  audius: {
    title: "Audius · 完整免费音乐",
    color: "var(--accent)",
    bg: "var(--accent-soft)",
  },
  jamendo: {
    title: "Jamendo · CC 授权完整音乐",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.15)",
  },
  osu: {
    title: "osu! · 谱面提取音频",
    color: "#ff66ab",
    bg: "rgba(255,102,171,0.15)",
  },
};

export const SourceIcon: React.FC<SourceIconProps> = ({
  source,
  size = 12,
  withBackground = true,
  style,
}) => {
  const meta = SOURCE_META[source];

  const glyph =
    source === "itunes" ? (
      <AppleGlyph size={size} />
    ) : source === "jamendo" ? (
      <JamendoGlyph size={size} />
    ) : source === "osu" ? (
      <OsuGlyph size={size} />
    ) : (
      <AudiusGlyph size={size} />
    );

  if (!withBackground) {
    return <span style={{ color: meta.color, display: "inline-flex", ...style }}>{glyph}</span>;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + 8,
        height: size + 8,
        borderRadius: 6,
        background: meta.bg,
        color: meta.color,
        flexShrink: 0,
        ...style,
      }}
      title={meta.title}
    >
      {glyph}
    </span>
  );
};
