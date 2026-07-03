// preload：当前应用未使用任何 Node 能力，保留空桥接以备后续扩展。
// contextBridge 暴露的 API 通过 window.__YUI__ 访问。
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("__YUI__", {
  platform: process.platform,
  isElectron: true,
});
