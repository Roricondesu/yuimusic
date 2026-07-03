import React, { useState, useEffect } from "react";
import { Music } from "lucide-react";

interface CoverImageProps {
  src: string;
  alt: string;
  className?: string;
  /** 图标尺寸，默认 24 */
  iconSize?: number;
  style?: React.CSSProperties;
}

/**
 * 封面图片组件：加载失败时自动回退为 Music 图标占位。
 */
export const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt,
  className,
  iconSize = 24,
  style,
}) => {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center ${className ?? ""}`}
        style={{
          background: "rgba(128,128,128,0.12)",
          borderRadius: "var(--cover-radius, 12px)",
          ...style,
        }}
      >
        <Music size={iconSize} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ borderRadius: "var(--cover-radius, 12px)", ...style }}
      onError={() => setError(true)}
    />
  );
};

CoverImage.displayName = "CoverImage";
