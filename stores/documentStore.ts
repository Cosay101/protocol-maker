// 現在開いている PtclDocument を保持するストア。
// 全ての mainFlow 変更は normalize() を通して不変条件を保つ。
import { create } from "zustand";
import type { PtclDocument, Meta, Page, BlockStyle, MainFlowBlock, TextFreeElement, ImageFreeElement, TableFreeElement, TableCell, ArrowFreeElement, BranchFlow } from "@/types/ptcl";
import { createEmptyDocument } from "@/lib/ptcl/io";
import { normalizeMainFlow, normalizeBranchFlow } from "@/lib/ptcl/normalize";
import { newBlockId, newAttachmentId, newFreeElementId } from "@/lib/id";
import { nowIso } from "@/lib/date";
import { replaceInText, replaceInHtml, countInText } from "@/lib/ptcl/search";

export type DocumentState = {
  doc: PtclDocument | null;
  path: string | null;
  isDirty: boolean;
  /** アンドゥ履歴（最新が末尾） */
  history: PtclDocument[];

  // ---- ドキュメント全体 ----
  setDocument: (doc: PtclDocument, path: string | null) => void;
  clearDocument: () => void;
  createNew: () => void;
  markSaved: (path: string) => void;
  /** 直前の状態に戻す（Ctrl+Z） */
  undo: () => void;

  // ---- meta ----
  setMeta: (patch: Partial<Meta>) => void;

  // ---- page ----
  setPage: (patch: Partial<Page>) => void;

  // ---- mainFlow: operation ----
  /** gap 位置（beforeBlockIndex）に新しい operation を挿入する */
  insertOperation: (beforeBlockIndex: number, text?: string) => string;
  /** operation の本文を更新する（richText は文字単位スタイルがある場合のみ渡す） */
  updateOperationText: (blockId: string, text: string, richText?: string) => void;
  /** operation のブロック個別スタイルを上書きする */
  updateBlockStyle: (blockId: string, style: Partial<BlockStyle>) => void;
  /** operation を削除して正規化する */
  deleteBlock: (blockId: string) => void;

  // ---- mainFlow: attachment (side-in / side-out) ----
  /** 矢印ブロックにアタッチメントを追加して id を返す */
  addAttachment: (anchorId: string, kind: "side-in" | "side-out" | "loop", text: string) => string;
  /** アタッチメントのテキストを更新する（richText は文字単位スタイルがある場合のみ渡す） */
  updateAttachment: (id: string, text: string, richText?: string) => void;
  /** アタッチメントのブロック個別スタイルを上書きする */
  updateAttachmentStyle: (id: string, style: Partial<BlockStyle>) => void;
  /** アタッチメントを削除する */
  removeAttachment: (id: string) => void;

  // ---- mainFlow: branch (旧・UI 廃止済み) ----
  insertBranch: (beforeBlockIndex: number) => string;
  updateBranch: (blockId: string, patch: { condition?: string; yesLabel?: string; noLabel?: string }) => void;

  // ---- mainFlow: columnBreak ----
  /** gap 位置（beforeBlockIndex）に改列マーカーを挿入して id を返す */
  insertColumnBreak: (beforeBlockIndex: number) => string;

  // ---- branchFlows (平行分岐列) ----
  /** 指定した矢印を分岐元として新しい分岐列を作成して id を返す */
  createBranchFlow: (sourceArrowId: string) => string;
  /** 分岐列に operation を挿入して id を返す */
  insertBranchOperation: (branchFlowId: string, beforeBlockIndex: number, text?: string) => string;
  /** 分岐列の operation のテキストを更新する */
  updateBranchOperationText: (branchFlowId: string, blockId: string, text: string, richText?: string) => void;
  /** 分岐列のブロックを削除する */
  deleteBranchBlock: (branchFlowId: string, blockId: string) => void;
  /** 分岐列のブロックを別位置に移動する */
  moveBranchBlock: (branchFlowId: string, blockId: string, beforeBlockIndex: number) => void;
  /** 分岐列にスペーサーを挿入して id を返す */
  insertBranchSpacer: (branchFlowId: string, beforeBlockIndex: number, h?: number) => string;
  /** 分岐列のスペーサー高さを更新する */
  updateBranchSpacerHeight: (branchFlowId: string, blockId: string, h: number) => void;
  /** 分岐列の合流先矢印 ID を設定する（null = 未合流） */
  setBranchMergeTarget: (branchFlowId: string, targetArrowId: string | null) => void;
  /** 分岐列をドキュメントから削除する */
  removeBranchFlow: (branchFlowId: string) => void;

  // ---- mainFlow: reorder ----
  /** operation ブロックを別の位置に移動する */
  moveBlock: (blockId: string, beforeBlockIndex: number) => void;

  // ---- freeElements ----
  /** 自由配置テキストボックスを追加して id を返す */
  addFreeTextElement: (x: number, y: number, w?: number, h?: number) => string;
  /** 自由配置テキスト要素のプロパティを更新する */
  updateFreeElement: (id: string, patch: Partial<Omit<TextFreeElement, "id" | "type">>) => void;
  /** 自由配置画像要素を追加して id を返す */
  addFreeImageElement: (x: number, y: number, src: string, name: string, w?: number, h?: number) => string;
  /** 自由配置画像要素のプロパティを更新する */
  updateFreeImageElement: (id: string, patch: Partial<Omit<ImageFreeElement, "id" | "type">>) => void;
  /** 自由配置要素を削除する */
  removeFreeElement: (id: string) => void;

  // ---- spacer ----
  /** スペーサーブロックを挿入して id を返す */
  insertSpacer: (beforeBlockIndex: number, h?: number) => string;
  /** スペーサーの高さを更新する */
  updateSpacerHeight: (blockId: string, h: number) => void;

  // ---- freeElements: table ----
  /** 自由配置テーブル要素を追加して id を返す */
  addFreeTableElement: (x: number, y: number, rows: number, cols: number) => string;
  /** テーブルのセルを更新する */
  updateTableCell: (tableId: string, row: number, col: number, patch: Partial<TableCell>) => void;
  /** 自由配置テーブル要素のプロパティを更新する */
  updateFreeTableElement: (id: string, patch: Partial<Omit<TableFreeElement, "id" | "type">>) => void;
  /** テーブル全セルにスタイルを一括適用する */
  updateTableStyles: (tableId: string, style: Partial<TableCell>) => void;

  // ---- freeElements: arrow ----
  /** 自由矢印を追加して id を返す */
  addFreeArrowElement: (points: { x: number; y: number }[]) => string;
  /** 自由矢印の制御点・スタイルを更新する */
  updateFreeArrowElement: (id: string, patch: Partial<Omit<ArrowFreeElement, "id" | "type">>) => void;

  /**
   * ドキュメント全体で query にマッチするすべてのテキストを replacement に置換する。
   * 対象: ヘッダー / OperationBlock / Attachment / FreeTextBox / TableCell
   */
  replaceAll: (query: string, replacement: string) => number;
};

