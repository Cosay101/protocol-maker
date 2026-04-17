// 現在開いている PtclDocument を保持するストア。
// 全ての mainFlow 変更は normalize() を通して不変条件を保つ。
import { create } from "zustand";
import type { PtclDocument, Meta } from "@/types/ptcl";
import { createEmptyDocument } from "@/lib/ptcl/io";
import { normalizeMainFlow } from "@/lib/ptcl/normalize";
import { newBlockId } from "@/lib/id";
import { nowIso } from "@/lib/date";

export type DocumentState = {
  doc: PtclDocument | null;
  path: string | null;
  isDirty: boolean;

  // ---- ドキュメント全体 ----
  setDocument: (doc: PtclDocument, path: string | null) => void;
  clearDocument: () => void;
  createNew: () => void;
  markSaved: (path: string) => void;

  // ---- meta ----
  setMeta: (patch: Partial<Meta>) => void;

  // ---- mainFlow: operation ----
  /** gap 位置（beforeBlockIndex）に新しい operation を挿入する */
  insertOperation: (beforeBlockIndex: number, text?: string) => string;
  /** operation の本文を更新する */
  updateOperationText: (blockId: string, text: string) => void;
  /** operation を削除して正規化する */
  deleteBlock: (blockId: string) => void;
};

/** doc が null のときに mutation を呼ばないためのガード */
function withDoc(
  state: DocumentState,
  fn: (doc: PtclDocument) => Partial<DocumentState>,
): Partial<DocumentState> {
  if (!state.doc) return {};
  return fn(state.doc);
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  doc: null,
  path: null,
  isDirty: false,

  setDocument: (doc, path) => set({ doc, path, isDirty: false }),
  clearDocument: () => set({ doc: null, path: null, isDirty: false }),
  createNew: () =>
    set({ doc: createEmptyDocument(), path: null, isDirty: false }),
  markSaved: (path) => set({ path, isDirty: false }),

  setMeta: (patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          meta: { ...doc.meta, ...patch, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  insertOperation: (beforeBlockIndex, text = "") => {
    const newId = newBlockId();
    set((s) =>
      withDoc(s, (doc) => {
        const { blocks, attachments } = doc.mainFlow;
        const newBlocks = [
          ...blocks.slice(0, beforeBlockIndex),
          { id: newId, type: "operation" as const, text },
          ...blocks.slice(beforeBlockIndex),
        ];
        return {
          doc: {
            ...doc,
            mainFlow: normalizeMainFlow({ blocks: newBlocks, attachments }),
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return newId;
  },

  updateOperationText: (blockId, text) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            blocks: doc.mainFlow.blocks.map((b) =>
              b.id === blockId && b.type === "operation" ? { ...b, text } : b,
            ),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  deleteBlock: (blockId) =>
    set((s) =>
      withDoc(s, (doc) => {
        const { blocks, attachments } = doc.mainFlow;
        const newBlocks = blocks.filter((b) => b.id !== blockId);
        return {
          doc: {
            ...doc,
            mainFlow: normalizeMainFlow({
              blocks: newBlocks,
              attachments,
            }),
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),
}));
