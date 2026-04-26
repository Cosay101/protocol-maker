// 編集画面の表示設定（フォント・レイアウト）。
// ドキュメントをまたいで保持するUI設定として localStorage に永続化。
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontFamily = "gothic" | "mincho";

export const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32] as const;

/**
 * フォントファミリーの CSS 文字列。
 * PtclGothic / PtclMincho は public/fonts/ 以下のカスタムフォント（globals.css で @font-face 定義済み）。
 * ファイル未配置時はシステムフォントにフォールバックする。
 */
export const FONT_CSS: Record<FontFamily, string> = {
  gothic:
    "'PtclGothic', 'Hiragino Sans', 'ヒラギノ角ゴシック', 'Noto Sans JP', 'Yu Gothic', sans-serif",
  mincho:
    "'PtclMincho', 'Hiragino Mincho ProN', 'ヒラギノ明朝 ProN W3', 'Noto Serif JP', 'Yu Mincho', serif",
};

export type TextAlign = "left" | "center" | "right";

export type DisplayState = {
  // ---- フォント ----
  fontFamily: FontFamily;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: TextAlign;

  // ---- レイアウト ----
  /**
   * ボックス＋矢印を含むフロー列の幅 (px)。
   * 単一列のとき、この幅でフロー全体が描画される。
   * 多列のときは列数に応じて自動分割された幅が優先される。
   */
  flowWidth: number;
  /**
   * ブロックと矢印の間の余白 (px)。
   * MainFlow の flex コンテナに rowGap として適用される。
   */
  blockGap: number;

  // ---- actions ----
  setFontFamily: (f: FontFamily) => void;
  setFontSize: (s: number) => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  setTextAlign: (a: TextAlign) => void;
  setFlowWidth: (w: number) => void;
  adjustFlowWidth: (delta: number) => void;
  setBlockGap: (g: number) => void;
  adjustBlockGap: (delta: number) => void;
};

const FLOW_WIDTH_MIN = 100;
const FLOW_WIDTH_MAX = 800;
const clampFlow = (w: number) =>
  Math.max(FLOW_WIDTH_MIN, Math.min(FLOW_WIDTH_MAX, w));

const BLOCK_GAP_MIN = -20; // 負値で隙間を詰める（InsertGap の最小高さは 4px）
const BLOCK_GAP_MAX = 60;
const clampGap = (g: number) =>
  Math.max(BLOCK_GAP_MIN, Math.min(BLOCK_GAP_MAX, g));

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      fontFamily: "gothic",
      fontSize: 14,
      bold: false,
      italic: false,
      underline: false,
      textAlign: "center",
      flowWidth: 300,
      blockGap: -20,

      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleBold: () => set((s) => ({ bold: !s.bold })),
      toggleItalic: () => set((s) => ({ italic: !s.italic })),
      toggleUnderline: () => set((s) => ({ underline: !s.underline })),
      setTextAlign: (textAlign) => set({ textAlign }),
      setFlowWidth: (w) => set({ flowWidth: clampFlow(w) }),
      adjustFlowWidth: (delta) =>
        set((s) => ({ flowWidth: clampFlow(s.flowWidth + delta) })),
      setBlockGap: (g) => set({ blockGap: clampGap(g) }),
      adjustBlockGap: (delta) =>
        set((s) => ({ blockGap: clampGap(s.blockGap + delta) })),
    }),
    { name: "ptcl-display-settings" },
  ),
);