/** doc が null のときに mutation を呼ばないためのガード。
 *  doc が変化する場合は自動的に履歴に積む（最大 50 件）。 */
function withDoc(
  state: DocumentState,
  fn: (doc: PtclDocument) => Partial<DocumentState>,
): Partial<DocumentState> {
  if (!state.doc) return {};
  const result = fn(state.doc);
  if (result.doc && result.doc !== state.doc) {
    return {
      ...result,
      history: [...(state.history ?? []).slice(-49), state.doc],
    };
  }
  return result;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  doc: null,
  path: null,
  isDirty: false,
  history: [],

  setDocument: (doc, path) => set({ doc, path, isDirty: false, history: [] }),
  clearDocument: () => set({ doc: null, path: null, isDirty: false, history: [] }),
  createNew: () =>
    set({ doc: createEmptyDocument(), path: null, isDirty: false, history: [] }),
  markSaved: (path) => set({ path, isDirty: false }),

  undo: () =>
    set((s) => {
      if (!s.history.length) return {};
      const prev = s.history[s.history.length - 1];
      return {
        doc: prev,
        history: s.history.slice(0, -1),
        isDirty: true,
      };
    }),

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

  setPage: (patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: { ...doc, page: { ...doc.page, ...patch }, meta: { ...doc.meta, updatedAt: nowIso() } },
        isDirty: true,
      })),
    ),

  insertOperation: (beforeBlockIndex, text = "") => {
    const newId = newBlockId();
    set((s) =>
      withDoc(s, (doc) => {
        const { blocks, attachments, branchFlows } = doc.mainFlow;
        const newBlocks = [
          ...blocks.slice(0, beforeBlockIndex),
          { id: newId, type: "operation" as const, text },
          ...blocks.slice(beforeBlockIndex),
        ];
        return {
          doc: {
            ...doc,
            mainFlow: normalizeMainFlow({ blocks: newBlocks, attachments, branchFlows }),
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return newId;
  },

  updateOperationText: (blockId, text, richText) =>
    set((s) =>
      withDoc(s, (doc) => {
        // テキストが変化していない場合はスキップ（余分な履歴エントリを作らない）
        const cur = doc.mainFlow.blocks.find((b) => b.id === blockId);
        if (
          cur?.type === "operation" &&
          cur.text === text &&
          (cur.richText ?? undefined) === (richText ?? undefined)
        ) return {};
        return {
          doc: {
            ...doc,
            mainFlow: {
              ...doc.mainFlow,
              blocks: doc.mainFlow.blocks.map((b) =>
                b.id === blockId && b.type === "operation"
                  ? { ...b, text, richText: richText ?? undefined }
                  : b,
              ),
            },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),

  updateBlockStyle: (blockId, style) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            blocks: doc.mainFlow.blocks.map((b) =>
              b.id === blockId && b.type === "operation"
                ? { ...b, style: { ...b.style, ...style } }
                : b,
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
        const { blocks, attachments, branchFlows } = doc.mainFlow;
        const newBlocks = blocks.filter((b) => b.id !== blockId);
        // 削除した block が分岐の sourceArrowId だった場合、その分岐も削除する
        const newBranchFlows = (branchFlows ?? []).filter(
          (bf) => bf.sourceArrowId !== blockId && bf.mergeTargetArrowId !== blockId,
        );
        return {
          doc: {
            ...doc,
            mainFlow: normalizeMainFlow({
              blocks: newBlocks,
              attachments,
              branchFlows: newBranchFlows,
            }),
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),

  addAttachment: (anchorId, kind, text) => {
    const id = newAttachmentId();
    set((s) =>
      withDoc(s, (doc) => {
        // グローバル order: この anchor の全アタッチメント数を order にして追加順を保持
        const existing = doc.mainFlow.attachments.filter(
          (a) => a.anchorId === anchorId,
        );
        const newAtt = { id, anchorId, kind, text, order: existing.length };
        return {
          doc: {
            ...doc,
            mainFlow: {
              ...doc.mainFlow,
              attachments: [...doc.mainFlow.attachments, newAtt],
            },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return id;
  },

  updateAttachment: (id, text, richText) =>
    set((s) =>
      withDoc(s, (doc) => {
        const cur = doc.mainFlow.attachments.find((a) => a.id === id);
        if (
          cur &&
          cur.text === text &&
          (cur.richText ?? undefined) === (richText ?? undefined)
        ) return {};
        return {
          doc: {
            ...doc,
            mainFlow: {
              ...doc.mainFlow,
              attachments: doc.mainFlow.attachments.map((a) =>
                a.id === id ? { ...a, text, richText: richText ?? undefined } : a,
              ),
            },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),

  updateAttachmentStyle: (id, style) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            attachments: doc.mainFlow.attachments.map((a) =>
              a.id === id ? { ...a, style: { ...a.style, ...style } } : a,
            ),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  removeAttachment: (id) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            attachments: doc.mainFlow.attachments.filter((a) => a.id !== id),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  addFreeTextElement: (x, y, w = 160, h = 60) => {
    const id = newFreeElementId();
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: [
            ...doc.freeElements,
            { id, type: "text" as const, x, y, w, h, text: "", frame: false, textAlign: "center" as const },
          ],
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    );
    return id;
  },

  updateFreeElement: (id, patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: doc.freeElements.map((el) =>
            el.id === id && el.type === "text" ? { ...el, ...patch } : el,
          ),
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  addFreeImageElement: (x, y, src, name, w = 200, h = 150) => {
    const id = newFreeElementId();
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: [
            ...doc.freeElements,
            {
              id,
              type: "image" as const,
              x, y, w, h,
              rotation: 0,
              flipX: false,
              flipY: false,
              src,
              name,
            },
          ],
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    );
    return id;
  },

  updateFreeImageElement: (id, patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: doc.freeElements.map((el) =>
            el.id === id && el.type === "image" ? { ...el, ...patch } : el,
          ),
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  removeFreeElement: (id) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: doc.freeElements.filter((el) => el.id !== id),
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  insertSpacer: (beforeBlockIndex, h = 80) => {
    const newId = newBlockId();
    set((s) =>
      withDoc(s, (doc) => {
        const { blocks, attachments, branchFlows } = doc.mainFlow;
        const newBlocks = [
          ...blocks.slice(0, beforeBlockIndex),
          { id: newId, type: "spacer" as const, h },
          ...blocks.slice(beforeBlockIndex),
        ];
        return {
          doc: {
            ...doc,
            mainFlow: normalizeMainFlow({ blocks: newBlocks, attachments, branchFlows }),
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return newId;
  },

  updateSpacerHeight: (blockId, h) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            blocks: doc.mainFlow.blocks.map((b) =>
              b.id === blockId && b.type === "spacer" ? { ...b, h } : b,
            ),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  insertColumnBreak: (beforeBlockIndex) => {
    const newId = newBlockId();
    set((s) =>
      withDoc(s, (doc) => {
        const { blocks, attachments, branchFlows } = doc.mainFlow;
        const newBlocks = [
          ...blocks.slice(0, beforeBlockIndex),
          { id: newId, type: "columnBreak" as const },
          ...blocks.slice(beforeBlockIndex),
        ];
        return {
          doc: {
            ...doc,
            mainFlow: { blocks: newBlocks, attachments, branchFlows: branchFlows ?? [] },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return newId;
  },

  createBranchFlow: (sourceArrowId) => {
    const id = newBlockId();
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            branchFlows: [
              ...(doc.mainFlow.branchFlows ?? []),
              { id, sourceArrowId, mergeTargetArrowId: null, blocks: [], attachments: [] } satisfies BranchFlow,
            ],
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    );
    return id;
  },

  insertBranchOperation: (branchFlowId, beforeBlockIndex, text = "") => {
    const newId = newBlockId();
    set((s) =>
      withDoc(s, (doc) => {
        const bfs = doc.mainFlow.branchFlows ?? [];
        const newBfs = bfs.map((bf) => {
          if (bf.id !== branchFlowId) return bf;
          const newBlocks = [
            ...bf.blocks.slice(0, beforeBlockIndex),
            { id: newId, type: "operation" as const, text },
            ...bf.blocks.slice(beforeBlockIndex),
          ] as BranchFlow["blocks"];
          return normalizeBranchFlow({ ...bf, blocks: newBlocks });
        });
        return {
          doc: {
            ...doc,
            mainFlow: { ...doc.mainFlow, branchFlows: newBfs },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return newId;
  },

  updateBranchOperationText: (branchFlowId, blockId, text, richText) =>
    set((s) =>
      withDoc(s, (doc) => {
        const bf = (doc.mainFlow.branchFlows ?? []).find((f) => f.id === branchFlowId);
        const cur = bf?.blocks.find((b) => b.id === blockId);
        if (
          cur?.type === "operation" &&
          cur.text === text &&
          (cur.richText ?? undefined) === (richText ?? undefined)
        ) return {};
        return {
          doc: {
            ...doc,
            mainFlow: {
              ...doc.mainFlow,
              branchFlows: (doc.mainFlow.branchFlows ?? []).map((f) =>
                f.id !== branchFlowId
                  ? f
                  : {
                      ...f,
                      blocks: f.blocks.map((b) =>
                        b.id === blockId && b.type === "operation"
                          ? { ...b, text, richText: richText ?? undefined }
                          : b,
                      ) as BranchFlow["blocks"],
                    },
              ),
            },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),

  deleteBranchBlock: (branchFlowId, blockId) =>
    set((s) =>
      withDoc(s, (doc) => {
        const newBfs = (doc.mainFlow.branchFlows ?? []).map((bf) => {
          if (bf.id !== branchFlowId) return bf;
          const newBlocks = bf.blocks.filter((b) => b.id !== blockId) as BranchFlow["blocks"];
          return normalizeBranchFlow({ ...bf, blocks: newBlocks });
        });
        return {
          doc: {
            ...doc,
            mainFlow: { ...doc.mainFlow, branchFlows: newBfs },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),

  moveBranchBlock: (branchFlowId, blockId, beforeBlockIndex) =>
    set((s) =>
      withDoc(s, (doc) => {
        const newBfs = (doc.mainFlow.branchFlows ?? []).map((bf) => {
          if (bf.id !== branchFlowId) return bf;
          const fromIdx = bf.blocks.findIndex((b) => b.id === blockId);
          if (fromIdx < 0) return bf;
          const block = bf.blocks[fromIdx];
          const without = bf.blocks.filter((b) => b.id !== blockId);
          const adjusted = beforeBlockIndex > fromIdx ? beforeBlockIndex - 1 : beforeBlockIndex;
          const clamped = Math.max(0, Math.min(adjusted, without.length));
          const reordered = [
            ...without.slice(0, clamped),
            block,
            ...without.slice(clamped),
          ] as BranchFlow["blocks"];
          return normalizeBranchFlow({ ...bf, blocks: reordered });
        });
        return {
          doc: {
            ...doc,
            mainFlow: { ...doc.mainFlow, branchFlows: newBfs },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),

  insertBranchSpacer: (branchFlowId, beforeBlockIndex, h = 80) => {
    const newId = newBlockId();
    set((s) =>
      withDoc(s, (doc) => {
        const newBfs = (doc.mainFlow.branchFlows ?? []).map((bf) => {
          if (bf.id !== branchFlowId) return bf;
          const newBlocks = [
            ...bf.blocks.slice(0, beforeBlockIndex),
            { id: newId, type: "spacer" as const, h },
            ...bf.blocks.slice(beforeBlockIndex),
          ] as BranchFlow["blocks"];
          return normalizeBranchFlow({ ...bf, blocks: newBlocks });
        });
        return {
          doc: {
            ...doc,
            mainFlow: { ...doc.mainFlow, branchFlows: newBfs },
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return newId;
  },

  updateBranchSpacerHeight: (branchFlowId, blockId, h) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            branchFlows: (doc.mainFlow.branchFlows ?? []).map((bf) =>
              bf.id !== branchFlowId
                ? bf
                : {
                    ...bf,
                    blocks: bf.blocks.map((b) =>
                      b.id === blockId && b.type === "spacer" ? { ...b, h } : b,
                    ) as BranchFlow["blocks"],
                  },
            ),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  setBranchMergeTarget: (branchFlowId, targetArrowId) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            branchFlows: (doc.mainFlow.branchFlows ?? []).map((bf) =>
              bf.id === branchFlowId ? { ...bf, mergeTargetArrowId: targetArrowId } : bf,
            ),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  removeBranchFlow: (branchFlowId) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            branchFlows: (doc.mainFlow.branchFlows ?? []).filter((bf) => bf.id !== branchFlowId),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  insertBranch: (beforeBlockIndex) => {
    const newId = newBlockId();
    set((s) =>
      withDoc(s, (doc) => {
        const { blocks, attachments, branchFlows } = doc.mainFlow;
        const newBlocks = [
          ...blocks.slice(0, beforeBlockIndex),
          { id: newId, type: "branch" as const, condition: "", yesLabel: "はい", noLabel: "いいえ" },
          ...blocks.slice(beforeBlockIndex),
        ];
        return {
          doc: {
            ...doc,
            mainFlow: normalizeMainFlow({ blocks: newBlocks, attachments, branchFlows }),
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    );
    return newId;
  },

  updateBranch: (blockId, patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          mainFlow: {
            ...doc.mainFlow,
            blocks: doc.mainFlow.blocks.map((b) =>
              b.id === blockId && b.type === "branch" ? { ...b, ...patch } : b,
            ),
          },
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  addFreeTableElement: (x, y, rows, cols) => {
    const id = newFreeElementId();
    const cellW = Math.min(120, Math.floor(600 / cols));
    const cellH = 36;
    const w = cols * cellW;
    const h = rows * cellH;
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: [
            ...doc.freeElements,
            { id, type: "table" as const, x, y, w, h, rows, cols, cells: {} },
          ],
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    );
    return id;
  },

  updateTableCell: (tableId, row, col, patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: doc.freeElements.map((el) => {
            if (el.id !== tableId || el.type !== "table") return el;
            const key = `${row},${col}`;
            const existing = el.cells[key] ?? { text: "" };
            return { ...el, cells: { ...el.cells, [key]: { ...existing, ...patch } } };
          }),
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  updateFreeTableElement: (id, patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: doc.freeElements.map((el) =>
            el.id === id && el.type === "table" ? { ...el, ...patch } : el,
          ),
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  updateTableStyles: (tableId, style) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: doc.freeElements.map((el) => {
            if (el.id !== tableId || el.type !== "table") return el;
            // 全セルにスタイルを適用（既存セルを更新 + 空セルも生成）
            const updatedCells: Record<string, TableCell> = {};
            for (let r = 0; r < el.rows; r++) {
              for (let c = 0; c < el.cols; c++) {
                const key = `${r},${c}`;
                const existing = el.cells[key] ?? { text: "" };
                updatedCells[key] = { ...existing, ...style };
              }
            }
            return { ...el, cells: updatedCells };
          }),
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  addFreeArrowElement: (points) => {
    const id = newFreeElementId();
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: [
            ...doc.freeElements,
            { id, type: "arrow" as const, points, color: "#374151", strokeWidth: 2 },
          ],
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    );
    return id;
  },

  updateFreeArrowElement: (id, patch) =>
    set((s) =>
      withDoc(s, (doc) => ({
        doc: {
          ...doc,
          freeElements: doc.freeElements.map((el) =>
            el.id === id && el.type === "arrow" ? { ...el, ...patch } : el,
          ),
          meta: { ...doc.meta, updatedAt: nowIso() },
        },
        isDirty: true,
      })),
    ),

  replaceAll: (query, replacement) => {
    let count = 0;
    set((s) =>
      withDoc(s, (doc) => {
        // ヘッダー
        const titlePlain = doc.meta.titleRich ? "" : doc.meta.title;
        const authorPlain = doc.meta.authorRich ? "" : doc.meta.author;
        count += countInText(doc.meta.titleRich
          ? doc.meta.titleRich.replace(/<[^>]+>/g, "")
          : doc.meta.title, query);
        count += countInText(doc.meta.authorRich
          ? doc.meta.authorRich.replace(/<[^>]+>/g, "")
          : doc.meta.author, query);

        const newMeta = { ...doc.meta };
        if (doc.meta.titleRich) {
          newMeta.titleRich = replaceInHtml(doc.meta.titleRich, query, replacement);
          newMeta.title = newMeta.titleRich.replace(/<[^>]+>/g, "");
        } else {
          newMeta.title = replaceInText(doc.meta.title, query, replacement);
        }
        if (doc.meta.authorRich) {
          newMeta.authorRich = replaceInHtml(doc.meta.authorRich, query, replacement);
          newMeta.author = newMeta.authorRich.replace(/<[^>]+>/g, "");
        } else {
          newMeta.author = replaceInText(doc.meta.author, query, replacement);
        }

        // OperationBlock
        const newBlocks = doc.mainFlow.blocks.map((block) => {
          if (block.type !== "operation") return block;
          if (block.richText) {
            const newRich = replaceInHtml(block.richText, query, replacement);
            return { ...block, richText: newRich, text: newRich.replace(/<[^>]+>/g, "") };
          }
          return { ...block, text: replaceInText(block.text, query, replacement) };
        });

        // Attachment
        const newAttachments = doc.mainFlow.attachments.map((att) => {
          if (att.richText) {
            const newRich = replaceInHtml(att.richText, query, replacement);
            return { ...att, richText: newRich, text: newRich.replace(/<[^>]+>/g, "") };
          }
          return { ...att, text: replaceInText(att.text, query, replacement) };
        });

        // FreeElements
        const newFreeElements = doc.freeElements.map((el) => {
          if (el.type === "text") {
            // el.text はインライン書式 HTML を含む場合があるため replaceInHtml を使用
            // （replaceInText だと HTML タグ属性内の文字列まで置換されてしまう）
            const newText = replaceInHtml(el.text ?? "", query, replacement);
            return { ...el, text: newText };
          }
          if (el.type === "table") {
            const newCells = { ...el.cells };
            for (let r = 0; r < el.rows; r++) {
              for (let c = 0; c < el.cols; c++) {
                const key = `${r},${c}`;
                const cell = el.cells[key];
                if (!cell) continue;
                if (cell.richText) {
                  const newRich = replaceInHtml(cell.richText, query, replacement);
                  newCells[key] = { ...cell, richText: newRich, text: newRich.replace(/<[^>]+>/g, "") };
                } else if (cell.text) {
                  newCells[key] = { ...cell, text: replaceInText(cell.text, query, replacement) };
                }
              }
            }
            return { ...el, cells: newCells };
          }
          return el;
        });

        // count は上で heuristically 計算済みだが replaceAll は副作用なので 0 を返しても問題なし
        void titlePlain; void authorPlain;

        return {
          doc: {
            ...doc,
            meta: { ...newMeta, updatedAt: nowIso() },
            mainFlow: normalizeMainFlow({ blocks: newBlocks, attachments: newAttachments, branchFlows: doc.mainFlow.branchFlows }),
            freeElements: newFreeElements,
          },
          isDirty: true,
        };
      }),
    );
    return count;
  },

  moveBlock: (blockId, beforeBlockIndex) =>
    set((s) =>
      withDoc(s, (doc) => {
        const { blocks, attachments, branchFlows } = doc.mainFlow;
        const fromIdx = blocks.findIndex((b) => b.id === blockId);
        if (fromIdx < 0) return {};
        const block = blocks[fromIdx];
        const without = blocks.filter((b) => b.id !== blockId);
        // beforeBlockIndex は元配列の index なので除去後にずらす
        const adjusted = beforeBlockIndex > fromIdx ? beforeBlockIndex - 1 : beforeBlockIndex;
        const clamped = Math.max(0, Math.min(adjusted, without.length));
        const reordered = [
          ...without.slice(0, clamped),
          block,
          ...without.slice(clamped),
        ];
        return {
          doc: {
            ...doc,
            mainFlow: normalizeMainFlow({ blocks: reordered, attachments, branchFlows }),
            meta: { ...doc.meta, updatedAt: nowIso() },
          },
          isDirty: true,
        };
      }),
    ),
}));
