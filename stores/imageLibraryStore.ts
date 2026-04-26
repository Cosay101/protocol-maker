// 画像ライブラリストア: ユーザーがアップロードした画像をローカルに保持する。
// localStorage に persist して再起動後も維持する。
import { create } from "zustand";
import { persist } from "zustand/middleware";
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
    { name: "ptcl-image-library" },
  ),
);
