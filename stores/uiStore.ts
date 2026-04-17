// 編集画面の UI 状態。caret / 選択 / パネル表示 / フォーカスゾーンなど。
import { create } from "zustand";
import type { EditorCaret, FocusZone } from "@/types/ptcl";

export type UiState = {
  caret: EditorCaret;
  selectedFreeIds: string[];
  focusZone: FocusZone;
  leftPaletteOpen: boolean;
  rightInspectorOpen: boolean;

  // ---- actions ----
  setCaret: (caret: EditorCaret) => void;
  setSelectedFreeIds: (ids: string[]) => void;
  setFocusZone: (zone: FocusZone) => void;
  toggleLeftPalette: () => void;
  toggleRightInspector: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  caret: { kind: "none" },
  selectedFreeIds: [],
  focusZone: "home",
  leftPaletteOpen: true,
  rightInspectorOpen: false,

  setCaret: (caret) => set({ caret }),
  setSelectedFreeIds: (selectedFreeIds) => set({ selectedFreeIds }),
  setFocusZone: (focusZone) => set({ focusZone }),
  toggleLeftPalette: () =>
    set((s) => ({ leftPaletteOpen: !s.leftPaletteOpen })),
  toggleRightInspector: () =>
    set((s) => ({ rightInspectorOpen: !s.rightInspectorOpen })),
}));
