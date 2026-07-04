import React, { useEffect, useRef, useState } from "react";
import {
  Home,
  Library,
  Settings,
  Heart,
  ListMusic,
  TrendingUp,
  Download,
  Mic2,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { GlassCard } from "../glass/GlassCard";
import type { TabKey } from "../../types";

const NAV: { key: TabKey; icon: React.ReactNode }[] = [
  { key: "home", icon: <Home size={20} /> },
  { key: "library", icon: <Library size={20} /> },
  { key: "charts", icon: <TrendingUp size={20} /> },
  { key: "artists", icon: <Mic2 size={20} /> },
  { key: "downloads", icon: <Download size={20} /> },
  { key: "favorites", icon: <Heart size={20} /> },
  { key: "playlists", icon: <ListMusic size={20} /> },
  { key: "settings", icon: <Settings size={20} /> },
];

export const TopNav: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const theme = useAppStore((s) => s.settings.theme);
  const scheme = theme === "dark" ? "dark" : "light";
  const isDark = scheme === "dark";

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    home: null,
    library: null,
    charts: null,
    artists: null,
    downloads: null,
    favorites: null,
    playlists: null,
    settings: null,
  });
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = itemRefs.current[activeTab];
    const container = containerRef.current;
    if (!el || !container) return;
    const cRect = container.getBoundingClientRect();
    const iRect = el.getBoundingClientRect();
    setIndicator({
      left: iRect.left - cRect.left,
      width: iRect.width,
    });
  }, [activeTab]);

  return (
    <nav
      className="fixed left-1/2 top-3 z-50 -translate-x-1/2 md:top-5"
      style={{ pointerEvents: "none" }}
    >
      <GlassCard
        scheme={scheme}
        style={{
          pointerEvents: "auto",
          borderRadius: 999,
          padding: 6,
          maxWidth: "min(calc(100vw - 24px), 560px)",
          overflow: "hidden",
          background: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.4)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 28px rgba(0,0,0,0.12)",
        }}
      >
        <div ref={containerRef} className="relative flex items-center justify-center gap-1 overflow-x-auto hide-scrollbar">
          <div
            className="absolute top-0 bottom-0 rounded-full"
            style={{
              left: indicator.left,
              width: indicator.width,
              background: isDark
                ? "rgba(255,255,255,0.14)"
                : "rgba(255,255,255,0.6)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              transition:
                "left 0.3s cubic-bezier(0.22,1,0.36,1), width 0.25s cubic-bezier(0.22,1,0.36,1)",
              zIndex: 0,
            }}
          />
          {NAV.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                ref={(el) => {
                  itemRefs.current[item.key] = el;
                }}
                onClick={() => setActiveTab(item.key)}
                className="relative z-10 flex items-center justify-center rounded-full p-2.5 transition-colors"
                style={{
                  border: "none",
                  background: "transparent",
                  color: active
                    ? isDark
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(0,0,0,0.9)"
                    : isDark
                      ? "rgba(255,255,255,0.6)"
                      : "rgba(0,0,0,0.5)",
                }}
                aria-label={item.key}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      </GlassCard>
    </nav>
  );
};
