// 画像ライブラリストア: ユーザーがアップロードした画像をローカルに保持する。
// IndexedDB に persist して再起動後も維持する。
// localStorage（上限 ~5MB）ではなく IndexedDB（上限 ~数百 MB）を使うことで
// 大きな画像ファイルを複数保存しても QuotaExceededError が起きにくくなる。
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

export type LibraryImage = {
  id: string;
  name: string;
  /** data URL (base64) */
  src: string;
  addedAt: string;
};

type ImageLibraryState = {
  images: LibraryImage[];
  addImage: (name: string, src: string) => LibraryImage;
  removeImage: (id: string) => void;
};

// ---------- IndexedDB アダプター ----------
// Zustand persist が要求する Storage-like インターフェイスを
// IndexedDB で実装する（getItem/setItem/removeItem はすべて同期的に呼ばれるが、
// createJSONStorage に渡すと Zustand が Promise を解決してくれる）。
function makeIdbStorage(dbName: string, storeName: string) {
  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
        req.onerror   = () => reject(req.error);
      });
    },
    async setItem(key: string, value: string): Promise<void> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, "readwrite");
        const req = tx.objectStore(storeName).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
      });
    },
    async removeItem(key: string): Promise<void> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, "readwrite");
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
      });
    },
  };
}

const idbStorage = makeIdbStorage("ptcl-image-library-db", "kv");

export const useImageLibraryStore = create<ImageLibraryState>()(
  persist(
    (set) => ({
      images: [],

      addImage: (name, src) => {
        const img: LibraryImage = {
          id: nanoid(12),
          name,
          src,
          addedAt: new Date().toISOString(),
        };
        set((s) => ({ images: [...s.images, img] }));
        return img;
      },

      removeImage: (id) =>
        set((s) => ({ images: s.images.filter((img) => img.id !== id) })),
    }),
    {
      name: "ptcl-image-library",
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
