import type { AccentKey } from "../types";

export interface AccentTheme {
  key: AccentKey;
  label: string;
  /** 主色 HEX */
  color: string;
  /** 软色（带透明度）由 color 派生 */
  soft: (alpha: number) => string;
}

const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const ACCENTS: AccentTheme[] = [
  { key: "blue", label: "海洋蓝", color: "#0a84ff", soft: (a) => hexToRgba("#0a84ff", a) },
  { key: "purple", label: "梦幻紫", color: "#bf5af2", soft: (a) => hexToRgba("#bf5af2", a) },
  { key: "pink", label: "樱花粉", color: "#ff375f", soft: (a) => hexToRgba("#ff375f", a) },
  { key: "red", label: "炽热红", color: "#ff453a", soft: (a) => hexToRgba("#ff453a", a) },
  { key: "orange", label: "日落橙", color: "#ff9f0a", soft: (a) => hexToRgba("#ff9f0a", a) },
  { key: "green", label: "森林绿", color: "#30d158", soft: (a) => hexToRgba("#30d158", a) },
  { key: "teal", label: "湖水青", color: "#64d2ff", soft: (a) => hexToRgba("#64d2ff", a) },
  { key: "indigo", label: "深邃靛", color: "#5e5ce6", soft: (a) => hexToRgba("#5e5ce6", a) },
];

export const getAccent = (key: AccentKey): AccentTheme =>
  ACCENTS.find((a) => a.key === key) || ACCENTS[0];

/** 应用主题色到 CSS 变量 */
export const applyAccent = (key: AccentKey): void => {
  if (typeof document === "undefined") return;
  const accent = getAccent(key);
  const root = document.documentElement;
  root.style.setProperty("--accent", accent.color);
  root.style.setProperty("--accent-soft", accent.soft(0.14));
  root.style.setProperty("--accent-strong", accent.soft(0.28));
};
