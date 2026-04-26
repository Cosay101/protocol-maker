// mainFlow の列レイアウト計算ユーティリティ。
// ブロックの高さを推定して列スライスに分割し、複数列・複数ページを生成する。
import type { MainFlowBlock, Attachment, BranchFlow } from "@/types/ptcl";

// ---- 推定高さ定数 ----
const INSERT_GAP_H = 20;  // InsertGap の高さ
const OP_BLOCK_H = 44;    // OperationBlock（py-1*2=8 + py-2*2=16 + text-sm leading-snug ≈19 = 43px）
const ARROW_BASE_H = 46;  // ArrowBlock ベース（STEM_TOP=8 + STEM_BOTTOM=18 + InsertGap=20 = 46px）
const SIDE_ROW_H = 32;    // side-in / side-out 行高
const LOOP_ROW_H = 18;    // loop 行高

// ---- 用紙サイズ（@96dpi, portrait 基準の px） ----
export const PAPER_DIMS = {
  A3: { w: 1122, h: 1587 },
  A4: { w: 794,  h: 1123 },
  A5: { w: 559,  h: 794  },
  B4: { w: 972,  h: 1376 },
  B5: { w: 688,  h: 971  },
} as const;

export type PaperSize = keyof typeof PAPER_DIMS;

/** 用紙サイズ・向きから実際のピクセル寸法を返す */
export function getPaperDims(
  size: string,
  orientation: string,
): { w: number; h: number } {
  const base = PAPER_DIMS[size as PaperSize] ?? PAPER_DIMS.A4;
  return orientation === "landscape"
    ? { w: base.h, h: base.w }
    : { w: base.w, h: base.h };
}

/** 用紙幅から本文幅を計算（px-16 = 64px × 2 のパディング） */
export function contentWidthFromPaper(paperW: number): number {
  return paperW - 128;
}

/** ページ1枚あたりのmainFlow利用可能高さを計算 */
export function colMaxHeight(paperH: number, hasHeader: boolean): number {
  // py-12 (top+bottom=96px)
  // ヘッダー実測: 3行×23px + gap-2×2=16 + pb-4=16 + border≈1 ≈ 102px
  // mt-6 = 24px
  return paperH - 96 - (hasHeader ? 102 + 24 : 0);
}

// ---- ページ・列レイアウト定数 ----
/** デフォルト: A4 portrait の本文幅 */
export const PAGE_CONTENT_W = 666;
export const COL_GAP = 24;         // 列間ギャップ
export const MAX_COLS_PER_PAGE = 3; // 1ページあたりの最大列数
export const COL_MAX_H = 900;      // mainFlow 列の最大高さ（A4 portrait, ヘッダーあり）

// columnBreak ブロックの視覚上の高さ
const COLUMN_BREAK_H = 28;

/** ブロック1つの推定高さ（直後の InsertGap を含む） */
export function estimateBlockH(
  block: MainFlowBlock,
  attachments: Attachment[],
): number {
  if (block.type === "operation") {
    return OP_BLOCK_H + INSERT_GAP_H;
  }
  if (block.type === "spacer") {
    return block.h; // spacer の高さはそのまま使う
  }
  if (block.type === "columnBreak") {
    return COLUMN_BREAK_H;
  }
  // arrow
  const atts = attachments.filter((a) => a.anchorId === block.id);
  const rowsH = atts.reduce(
    (h, a) => h + (a.kind === "loop" ? LOOP_ROW_H : SIDE_ROW_H),
    0,
  );
  return ARROW_BASE_H + rowsH;
}

/** n 列のときの列幅（contentW: 本文幅、省略時は A4 portrait デフォルト） */
export function columnWidthForCount(n: number, contentW: number = PAGE_CONTENT_W): number {
  if (n <= 1) return contentW;
  return Math.floor((contentW - COL_GAP * (n - 1)) / n);
}

export type ColSlice = { startIdx: number; endIdx: number };

/**
 * blocks を高さ maxH に収まる列スライスに分割する。
 * columnBreak ブロックが現れた位置で強制的に次の列へ分割する。
 * 必ず少なくとも 1 スライスを返す（空配列になることはない）。
 */
