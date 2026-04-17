// 現在開いている PtclDocument を保持するストア。
// MVP の雛形：state 形のみ定義し、構造変更アクションは今後のステップで実装する。
import { create } from "zustand";
import type { PtclDocument } from "@/types/ptcl";
import { createEmptyDocument } from "@/lib/ptcl/io";

export type DocumentState = {
  doc: PtclDocument | null;
  /** ファイルパス。新規未保存は null。 */
  path: string | null;
  /** 未保存の変更があるか。 */
  isDirty: boolean;

  // ---- actions ----
  setDocument: (doc: PtclDocument, path: string | null) => void;
  clearDocument: () => void;
  createNew: () => void;
  markSaved: (path: string) => void;
};

export const useDocumentStore = create<DocumentState>((set) => ({
  doc: null,
  path: null,
  isDirty: false,

  setDocument: (doc, path) => set({ doc, path, isDirty: false }),
  clearDocument: () => set({ doc: null, path: null, isDirty: false }),
  createNew: () =>
    set({ doc: createEmptyDocument(), path: null, isDirty: false }),
  markSaved: (path) => set({ path, isDirty: false }),
}));
