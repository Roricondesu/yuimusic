import React, { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { getBlob, setBlob, removeBlob, STORAGE_KEYS } from "../../lib/storage";

/**
 * 应用背景层。支持四种模式：
 * - default：默认渐变光斑（主题色）
 * - image：用户上传的图片（存 IndexedDB blobs store）
 * - gradient：双色渐变
 * - solid：纯色
 *
 * 所有模式均支持 blur（图片模式）与 dim（变暗遮罩）。
 */
export const Background: React.FC = () => {
  const reduceMotion = useAppStore((s) => s.settings.reduceMotion);
  const mode = useAppStore((s) => s.settings.backgroundMode);
  const blur = useAppStore((s) => s.settings.backgroundBlur);
  const dim = useAppStore((s) => s.settings.backgroundDim);
  const scale = useAppStore((s) => s.settings.backgroundScale);
  const solid = useAppStore((s) => s.settings.backgroundSolid);
  const gradientFrom = useAppStore((s) => s.settings.backgroundGradientFrom);
  const gradientTo = useAppStore((s) => s.settings.backgroundGradientTo);
  const gradientAngle = useAppStore((s) => s.settings.backgroundGradientAngle);
  const imgNonce = useAppStore((s) => s.settings.backgroundImageNonce);

  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // 仅 image 模式下加载图片 Blob；nonce 变化时重新加载
  useEffect(() => {
    if (mode !== "image") {
      setImgUrl(null);
      return;
    }
    let url: string | null = null;
    let revoked = false;
    (async () => {
      const blob = await getBlob(STORAGE_KEYS.backgroundImage);
      if (revoked || !blob) return;
      url = URL.createObjectURL(blob);
      setImgUrl(url);
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mode, imgNonce]);

  // 背景层根样式
  const rootStyle: React.CSSProperties =
    mode === "solid"
      ? { background: solid }
      : mode === "gradient"
        ? {
            background: `linear-gradient(${gradientAngle}deg, ${gradientFrom}, ${gradientTo})`,
          }
        : mode === "image" && imgUrl
          ? { background: "transparent" }
          : { background: "var(--bg-base)" };

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={rootStyle}
    >
      {/* 自定义图片层 */}
      {mode === "image" && imgUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imgUrl})`,
            backgroundSize: `${scale}%`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
            // 模糊会让边缘收缩，放大避免露白
            transform: blur > 0 ? `scale(${1 + blur / 200})` : undefined,
          }}
        />
      )}

      {/* 默认模式的漂浮光斑 */}
      {mode === "default" && (
        <>
          <div
            className="absolute rounded-full opacity-25"
            style={{
              width: "55vmax",
              height: "55vmax",
              top: "-12vmax",
              right: "-18vmax",
              background: "var(--surface-elevated)",
              filter: "blur(80px)",
              animation: reduceMotion ? undefined : "float 28s ease-in-out infinite",
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
        </>
      )}

      {/* 变暗遮罩（image / gradient 模式下增强可读性） */}
      {dim > 0 && (mode === "image" || mode === "gradient" || mode === "solid") && (
        <div
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${dim})` }}
        />
      )}
    </div>
  );
};

/** 写入自定义背景图片 Blob 到 IndexedDB */
export async function saveBackgroundImage(blob: Blob): Promise<void> {
  await setBlob(STORAGE_KEYS.backgroundImage, blob);
}

/** 删除自定义背景图片 */
export async function clearBackgroundImage(): Promise<void> {
  await removeBlob(STORAGE_KEYS.backgroundImage);
}
