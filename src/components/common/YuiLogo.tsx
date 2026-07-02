import React from "react";

interface YuiLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * YUI MUSIC 抽象图形 Logo
 * - 液态玻璃质感的圆环 + 中心声波
 * - 无文字，依赖 CSS 变量 --accent 着色
 */
export const YuiLogo: React.FC<YuiLogoProps> = ({
  size = 120,
  className,
  style,
}) => {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="yui-gradient"
          x1="0"
          y1="0"
          x2="120"
          y2="120"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.25" />
        </linearGradient>
        <filter id="yui-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 外环：液态玻璃边缘 */}
      <circle
        cx="60"
        cy="60"
        r="52"
        stroke="url(#yui-gradient)"
        strokeWidth="2"
        opacity="0.5"
      />

      {/* 中环：主轮廓 */}
      <circle
        cx="60"
        cy="60"
        r="42"
        stroke="url(#yui-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="200 264"
        strokeDashoffset="-20"
        opacity="0.85"
        filter="url(#yui-glow)"
      />

      {/* 中心圆盘 */}
      <circle
        cx="60"
        cy="60"
        r="18"
        fill="url(#yui-gradient)"
        opacity="0.2"
      />
      <circle
        cx="60"
        cy="60"
        r="8"
        fill="var(--accent)"
        opacity="0.9"
      />

      {/* 三条声波弧线 */}
      <path
        d="M60 24 C72 24, 82 34, 82 46"
        stroke="url(#yui-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M60 96 C48 96, 38 86, 38 74"
        stroke="url(#yui-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M24 60 C24 72, 34 82, 46 82"
        stroke="url(#yui-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
};

YuiLogo.displayName = "YuiLogo";