export function splitIntoColumns(
  blocks: MainFlowBlock[],
  attachments: Attachment[],
  maxH: number = COL_MAX_H,
): ColSlice[] {
  if (blocks.length === 0) return [{ startIdx: 0, endIdx: 0 }];

  const slices: ColSlice[] = [];
  let colStart = 0;
  // 先頭 + 末尾 InsertGap の分
  let colH = INSERT_GAP_H * 2;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // columnBreak: このブロックを含む現在の列を閉じ、次の列を開始
    if (block.type === "columnBreak") {
      slices.push({ startIdx: colStart, endIdx: i + 1 });
      colStart = i + 1;
      colH = INSERT_GAP_H * 2;
      continue;
    }

    const h = estimateBlockH(block, attachments);

    if (colH + h > maxH && i > colStart) {
      // このブロックを次の列へ
      slices.push({ startIdx: colStart, endIdx: i });
      colStart = i;
      colH = INSERT_GAP_H * 2 + h;
    } else {
      colH += h;
    }
  }
  // colStart から末尾が残っているときだけ push（columnBreak が末尾の場合は不要）
  if (colStart <= blocks.length) {
    slices.push({ startIdx: colStart, endIdx: blocks.length });
  }

  // 空スライスを除外（columnBreak が連続した場合など）
  const nonEmpty = slices.filter((s) => s.startIdx < s.endIdx || slices.length === 1);
  return nonEmpty.length > 0 ? nonEmpty : [{ startIdx: 0, endIdx: 0 }];
}

/** ColSlice[] を maxColsPerPage ごとにページにグループ化 */
export function groupIntoPages(
  slices: ColSlice[],
  maxColsPerPage: number = MAX_COLS_PER_PAGE,
): ColSlice[][] {
  const n = Math.max(1, Math.min(maxColsPerPage, MAX_COLS_PER_PAGE));
  const pages: ColSlice[][] = [];
  for (let i = 0; i < slices.length; i += n) {
    pages.push(slices.slice(i, i + n));
  }
  if (pages.length === 0) pages.push([{ startIdx: 0, endIdx: 0 }]);
  return pages;
}

// ============================================================
// 分岐列を含むレイアウト
// ============================================================

/** 列の種別: 主フローの一区間 or 分岐列 */
export type ColumnDescriptor =
  | { type: "main"; startIdx: number; endIdx: number }
  | { type: "branch"; branchFlowId: string };

export type PageLayout = ColumnDescriptor[][];

/**
 * 主フローと分岐列を考慮したページレイアウトを計算する。
 *
 * - 主フローを splitIntoColumns で列に分割する
 * - 各主フロー列に分岐がアタッチされている場合、その直後に分岐列を挿入する
 * - 主フロー列 + 分岐列のペアは常に同じページに配置される（分離しない）
 * - ページあたりの最大列数 maxColsPerPage を超える場合は次ページへ
 */
export function layoutWithBranches(
  blocks: MainFlowBlock[],
  attachments: Attachment[],
  branchFlows: BranchFlow[],
  maxH: number,
  maxColsPerPage: number,
): PageLayout {
  const mainSlices = splitIntoColumns(blocks, attachments, maxH);

  // 各主フロー列に対して ColumnDescriptor を生成。
  // 分岐元の矢印を含む列の直後に分岐列を挿入する。
  type Group = ColumnDescriptor[]; // 必ず一緒に同じページに置く単位
  const groups: Group[] = [];

  for (const slice of mainSlices) {
    const group: Group = [{ type: "main", startIdx: slice.startIdx, endIdx: slice.endIdx }];

    // この列に含まれるブロックのうち、分岐の sourceArrowId に一致するものを探す
    for (let i = slice.startIdx; i < slice.endIdx; i++) {
      const block = blocks[i];
      const bf = branchFlows.find((f) => f.sourceArrowId === block.id);
      if (bf) {
        group.push({ type: "branch", branchFlowId: bf.id });
        break; // 1 列につき最大 1 つの分岐
      }
    }

    groups.push(group);
  }

  // グループをページに詰め込む。グループは必ず丸ごと同じページに入れる。
  const pages: PageLayout = [];
  let currentPage: ColumnDescriptor[] = [];

  for (const group of groups) {
    if (currentPage.length + group.length > maxColsPerPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
    }
    currentPage.push(...group);
  }
  if (currentPage.length > 0) pages.push(currentPage);
  if (pages.length === 0) pages.push([{ type: "main", startIdx: 0, endIdx: 0 }]);

  return pages;
}
