import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yuimusic.app",
  appName: "YUIMUSIC",
  webDir: "dist",
  android: {
    // 允许 http 流媒体源（部分音乐 API 走 http）
    allowMixedContent: true,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
