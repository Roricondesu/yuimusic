import { useEffect, useState } from "react";
import { Background } from "@/components/layout/Background";
import { TopNav } from "@/components/layout/TopNav";
import { BottomPlayer } from "@/components/layout/BottomPlayer";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { Onboarding, shouldShowOnboarding } from "@/components/common/Onboarding";
import { useAudio } from "@/hooks/useAudio";
import { useAppStore } from "@/store/useAppStore";
import Home from "@/pages/Home";
import Library from "@/pages/Library";
import Charts from "@/pages/Charts";
import Downloads from "@/pages/Downloads";
import Favorites from "@/pages/Favorites";
import Playlists from "@/pages/Playlists";
import Settings from "@/pages/Settings";
import NowPlaying from "@/pages/NowPlaying";

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const showNowPlaying = useAppStore((s) => s.player.showNowPlaying);
  const init = useAppStore((s) => s.init);
  const splashDuration = useAppStore((s) => s.settings.splashDuration);

  // 用于 NowPlaying 退出动画
  const [renderNowPlaying, setRenderNowPlaying] = useState(false);
  const [exitAnim, setExitAnim] = useState(false);

  // YUI MUSIC 启动屏
  const [showSplash, setShowSplash] = useState(true);
  // 首次引导
  const [showOnboarding, setShowOnboarding] = useState(false);

  useAudio();

  useEffect(() => {
    init();
  }, [init]);

  // 启动屏结束后检查是否需要引导
  useEffect(() => {
    if (!showSplash) {
      if (shouldShowOnboarding()) {
        setShowOnboarding(true);
      }
    }
  }, [showSplash]);

  // 进入：showNowPlaying=true → 立即渲染
  useEffect(() => {
    if (showNowPlaying) {
      setRenderNowPlaying(true);
      setExitAnim(false);
    } else if (renderNowPlaying) {
      // 退出：先播退出动画，结束后卸载
      setExitAnim(true);
      const t = setTimeout(() => {
        setRenderNowPlaying(false);
        setExitAnim(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [showNowPlaying]);

  // 页面切换 key，触发动画
  const pageKey = activeTab;

  return (
    <div className="relative min-h-full">
      {showSplash && (
        <SplashScreen duration={splashDuration} onFinished={() => setShowSplash(false)} />
      )}

      <Background />
      <TopNav />

      {/* 顶部渐变遮罩，按主题使用黑/白色 */}
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-30 h-5"
        style={{
          background: "linear-gradient(to bottom, var(--bg-base), transparent)",
        }}
      />

      <main className="page-shell mx-auto w-full max-w-5xl px-4 md:px-6">
        <div key={pageKey} className="page-transition">
          {activeTab === "home" && <Home />}
          {activeTab === "library" && <Library />}
          {activeTab === "charts" && <Charts />}
          {activeTab === "downloads" && <Downloads />}
          {activeTab === "favorites" && <Favorites />}
          {activeTab === "playlists" && <Playlists />}
          {activeTab === "settings" && <Settings />}
        </div>
      </main>

      <BottomPlayer />

      {showOnboarding && <Onboarding />}

      {renderNowPlaying && (
        <div
          className={`fixed inset-0 z-50 overflow-hidden ${
            exitAnim ? "nowplaying-exit" : "nowplaying-enter"
          }`}
        >
          <NowPlaying />
        </div>
      )}
    </div>
  );
}
