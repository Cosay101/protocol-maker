// 編集画面の UI 状態。caret / 選択 / パネル表示 / フォーカスゾーンなど。
import { create } from "zustand";
import type { EditorCaret, FocusZone } from "@/types/ptcl";

export type UiState = {
  caret: EditorCaret;
  selectedFreeIds: string[];
  focusZone: FocusZone;
  leftPaletteOpen: boolean;
  rightInspectorOpen: boolean;
  /**
   * テキスト編集中の OperationBlock の id。
   * 編集モード（textarea がアクティブ）のとき非 null になる。
   * リボンのフォント操作は editingBlockId が非 null のときは無効化する。
   */
  editingBlockId: string | null;

  // ---- actions ----
  setCaret: (caret: EditorCaret) => void;
  setSelectedFreeIds: (ids: string[]) => void;
  setFocusZone: (zone: FocusZone) => void;
  toggleLeftPalette: () => void;
  toggleRightInspector: () => void;
  setEditingBlockId: (id: string | null) => void;
  /** 挿入モード（"text": テキストボックス配置、"arrow": 自由矢印描画、"branch": 分岐作成） */
  insertMode: "text" | "arrow" | "branch" | null;
  setInsertMode: (mode: "text" | "arrow" | "branch" | null) => void;
  /** 選択中の自由配置要素 id */
  selectedFreeId: string | null;
  setSelectedFreeId: (id: string | null) => void;
  /**
   * 表内で選択中のセル。
   * mode="cell" または mode="edit" のときに FreeTableBox がセットする。
   * mode="table"（全体選択）または表非選択のときは null。
   * リボンのスタイル適用先判定に使用する。
   */
  selectedTableCell: { tableId: string; row: number; col: number } | null;
  setSelectedTableCell: (v: { tableId: string; row: number; col: number } | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  caret: { kind: "none" },
  selectedFreeIds: [],
  focusZone: "home",
  leftPaletteOpen: true,
  rightInspectorOpen: false,
  editingBlockId: null,
  insertMode: null,
  selectedFreeId: null,
  selectedTableCell: null,

  setCaret: (caret) => set({ caret }),
  setSelectedFreeIds: (selectedFreeIds) => set({ selectedFreeIds }),
  setFocusZone: (focusZone) => set({ focusZone }),
  toggleLeftPalette: () =>
    set((s) => ({ leftPaletteOpen: !s.leftPaletteOpen })),
  toggleRightInspector: () =>
    set((s) => ({ rightInspectorOpen: !s.rightInspectorOpen })),
  setEditingBlockId: (editingBlockId) => set({ editingBlockId }),
  setInsertMode: (insertMode) => set({ insertMode }),
  setSelectedFreeId: (selectedFreeId) => set({ selectedFreeId }),
  setSelectedTableCell: (selectedTableCell) => set({ selectedTableCell }),
}));
