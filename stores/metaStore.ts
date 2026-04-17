// recents / pinned のストア。
// MVP の雛形：Home 画面のダミーデータ表示が動けば OK。
// tauri fs への永続化は次のステップで実装する。
import { create } from "zustand";
import type { RecentItem } from "@/types/ptcl";

export type MetaState = {
  recents: RecentItem[];
  pinned: string[];

  // ---- actions ----
  setRecents: (items: RecentItem[]) => void;
  setPinned: (ids: string[]) => void;
  togglePin: (id: string) => void;
  markMissing: (id: string, missing: boolean) => void;
  removeRecent: (id: string) => void;
};

export const useMetaStore = create<MetaState>((set) => ({
  recents: [],
  pinned: [],

  setRecents: (recents) => set({ recents }),
  setPinned: (pinned) => set({ pinned }),
  togglePin: (id) =>
    set((s) => ({
      pinned: s.pinned.includes(id)
        ? s.pinned.filter((x) => x !== id)
        : [...s.pinned, id],
    })),
  markMissing: (id, missing) =>
    set((s) => ({
      recents: s.recents.map((r) => (r.id === id ? { ...r, missing } : r)),
    })),
  removeRecent: (id) =>
    set((s) => ({
      recents: s.recents.filter((r) => r.id !== id),
      pinned: s.pinned.filter((x) => x !== id),
    })),
}));
