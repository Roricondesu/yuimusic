/**
 * 基于 IndexedDB 的轻量持久化工具
 *
 * 使用单一数据库 + 单一 object store，以键值对形式存储 JSON 可序列化数据。
 * 适合收藏、歌单、播放历史、设置等中等体积的状态持久化。
 */

const DB_NAME = "yuimusic";
const DB_VERSION = 1;
const STORE_NAME = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
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
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
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
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
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
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
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
} as const;
