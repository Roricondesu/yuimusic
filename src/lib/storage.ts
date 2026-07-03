/**
 * 基于 IndexedDB 的轻量持久化工具
 *
 * 使用单一数据库 + 两个 object store：
 * - kv：JSON 可序列化数据（收藏、歌单、播放历史、设置、下载元数据）
 * - blobs：音频 Blob 二进制数据（离线播放用）
 */

const DB_NAME = "yuimusic";
const DB_VERSION = 2;
const STORE_KV = "kv";
const STORE_BLOBS = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
      // v2: 新增 blobs store 用于存储音频 Blob
      if (event.oldVersion < 2 && !db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** 读取一个键的值，不存在或出错时返回 fallback */
export async function getItem<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDB();
    return await new Promise<T>((resolve) => {
      const tx = db.transaction(STORE_KV, "readonly");
      const req = tx.objectStore(STORE_KV).get(key);
      req.onsuccess = () => {
        resolve(req.result === undefined ? fallback : (req.result as T));
      };
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

/** 写入一个键值，失败时静默 */
export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_KV, "readwrite");
      tx.objectStore(STORE_KV).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* 静默失败，持久化不应阻塞主流程 */
  }
}

/** 删除一个键，失败时静默 */
export async function removeItem(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_KV, "readwrite");
      tx.objectStore(STORE_KV).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* 静默失败 */
  }
}

/* ========== Blob 存储 ========== */

/** 读取音频 Blob，不存在返回 null */
export async function getBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_BLOBS, "readonly");
      const req = tx.objectStore(STORE_BLOBS).get(key);
      req.onsuccess = () => {
        resolve(req.result === undefined ? null : (req.result as Blob));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** 存储音频 Blob */
export async function setBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, "readwrite");
      tx.objectStore(STORE_BLOBS).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    throw new Error("Blob 存储失败");
  }
}

/** 删除音频 Blob */
export async function removeBlob(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_BLOBS, "readwrite");
      tx.objectStore(STORE_BLOBS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* 静默失败 */
  }
}

/** 持久化键名常量 */
export const STORAGE_KEYS = {
  favorites: "favorites",
  playlists: "playlists",
  history: "history",
  settings: "settings",
  downloads: "downloads",
  /** 已下载曲目元数据列表（Track 对象数组，不含 Blob 本身） */
  downloadedTracks: "downloadedTracks",
  /** 自定义背景图片 Blob */
  backgroundImage: "backgroundImage",
  /** 手动导入的 .lrc 歌词文本（前缀，后接曲目键） */
  manualLrc: "manualLrc",
} as const;
