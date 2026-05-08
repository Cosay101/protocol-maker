"use client";
// Edit 画面。タブバー + リボン + 紙面キャンバス。
import { Suspense, useEffect, useLayoutEffect, useCallback, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDocumentStore } from "@/stores/documentStore";
import { useUiStore } from "@/stores/uiStore";
import { useDisplayStore, FONT_SIZES, FONT_CSS, type FontFamily, type TextAlign } from "@/stores/displayStore";
import type { TextFreeElement, ImageFreeElement, TableFreeElement, TableCell, FreeElement } from "@/types/ptcl";
import { MainFlow } from "@/components/edit/MainFlow";
import { BranchColumn } from "@/components/edit/BranchColumn";
import { FreeTextBox } from "@/components/edit/FreeTextBox";
import { FreeImageBox } from "@/components/edit/FreeImageBox";
import { FreeTableBox } from "@/components/edit/FreeTableBox";
import { FreeArrowBox } from "@/components/edit/FreeArrowBox";
import { ImagePalette } from "@/components/edit/ImagePalette";
import { TablePalette } from "@/components/edit/TablePalette";
import { FindReplacePalette } from "@/components/edit/FindReplacePalette";
import { useSearchStore } from "@/stores/searchStore";
import { highlightHtml } from "@/lib/ptcl/search";
import type { LibraryImage } from "@/stores/imageLibraryStore";
import {
  layoutWithBranches,
  columnWidthForCount,
  MAX_COLS_PER_PAGE,
  COL_GAP,
  getPaperDims,
  contentWidthFromPaper,
  colMaxHeight,
} from "@/lib/ptcl/layout";
import { saveDocument } from "@/lib/ptcl/io";
import { savePtclDialog } from "@/lib/tauri/dialog";
import { isTauri } from "@/lib/tauri/fs";

const APP_VERSION = "0.1.0-beta.1";

// ============================================================
// ページルート
// ============================================================
export default function EditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center text-sm text-neutral-400">
          読み込み中…
        </div>
      }
    >
      <EditPageInner />
    </Suspense>
  );
}

function EditPageInner() {
  const params = useSearchParams();
  const shouldPrint = params.get("print") === "1";

  const createNew = useDocumentStore((s) => s.createNew);
  const doc = useDocumentStore((s) => s.doc);
  const isDirty = useDocumentStore((s) => s.isDirty);

  useEffect(() => {
    if (!doc) createNew();
  }, [doc, createNew]);

  // ?print=1 → ドキュメント読み込み後に印刷ダイアログを自動起動
  useEffect(() => {
    if (!shouldPrint || !doc) return;
    const timer = setTimeout(() => {
      // @page サイズをドキュメントの用紙設定に合わせて動的注入
      const prev = document.getElementById("__ptcl_page_size__");
      if (prev) prev.remove();
      const style = document.createElement("style");
      style.id = "__ptcl_page_size__";
      style.textContent = `@page { size: ${doc.page.size} ${doc.page.orientation}; margin: 0; }`;
      document.head.appendChild(style);
      window.print();
      window.addEventListener("afterprint", () => style.remove(), { once: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [shouldPrint, doc]);

  if (!doc) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-neutral-400">
        読み込み中…
      </div>
    );
  }

  const { w: paperW } = getPaperDims(doc.page.size, doc.page.orientation);

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100 text-neutral-900">
      {/* ---- ヘッダー 2 段構成 ---- */}
      <TabBar isDirty={isDirty} />
      <Ribbon />
      {/* ---- スクロール可能な紙面エリア ---- */}
      <div data-print-scroll className="flex min-h-0 flex-1 overflow-auto">
        <div data-print-canvas className="mx-auto my-8 flex flex-col gap-6" style={{ width: paperW }}>
          <PageCanvas />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// タブバー（← ファイル  |  編集▼）
// ============================================================
function TabBar({ isDirty }: { isDirty: boolean }) {
  return (
    <header data-no-print className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3">
      <div className="flex items-center">
        <Link
          href="/?tab=file"
          className="flex items-center gap-1 rounded px-2.5 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          <span className="text-xs opacity-70">←</span>
          <span>ファイル</span>
        </Link>
        <div className="mx-2 h-4 w-px bg-neutral-200" />
        {/* 編集タブ（アクティブ固定） */}
        <div className="flex h-9 items-center border-b-2 border-blue-500 px-3 text-sm font-medium text-blue-600">
          編集
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        {isDirty && <span className="text-amber-500">● 未保存</span>}
        <span>v{APP_VERSION}</span>
      </div>
    </header>
  );
}

// ============================================================
// リボン（フォント | レイアウト | 挿入）
// スタイルスコープ:
//   ブロック選択中 → そのブロックの style を上書き
//   何も選択していない → displayStore のグローバル設定を変更
// ============================================================
function Ribbon() {
  // グローバル設定
  const {
    fontFamily: gFontFamily, setFontFamily,
    fontSize: gFontSize, setFontSize,
    bold: gBold, toggleBold,
    italic: gItalic, toggleItalic,
    underline: gUnderline, toggleUnderline,
    textAlign: gTextAlign, setTextAlign,
    blockGap, setBlockGap, adjustBlockGap,
  } = useDisplayStore();

  // アンドゥ / リドゥ
  const undo      = useDocumentStore((s) => s.undo);
  const redo      = useDocumentStore((s) => s.redo);
  const canUndo   = useDocumentStore((s) => s.history.length > 0);
  const canRedo   = useDocumentStore((s) => s.future.length > 0);

  // ドキュメント・キャレット
  const caret = useUiStore((s) => s.caret);
  const editingBlockId = useUiStore((s) => s.editingBlockId);
  const selectedFreeId = useUiStore((s) => s.selectedFreeId);
  const selectedTableCell = useUiStore((s) => s.selectedTableCell);
  const doc = useDocumentStore((s) => s.doc);
  const setPage = useDocumentStore((s) => s.setPage);
  const updateBlockStyle       = useDocumentStore((s) => s.updateBlockStyle);
  const updateFreeElement      = useDocumentStore((s) => s.updateFreeElement);
  const updateTableStyles      = useDocumentStore((s) => s.updateTableStyles);
  const updateTableCell        = useDocumentStore((s) => s.updateTableCell);
  const updateAttachmentStyle  = useDocumentStore((s) => s.updateAttachmentStyle);
  const updateOperationText    = useDocumentStore((s) => s.updateOperationText);
  const pageSize    = doc?.page.size        ?? "A4";
  const orientation = doc?.page.orientation ?? "portrait";

  // 選択中の operation ブロック（なければ null）
  const selBlock =
    caret.kind === "block"
      ? doc?.mainFlow.blocks.find(
          (b) => b.id === caret.blockId && b.type === "operation",
        )
      : null;
  const selStyle = selBlock?.type === "operation" ? selBlock.style : undefined;
  const isBlock  = selBlock != null;

  // 選択中の自由配置テキストボックス（なければ null）
  const selFreeEl = selectedFreeId
    ? doc?.freeElements.find((e) => e.id === selectedFreeId) ?? null
    : null;

  // ---- contentEditable フォーカス追跡 ----
  // OperationBlock だけでなくヘッダーフィールドなど、
  // ページ上のあらゆる contentEditable への対応。
  const isInContentEditableRef = useRef(false);
  const savedRangesRef = useRef<Range[]>([]);
  const [inContentEditable, setInContentEditable] = useState(false);
  const [hasTextSelection, setHasTextSelection]   = useState(false);
  // 図・画像パレット
  const [imagePaletteOpen, setImagePaletteOpen] = useState(false);
  const [imagePaletteAnchor, setImagePaletteAnchor] = useState<DOMRect | null>(null);
  // 検索・置換パレット
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const imageBtnRef = useRef<HTMLDivElement>(null);
  // 上付き・下付きの現在アクティブ状態（インライン編集中の選択位置に基づく）
  const [isSupActive, setIsSupActive] = useState(false);
  const [isSubActive, setIsSubActive] = useState(false);
  // フォーカス中のアタッチメント id（アタッチメント contentEditable にフォーカスがあるとき非 null）
  // ※ selAttachment の計算より前に宣言が必要
  const focusedAttachmentIdRef = useRef<string | null>(null);
  const [focusedAttachmentId, setFocusedAttachmentId] = useState<string | null>(null);

  // フォーカス中のアタッチメント（なければ null）
  const selAttachment = focusedAttachmentId
    ? doc?.mainFlow.attachments.find((a) => a.id === focusedAttachmentId) ?? null
    : null;

  // 表示する有効値（ブロック個別 > FreeTextBox 個別 > アタッチメント個別 > グローバル継承）
  const selFreeStyle = selFreeEl?.type === "text" ? selFreeEl : null;
  const selAttStyle  = selAttachment?.style;

  // 表のセル選択中（mode="cell"/"edit"）: そのセルのスタイルをリボンに反映
  const selTableCellStyle =
    selectedTableCell && selFreeEl?.type === "table"
      ? (selFreeEl as TableFreeElement).cells[`${selectedTableCell.row},${selectedTableCell.col}`] ?? null
      : null;

  // 表全体選択中（mode="table"、selectedTableCell=null）: 代表として [0,0] セルを参照
  // updateTableStyles 後は全セルが同じ値になるため [0,0] で代表値を取得できる。
  // これにより select の value が実際のセル値と同期し onChange が正常に発火する。
  const selTableRepStyle =
    !selectedTableCell && selFreeEl?.type === "table"
      ? ((selFreeEl as TableFreeElement).cells["0,0"] ?? null)
      : null;

  const fontFamily = selStyle?.fontFamily ?? selTableCellStyle?.fontFamily ?? selTableRepStyle?.fontFamily ?? selFreeStyle?.fontFamily ?? selAttStyle?.fontFamily ?? gFontFamily;
  const fontSize   = selStyle?.fontSize   ?? selTableCellStyle?.fontSize   ?? selTableRepStyle?.fontSize   ?? selFreeStyle?.fontSize   ?? selAttStyle?.fontSize   ?? gFontSize;
  const bold       = selStyle?.bold       ?? selTableCellStyle?.bold       ?? selTableRepStyle?.bold       ?? selFreeStyle?.bold       ?? selAttStyle?.bold       ?? gBold;
  const italic     = selStyle?.italic     ?? selTableCellStyle?.italic     ?? selTableRepStyle?.italic     ?? selFreeStyle?.italic     ?? selAttStyle?.italic     ?? gItalic;
  const underline  = selStyle?.underline  ?? selTableCellStyle?.underline  ?? selTableRepStyle?.underline  ?? selFreeStyle?.underline  ?? selAttStyle?.underline  ?? gUnderline;
  const textAlign  = selStyle?.textAlign  ?? selTableCellStyle?.textAlign  ?? selTableRepStyle?.textAlign  ?? selFreeStyle?.textAlign  ?? gTextAlign;

  useEffect(() => {
    function onFocusin(e: FocusEvent) {
      const target = e.target as HTMLElement;
      // リボン要素へのフォーカス移動では contentEditable 状態を変えない。
      // select/button がクリックされても「直前に CE を編集していた」という情報を保持する。
      if (target.closest("[data-ribbon]")) return;
      const val = target.isContentEditable;
      isInContentEditableRef.current = val;
      setInContentEditable(val);
      // アタッチメント contentEditable かどうかを判定
      const attEl = val ? target.closest<HTMLElement>("[data-attachment-id]") : null;
      const attId = attEl?.getAttribute("data-attachment-id") ?? null;
      focusedAttachmentIdRef.current = attId;
      setFocusedAttachmentId(attId);
    }
    function onFocusout() {
      requestAnimationFrame(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active?.isContentEditable && !active?.closest("[data-ribbon]")) {
          isInContentEditableRef.current = false;
          setInContentEditable(false);
          savedRangesRef.current = [];
          setHasTextSelection(false);
          setIsSupActive(false);
          setIsSubActive(false);
          focusedAttachmentIdRef.current = null;
          setFocusedAttachmentId(null);
        }
      });
    }
    function onSelChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setHasTextSelection(false);
        setIsSupActive(false);
        setIsSubActive(false);
        // savedRangesRef は消さない（select クリック後にフォーカスが外れても保持）
        return;
      }
      const anchor = sel.anchorNode;
      const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement;
      const inCE = anchorEl?.closest("[contenteditable='true']") !== null;
      setHasTextSelection(inCE);
      if (inCE) {
        savedRangesRef.current = Array.from(
          { length: sel.rangeCount },
          (_, i) => sel.getRangeAt(i).cloneRange(),
        );
        // queryCommandState で上付き・下付きの現在状態を取得
        try {
          setIsSupActive(document.queryCommandState("superscript"));
          setIsSubActive(document.queryCommandState("subscript"));
        } catch {
          setIsSupActive(false);
          setIsSubActive(false);
        }
      }
    }
    document.addEventListener("focusin",        onFocusin);
    document.addEventListener("focusout",       onFocusout);
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      document.removeEventListener("focusin",        onFocusin);
      document.removeEventListener("focusout",       onFocusout);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, []);

  /**
   * 保存した選択範囲を、その範囲を持つ contentEditable に復元する。
   * フォント select などでフォーカスが外れた後に呼ぶ。
   */
  function restoreSelection(): HTMLElement | null {
    if (savedRangesRef.current.length === 0) return null;
    // 保存済み range の startContainer から親 contentEditable を特定
    const startNode = savedRangesRef.current[0].startContainer;
    const hostEl    = startNode.nodeType === Node.ELEMENT_NODE
      ? (startNode as Element)
      : startNode.parentElement;
    const ce =
      hostEl?.closest<HTMLElement>("[contenteditable='true']") ??
      document.querySelector<HTMLElement>("[contenteditable='true']");
    if (!ce) return null;
    ce.focus();
    const sel = window.getSelection();
    if (!sel) return null;
    sel.removeAllRanges();
    savedRangesRef.current.forEach((r) => {
      try { sel.addRange(r); } catch { /* 無効な範囲はスキップ */ }
    });
    return ce;
  }

  /**
   * contentEditable の選択範囲にインラインスタイルを適用する。
   * 適用後に対象スパンを再選択することで Office ライクな連続操作を可能にする。
   */
  function applyInlineStyle(cssProp: string, value: string) {
    const ce = restoreSelection();
    if (!ce) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    let span: HTMLSpanElement | null = null;
    try {
      span = document.createElement("span");
      span.style.setProperty(cssProp, value);
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span = document.createElement("span");
      span.style.setProperty(cssProp, value);
      span.appendChild(frag);
      range.insertNode(span);
    }
    if (span) {
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangesRef.current = [newRange.cloneRange()];
      setHasTextSelection(true);
    }
  }

  // ---- スタイル適用（インライン / セル / 表全体 / ブロック / グローバルを自動判定） ----
  function applyStyle(patch: Partial<typeof selStyle & object>) {
    const inCE     = isInContentEditableRef.current;
    const hasLive  = inCE && hasTextSelection;
    const hasSaved = inCE && !hasLive && savedRangesRef.current.length > 0;

    // ① テキスト選択あり（contentEditable 内で文字を選択している）
    //    → 選択範囲のみにインラインスタイルを適用
    if (hasLive) {
      // RibbonBtn は onMouseDown:preventDefault でフォーカスを維持しているので選択はそのまま生きている
      if ("bold"       in patch) document.execCommand("bold");
      if ("italic"     in patch) document.execCommand("italic");
      if ("underline"  in patch) document.execCommand("underline");
      if ("fontFamily" in patch) applyInlineStyle("font-family", FONT_CSS[patch.fontFamily!]);
      if ("fontSize"   in patch) applyInlineStyle("font-size",   `${patch.fontSize}px`);
      return;
    }
    // ② select でフォーカスが外れた後だが選択範囲が保存されている
    //    → 保存済み range を復元してインライン適用
    if (hasSaved) {
      if ("bold"       in patch) { restoreSelection(); document.execCommand("bold"); }
      if ("italic"     in patch) { restoreSelection(); document.execCommand("italic"); }
      if ("underline"  in patch) { restoreSelection(); document.execCommand("underline"); }
      if ("fontFamily" in patch) applyInlineStyle("font-family", FONT_CSS[patch.fontFamily!]);
      if ("fontSize"   in patch) applyInlineStyle("font-size",   `${patch.fontSize}px`);
      return;
    }

    // ③ アタッチメント CE にフォーカスがある（テキスト選択なし）
    //    → ブロックレベルでアタッチメントスタイルを保存
    if (inCE && focusedAttachmentIdRef.current) {
      const attPatch: Parameters<typeof updateAttachmentStyle>[1] = {};
      if ("fontFamily" in patch) attPatch.fontFamily = patch.fontFamily;
      if ("fontSize"   in patch) attPatch.fontSize   = patch.fontSize;
      if ("bold"       in patch) attPatch.bold        = patch.bold;
      if ("italic"     in patch) attPatch.italic      = patch.italic;
      if ("underline"  in patch) attPatch.underline   = patch.underline;
      if (Object.keys(attPatch).length > 0) updateAttachmentStyle(focusedAttachmentIdRef.current, attPatch);
      return;
    }

    // ④ 表のセル選択中（mode="cell" または mode="edit"、テキスト選択なし）
    //    → 選択中のセル 1 つだけにスタイルを適用
    if (selectedTableCell && selFreeEl?.type === "table") {
      const cellPatch: Parameters<typeof updateTableCell>[3] = {};
      if ("fontFamily" in patch) cellPatch.fontFamily = patch.fontFamily as "gothic" | "mincho" | undefined;
      if ("fontSize"   in patch) cellPatch.fontSize   = patch.fontSize   as number | undefined;
      if ("bold"       in patch) cellPatch.bold        = patch.bold       as boolean | undefined;
      if ("italic"     in patch) cellPatch.italic      = patch.italic     as boolean | undefined;
      if ("underline"  in patch) cellPatch.underline   = patch.underline  as boolean | undefined;
      if (Object.keys(cellPatch).length > 0) {
        updateTableCell(selFreeEl.id, selectedTableCell.row, selectedTableCell.col, cellPatch);
      }
      return;
    }

    // ⑤ 表全体選択（mode="table"、セル選択なし）
    //    → すべてのセルにスタイルを一括適用
    if (!selectedTableCell && selFreeEl?.type === "table") {
      const tPatch: Parameters<typeof updateTableStyles>[1] = {};
      if ("fontFamily" in patch) tPatch.fontFamily = patch.fontFamily as "gothic" | "mincho" | undefined;
      if ("fontSize"   in patch) tPatch.fontSize   = patch.fontSize   as number | undefined;
      if ("bold"       in patch) tPatch.bold        = patch.bold       as boolean | undefined;
      if ("italic"     in patch) tPatch.italic      = patch.italic     as boolean | undefined;
      if ("underline"  in patch) tPatch.underline   = patch.underline  as boolean | undefined;
      if (Object.keys(tPatch).length > 0) updateTableStyles(selFreeEl.id, tPatch);
      return;
    }

    // ⑥ 一般 CE（テキスト選択なし、表でもアタッチメントでもない）→ 何もしない
    if (inCE) return;

    // ⑦ ブロック / FreeTextBox / グローバル
    if (isBlock && caret.kind === "block") {
      updateBlockStyle(caret.blockId, patch);
    } else if (selFreeEl && selFreeEl.type === "text") {
      const fePatch: Partial<Omit<TextFreeElement, "id" | "type">> = {};
      if ("fontFamily" in patch) fePatch.fontFamily = patch.fontFamily as FontFamily | undefined;
      if ("fontSize"   in patch) fePatch.fontSize   = patch.fontSize   as number | undefined;
      if ("bold"       in patch) fePatch.bold        = patch.bold       as boolean | undefined;
      if ("italic"     in patch) fePatch.italic      = patch.italic     as boolean | undefined;
      if ("underline"  in patch) fePatch.underline   = patch.underline  as boolean | undefined;
      if (Object.keys(fePatch).length > 0) updateFreeElement(selFreeEl.id, fePatch);
    } else {
      if ("fontFamily" in patch) setFontFamily(patch.fontFamily!);
      if ("fontSize"   in patch) setFontSize(patch.fontSize!);
      if ("bold"       in patch) toggleBold();
      if ("italic"     in patch) toggleItalic();
      if ("underline"  in patch) toggleUnderline();
    }
  }

  /**
   * 上付き・下付き文字を適用する（Word 準拠）。
   * テキスト選択中のみ有効。再押しで解除（execCommand がトグルとして動作）。
   */
  function applySupSub(tag: "sup" | "sub") {
    const inCE     = isInContentEditableRef.current;
    const hasLive  = inCE && hasTextSelection;
    const hasSaved = inCE && !hasLive && savedRangesRef.current.length > 0;
    const cmd = tag === "sup" ? "superscript" : "subscript";

    if (hasLive) {
      document.execCommand(cmd); // 選択が生きているので直接実行 → toggle も正常動作
      return;
    }
    if (hasSaved) {
      restoreSelection();
      document.execCommand(cmd);
      return;
    }
    // テキスト選択なし → 何もしない（Word 準拠: 選択必須）
  }

  /**
   * 選択範囲内の上付き・下付き文字を解除して元のサイズに戻す（部分選択対応）。
   * ヘッダー・アタッチメント・FreeTextBox・OperationBlock すべての CE で動作する。
   *
   * ─ 部分選択の処理方針 ─
   *   <sup>AAAbbbCCC</sup> で "bbb" だけを選択 → <sup>AAA</sup>bbb<sup>CCC</sup>
   *   選択外の前後部分は同じタグで再ラップして残す。
   *
   * ─ なぜ extractContents を直接使わないか ─
   *   選択が <sup> の内側にある場合 extractContents はテキストノードのみを抽出し、
   *   <sup> ラッパー自体は DOM に残るため、何も変わらない。
   */
  function partialUnwrapSupSub(tag: Element, selRange: Range): void {
    const tagName = tag.tagName.toLowerCase(); // "sup" | "sub"
    const parent  = tag.parentNode!;

    // tag のコンテンツ範囲
    const tagRange = document.createRange();
    tagRange.selectNodeContents(tag);

    // 交差部分（clipped）= max(sel.start, tag.start) .. min(sel.end, tag.end)
    const clipped = document.createRange();
    if (selRange.compareBoundaryPoints(Range.START_TO_START, tagRange) > 0) {
      clipped.setStart(selRange.startContainer, selRange.startOffset);
    } else {
      clipped.setStart(tagRange.startContainer, tagRange.startOffset);
    }
    if (selRange.compareBoundaryPoints(Range.END_TO_END, tagRange) < 0) {
      clipped.setEnd(selRange.endContainer, selRange.endOffset);
    } else {
      clipped.setEnd(tagRange.endContainer, tagRange.endOffset);
    }
    if (clipped.collapsed) return;

    // ① 交差部分を tag から取り出す（タグなし素のテキスト/ノードとして）
    const intersectionFrag = clipped.extractContents();
    // clipped は extraction point に collapse（tag 内）

    // ② tag の残りの先頭から extraction point まで＝「選択前」を取り出して再ラップ
    //    tag が空（完全選択）の場合は newTagRange が collapsed になるのでスキップ
    const newTagRange = document.createRange();
    newTagRange.selectNodeContents(tag);

    let beforeTagEl: Element | null = null;
    if (!newTagRange.collapsed) {
      try {
        const beforeRange = document.createRange();
        beforeRange.setStart(newTagRange.startContainer, newTagRange.startOffset);
        beforeRange.setEnd(clipped.startContainer, clipped.startOffset);
        if (!beforeRange.collapsed) {
          const beforeFrag = beforeRange.extractContents();
          beforeTagEl = document.createElement(tagName);
          beforeTagEl.appendChild(beforeFrag);
        }
      } catch { /* extraction point が detach 済みの場合はスキップ */ }
    }

    // ③ DOM 再構築: tag の直前に [選択前タグ?] → [選択部分（タグなし）] を挿入
    //    tag に「選択後」が残っていれば維持、空なら削除
    if (beforeTagEl) parent.insertBefore(beforeTagEl, tag);
    parent.insertBefore(intersectionFrag, tag);
    if (tag.childNodes.length === 0) parent.removeChild(tag);
  }

  function clearSupSub() {
    const inCE    = isInContentEditableRef.current;
    const hasLive = inCE && hasTextSelection;
    const hasSaved = inCE && !hasLive && savedRangesRef.current.length > 0;

    if (!hasLive && !hasSaved) return;
    if (hasSaved) restoreSelection();

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range    = sel.getRangeAt(0);
    const anchor   = range.commonAncestorContainer;
    const anchorEl = anchor instanceof Element ? anchor : anchor.parentElement;
    const ce       = anchorEl?.closest("[contenteditable='true']");
    if (!ce) return;

    // 選択範囲と交差する <sup>/<sub> を収集し、後ろから処理してノードずれを防ぐ
    const matched = Array.from(ce.querySelectorAll("sup, sub")).filter((tag) =>
      range.intersectsNode(tag),
    );
    matched.reverse().forEach((tag) => {
      if (!tag.parentNode) return;
      partialUnwrapSupSub(tag as Element, range);
    });
  }

  /**
   * テキスト揃え位置を適用する（常にブロックレベル）。
   * 優先順位: 編集中ブロック → 選択中 operation → 選択中 FreeTextBox → グローバル
   */
  function applyTextAlign(align: TextAlign) {
    if (editingBlockId) {
      updateBlockStyle(editingBlockId, { textAlign: align });
      return;
    }
    if (isBlock && caret.kind === "block") {
      updateBlockStyle(caret.blockId, { textAlign: align });
      return;
    }
    // 表のセル選択中
    if (selectedTableCell && selFreeEl?.type === "table") {
      updateTableCell(selFreeEl.id, selectedTableCell.row, selectedTableCell.col, { textAlign: align });
      return;
    }
    // 表全体選択中
    if (!selectedTableCell && selFreeEl?.type === "table") {
      updateTableStyles(selFreeEl.id, { textAlign: align });
      return;
    }
    if (selFreeEl) {
      updateFreeElement(selFreeEl.id, { textAlign: align });
      return;
    }
    setTextAlign(align);
  }

  // B/I/U は「contentEditable 内で無選択」のときだけ無効。
  // ただしアタッチメント CE にフォーカスがある場合はブロックレベルで適用できるため有効にする。
  // 無選択かつ contentEditable 外（ブロック選択中 or 何も選択していない）は有効 → ブロック or グローバル適用。
  // 表のセル選択中（selectedTableCell != null）は CE 内でもセル全体に適用できるため有効にする。
  const biuDisabled = inContentEditable && !hasTextSelection && !focusedAttachmentId && !selectedTableCell;

  // 上付き・下付き: Word 準拠でテキスト選択中のみ有効
  const supSubDisabled = !hasTextSelection;
  // アクティブ状態: queryCommandState（選択範囲が既に sup/sub か）
  const supActive = isSupActive;
  const subActive = isSubActive;

  return (
    <div
      data-ribbon
      className="flex h-14 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-neutral-200 bg-white px-4 text-neutral-700 [&::-webkit-scrollbar]:hidden"
    >
      {/* ===== 書式グループ ===== */}


      {/* アンドゥ / リドゥ */}
      <RibbonBtn
        disabled={!canUndo}
        title="元に戻す (Ctrl+Z)"
        onClick={undo}
      >
        ↩
      </RibbonBtn>
      <RibbonBtn
        disabled={!canRedo}
        title="やり直し (Ctrl+Y)"
        onClick={redo}
      >
        ↪
      </RibbonBtn>

      <RibbonDivider />

      {/* フォント種別 */}
      <select
        value={fontFamily}
        onChange={(e) => applyStyle({ fontFamily: e.target.value as FontFamily })}
        className="h-8 rounded border border-neutral-200 px-1.5 text-sm outline-none hover:border-neutral-300 focus:border-blue-400"
      >
        <option value="gothic">ゴシック</option>
        <option value="mincho">明朝</option>
      </select>

      {/* サイズ */}
      <select
        value={fontSize}
        onChange={(e) => applyStyle({ fontSize: Number(e.target.value) })}
        className="h-8 w-16 rounded border border-neutral-200 px-1 text-sm outline-none hover:border-neutral-300 focus:border-blue-400"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* B / I / U */}
      <RibbonBtn active={bold}      disabled={biuDisabled} onClick={() => applyStyle({ bold: !bold })}           className="font-bold" title={biuDisabled ? "テキストを選択して適用" : "太字"}>B</RibbonBtn>
      <RibbonBtn active={italic}    disabled={biuDisabled} onClick={() => applyStyle({ italic: !italic })}       className="italic"    title={biuDisabled ? "テキストを選択して適用" : "斜体"}>I</RibbonBtn>
      <RibbonBtn active={underline} disabled={biuDisabled} onClick={() => applyStyle({ underline: !underline })} className="underline" title={biuDisabled ? "テキストを選択して適用" : "下線"}>U</RibbonBtn>

      {/* 上付き・下付き（テキスト選択中のみ有効・再押しで解除） */}
      <RibbonBtn
        active={supActive}
        disabled={supSubDisabled}
        title={supSubDisabled ? "テキストを選択して適用" : supActive ? "上付き文字を解除" : "上付き文字"}
        onClick={() => applySupSub("sup")}
      >
        x<sup style={{ fontSize: "0.6em" }}>2</sup>
      </RibbonBtn>
      <RibbonBtn
        active={subActive}
        disabled={supSubDisabled}
        title={supSubDisabled ? "テキストを選択して適用" : subActive ? "下付き文字を解除" : "下付き文字"}
        onClick={() => applySupSub("sub")}
      >
        x<sub style={{ fontSize: "0.6em" }}>2</sub>
      </RibbonBtn>

      {/* 上付き・下付き解除ボタン（元の大きさに戻す） */}
      <RibbonBtn
        disabled={supSubDisabled}
        title={supSubDisabled ? "テキストを選択して適用" : "上付き・下付き文字を解除（元の大きさに戻す）"}
        onClick={clearSupSub}
      >
        <span className="relative inline-flex items-baseline gap-[1px]">
          <span style={{ fontSize: "0.6em", verticalAlign: "super", textDecoration: "line-through", opacity: 0.7 }}>a</span>
          x
        </span>
      </RibbonBtn>

      <RibbonDivider />

      {/* 文字揃え */}
      <select
        value={textAlign}
        onChange={(e) => applyTextAlign(e.target.value as TextAlign)}
        title="文字揃え"
        className="h-8 rounded border border-neutral-200 px-1.5 text-sm outline-none hover:border-neutral-300 focus:border-blue-400"
      >
        <option value="left">← 左揃え</option>
        <option value="center">≡ 中央揃え</option>
        <option value="right">→ 右揃え</option>
      </select>

      <RibbonDivider />

      {/* ===== レイアウトグループ ===== */}

      {/* インデント（表示値 = blockGap + 20、ストア値 = 表示値 - 20） */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-neutral-400">インデント</span>
        <RibbonBtn onClick={() => adjustBlockGap(-2)} title="インデントを減らす">◀</RibbonBtn>
        <input
          type="number"
          value={blockGap + 20}
          min={0}
          max={80}
          step={2}
          onChange={(e) => setBlockGap(Number(e.target.value) - 20)}
          className="h-8 w-14 rounded border border-neutral-200 px-1 text-center text-sm outline-none focus:border-blue-400"
        />
        <RibbonBtn onClick={() => adjustBlockGap(2)} title="インデントを増やす">▶</RibbonBtn>
        <span className="text-xs text-neutral-400">px</span>
      </div>

      {/* 用紙サイズ */}
      <select
        value={pageSize}
        onChange={(e) =>
          setPage({ size: e.target.value as "A3" | "A4" | "A5" | "B4" | "B5" })
        }
        className="h-8 rounded border border-neutral-200 px-1.5 text-sm outline-none hover:border-neutral-300 focus:border-blue-400"
      >
        {(["A3", "A4", "A5", "B4", "B5"] as const).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* 縦横 */}
      <select
        value={orientation}
        onChange={(e) =>
          setPage({ orientation: e.target.value as "portrait" | "landscape" })
        }
        className="h-8 rounded border border-neutral-200 px-1.5 text-sm outline-none hover:border-neutral-300 focus:border-blue-400"
      >
        <option value="portrait">縦</option>
        <option value="landscape">横</option>
      </select>

      <RibbonDivider />

      {/* ===== 挿入グループ ===== */}
      {/* 図・画像ボタン + パレットドロップダウン */}
      <div ref={imageBtnRef} className="shrink-0">
        <RibbonBtn
          active={imagePaletteOpen}
          title="図・画像を挿入"
          onClick={() => {
            const rect = imageBtnRef.current?.getBoundingClientRect() ?? null;
            setImagePaletteAnchor(rect);
            setImagePaletteOpen((v) => !v);
          }}
        >
          図・画像
        </RibbonBtn>
        {imagePaletteOpen && imagePaletteAnchor && (
          <ImagePalette
            anchorRect={imagePaletteAnchor}
            onInsert={(img) => {
              const ev = new CustomEvent<LibraryImage>("ptcl:insertImage", { detail: img });
              window.dispatchEvent(ev);
            }}
            onClose={() => setImagePaletteOpen(false)}
          />
        )}
      </div>
      <RibbonInsertTextBtn />
      <RibbonInsertArrowBtn />
      <RibbonBranchBtn />
      {/* 表ボタン + パレット */}
      <div className="relative shrink-0">
        <RibbonInsertTableBtn />
      </div>
      <RibbonDivider />
      {/* 検索・置換 */}
      <RibbonBtn
        active={findReplaceOpen}
        title="検索・置換"
        onClick={() => setFindReplaceOpen((v) => !v)}
      >
        検索・置換
      </RibbonBtn>
      {findReplaceOpen && (
        <FindReplacePalette onClose={() => setFindReplaceOpen(false)} />
      )}
    </div>
  );
}

function RibbonBtn({
  children,
  active = false,
  disabled = false,
  onClick,
  title,
  className = "",
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      // contentEditable からフォーカスを奪わないようにする（テキスト選択を維持するため）
      onMouseDown={(e) => e.preventDefault()}
      className={[
        "flex h-8 min-w-[32px] items-center justify-center rounded px-2 text-sm transition-colors",
        active
          ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
          : "text-neutral-600 hover:bg-neutral-100",
        disabled ? "cursor-not-allowed opacity-35" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function RibbonDivider() {
  return <div className="mx-1.5 h-7 w-px shrink-0 bg-neutral-200" />;
}

/** テキストボックス挿入ボタン（状態を uiStore から読む） */
function RibbonInsertTextBtn() {
  const insertMode   = useUiStore((s) => s.insertMode);
  const setInsertMode = useUiStore((s) => s.setInsertMode);
  const active = insertMode === "text";
  return (
    <RibbonBtn
      active={active}
      title={active ? "クリックしてキャンセル" : "テキストボックスを挿入（クリックして配置）"}
      onClick={() => setInsertMode(active ? null : "text")}
    >
      テキストボックス
    </RibbonBtn>
  );
}

/** 分岐ボタン */
function RibbonBranchBtn() {
  const insertMode    = useUiStore((s) => s.insertMode);
  const setInsertMode = useUiStore((s) => s.setInsertMode);
  const active = insertMode === "branch";
  return (
    <RibbonBtn
      active={active}
      title={active ? "クリックしてキャンセル（Esc）" : "分岐を追加（クリック後、矢印を選択）"}
      onClick={() => setInsertMode(active ? null : "branch")}
    >
      分岐
    </RibbonBtn>
  );
}

/** 自由矢印ボタン */
function RibbonInsertArrowBtn() {
  const insertMode   = useUiStore((s) => s.insertMode);
  const setInsertMode = useUiStore((s) => s.setInsertMode);
  const active = insertMode === "arrow";
  return (
    <RibbonBtn
      active={active}
      title={active ? "クリックしてキャンセル" : "矢印を描画（クリックして開始）"}
      onClick={() => setInsertMode(active ? null : "arrow")}
    >
      矢印
    </RibbonBtn>
  );
}

/** 表挿入ボタン（クリックでパレット表示） */
function RibbonInsertTableBtn() {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={btnRef} className="shrink-0">
      <RibbonBtn
        active={open}
        title="表を挿入"
        onClick={() => {
          const rect = btnRef.current?.getBoundingClientRect() ?? null;
          setAnchor(rect);
          setOpen((v) => !v);
        }}
      >
        表
      </RibbonBtn>
      {open && anchor && <TablePalette anchorRect={anchor} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ============================================================
// 紙面キャンバス（複数列・複数ページ対応）
// ============================================================
function PageCanvas() {
  const doc = useDocumentStore((s) => s.doc!);
  const insertOperation = useDocumentStore((s) => s.insertOperation);
  const updateOperationText = useDocumentStore((s) => s.updateOperationText);
  const deleteBlock = useDocumentStore((s) => s.deleteBlock);
  const addAttachment = useDocumentStore((s) => s.addAttachment);
  const updateAttachment = useDocumentStore((s) => s.updateAttachment);
  const removeAttachment = useDocumentStore((s) => s.removeAttachment);
  const reorderAttachments = useDocumentStore((s) => s.reorderAttachments);
  const moveBlock = useDocumentStore((s) => s.moveBlock);
  const addFreeTextElement  = useDocumentStore((s) => s.addFreeTextElement);
  const updateFreeElement   = useDocumentStore((s) => s.updateFreeElement);
  const addFreeImageElement = useDocumentStore((s) => s.addFreeImageElement);
  const updateFreeImageElement = useDocumentStore((s) => s.updateFreeImageElement);
  const removeFreeElement   = useDocumentStore((s) => s.removeFreeElement);
  const insertSpacer        = useDocumentStore((s) => s.insertSpacer);
  const updateSpacerHeight  = useDocumentStore((s) => s.updateSpacerHeight);
  const insertColumnBreak   = useDocumentStore((s) => s.insertColumnBreak);
  const createBranchFlow    = useDocumentStore((s) => s.createBranchFlow);
  const insertBranchOperation   = useDocumentStore((s) => s.insertBranchOperation);
  const updateBranchOperationText = useDocumentStore((s) => s.updateBranchOperationText);
  const deleteBranchBlock   = useDocumentStore((s) => s.deleteBranchBlock);
  const insertBranchSpacer  = useDocumentStore((s) => s.insertBranchSpacer);
  const updateBranchSpacerHeight = useDocumentStore((s) => s.updateBranchSpacerHeight);
  const setBranchMergeTarget = useDocumentStore((s) => s.setBranchMergeTarget);
  const setBranchSourceArrow = useDocumentStore((s) => s.setBranchSourceArrow);
  const moveBranchBlock     = useDocumentStore((s) => s.moveBranchBlock);
  const removeBranchFlow    = useDocumentStore((s) => s.removeBranchFlow);
  const addFreeArrowElement    = useDocumentStore((s) => s.addFreeArrowElement);
  const updateFreeArrowElement = useDocumentStore((s) => s.updateFreeArrowElement);
  const cloneFreeElements      = useDocumentStore((s) => s.cloneFreeElements);
  const moveFreeElementsBulk   = useDocumentStore((s) => s.moveFreeElementsBulk);
  const updateTableCell     = useDocumentStore((s) => s.updateTableCell);
  const updateFreeTableElement = useDocumentStore((s) => s.updateFreeTableElement);
  const savedPath  = useDocumentStore((s) => s.path);
  const markSaved  = useDocumentStore((s) => s.markSaved);
  const undo       = useDocumentStore((s) => s.undo);
  const redo       = useDocumentStore((s) => s.redo);
  const caret = useUiStore((s) => s.caret);
  const setCaret = useUiStore((s) => s.setCaret);
  const insertMode = useUiStore((s) => s.insertMode);
  const setInsertMode = useUiStore((s) => s.setInsertMode);
  const selectedFreeId = useUiStore((s) => s.selectedFreeId);
  const setSelectedFreeId = useUiStore((s) => s.setSelectedFreeId);
  const selectedFreeIds = useUiStore((s) => s.selectedFreeIds);
  const setSelectedFreeIds = useUiStore((s) => s.setSelectedFreeIds);
  const { flowWidth, fontFamily, fontSize, bold, italic } = useDisplayStore();
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  // 分岐列ごとのキャレット（key: branchFlowId）
  const [branchCarets, setBranchCarets] = useState<Record<string, import("@/types/ptcl").EditorCaret>>({});
  const [branchAutoEditIds, setBranchAutoEditIds] = useState<Record<string, string | null>>({});
  // 合流選択中の分岐 id（null のとき非アクティブ）
  const [mergeSelectBranchId, setMergeSelectBranchId] = useState<string | null>(null);
  // クリップボード（Ctrl+C / Ctrl+X でコピーした operation の内容）
  const [clipboard, setClipboard] = useState<{ text: string; richText?: string } | null>(null);
  // テキストボックス描画中のプレビュー状態
  const [drawingBox, setDrawingBox] = useState<{
    pageIdx: number;
    startX: number; startY: number;
    curX:   number; curY:   number;
  } | null>(null);

  // 矢印描画中の状態（ポイントの蓄積）
  const [drawingArrow, setDrawingArrow] = useState<{
    pageIdx: number;
    points: { x: number; y: number }[];
    cursorX: number;
    cursorY: number;
  } | null>(null);

  // 自由要素クリップボード（Ctrl+C / Ctrl+X でセット）
  const [freeClipboard, setFreeClipboard] = useState<FreeElement[] | null>(null);
  // ラバーバンド選択中の矩形
  const [selectionRect, setSelectionRect] = useState<{
    startX: number; startY: number; curX: number; curY: number;
  } | null>(null);
  // マルチドラッグ用ベース座標（ドラッグ開始時にキャプチャ）
  const multiDragBasesRef = useRef<Map<string, { x?: number; y?: number; points?: { x: number; y: number }[] }>>(new Map());

  // ---- 用紙寸法 ----
  const { w: paperW, h: paperH } = getPaperDims(
    doc.page.size,
    doc.page.orientation,
  );
  const contentW = contentWidthFromPaper(paperW);
  // 1ページ目はヘッダーがある分高さが減る
  const maxH = colMaxHeight(paperH, true);

  // ---- 直接挿入 ----
  function handleDirectInsert(beforeBlockIndex: number) {
    const newId = insertOperation(beforeBlockIndex);
    setAutoEditId(newId);
    setCaret({ kind: "block", blockId: newId });
  }

  // ---- Enter on op → 直後の矢印を選択 ----
  const handleSelectArrowAfterOp = useCallback(
    (opBlockIndex: number) => {
      const blocks = doc.mainFlow.blocks;
      const nextBlock = blocks[opBlockIndex + 1];
      if (nextBlock?.type === "arrow") {
        setAutoEditId(null);
        setCaret({ kind: "block", blockId: nextBlock.id });
      } else {
        handleDirectInsert(opBlockIndex + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, setCaret],
  );

  // ---- Enter on arrow → 次の op を autoEdit ----
  const handleArrowNext = useCallback(
    (arrowBlockIndex: number) => {
      const blocks = doc.mainFlow.blocks;
      const nextBlock = blocks[arrowBlockIndex + 1];
      if (nextBlock?.type === "operation") {
        setAutoEditId(nextBlock.id);
        setCaret({ kind: "block", blockId: nextBlock.id });
      }
    },
    [doc, setCaret],
  );

  // ---- キーボードショートカット ----
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;

      // Ctrl+S / Cmd+S: 上書き保存（パスがあれば）、なければ名前を付けて保存
      if (isModifier && e.key === "s") {
        e.preventDefault();
        if (!isTauri()) return;
        if (savedPath) {
          saveDocument(savedPath, doc).then(() => markSaved(savedPath)).catch(() => {});
        } else {
          const defaultName = doc.meta.title.trim() || "untitled";
          savePtclDialog(defaultName).then(async (p) => {
            if (!p) return;
            const finalPath = p.endsWith(".ptcl") ? p : `${p}.ptcl`;
            await saveDocument(finalPath, doc);
            markSaved(finalPath);
          }).catch(() => {});
        }
        return;
      }

      // Ctrl+Z / Cmd+Z: アンドゥ（Shift 併用時はリドゥ）
      if (isModifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y / Ctrl+Shift+Z: リドゥ
      if (isModifier && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // F12: DevTools トグル（デバッグビルドのみ有効）
      if (e.key === "F12" && isTauri()) {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("toggle_devtools").catch(() => {});
        });
        return;
      }

      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.isContentEditable;

      // Ctrl+C / Cmd+C: コピー（編集中はブラウザ標準に任せる）
      if (isModifier && e.key === "c" && !isEditable) {
        // 自由要素のコピーを優先
        const copyIds = selectedFreeIds.length > 0 ? selectedFreeIds
          : selectedFreeId ? [selectedFreeId] : [];
        if (copyIds.length > 0) {
          const elems = doc.freeElements.filter((el) => copyIds.includes(el.id));
          if (elems.length > 0) {
            e.preventDefault();
            setFreeClipboard(elems);
            return;
          }
        }
        // mainFlow ブロックのコピー
        if (caret.kind === "block") {
          const block = doc.mainFlow.blocks.find((b) => b.id === caret.blockId);
          if (block?.type === "operation") {
            e.preventDefault();
            setClipboard({ text: block.text, richText: block.richText });
          }
        }
        return;
      }

      // Ctrl+X / Cmd+X: 切り取り（編集中はブラウザ標準に任せる）
      if (isModifier && e.key === "x" && !isEditable) {
        // 自由要素の切り取りを優先
        const cutIds = selectedFreeIds.length > 0 ? selectedFreeIds
          : selectedFreeId ? [selectedFreeId] : [];
        if (cutIds.length > 0) {
          const elems = doc.freeElements.filter((el) => cutIds.includes(el.id));
          if (elems.length > 0) {
            e.preventDefault();
            setFreeClipboard(elems);
            cutIds.forEach((id) => removeFreeElement(id));
            setSelectedFreeId(null);
            setSelectedFreeIds([]);
            return;
          }
        }
        // mainFlow ブロックの切り取り
        if (caret.kind === "block") {
          const block = doc.mainFlow.blocks.find((b) => b.id === caret.blockId);
          if (block?.type === "operation") {
            e.preventDefault();
            setClipboard({ text: block.text, richText: block.richText });
            deleteBlock(caret.blockId);
            setCaret({ kind: "none" });
          }
        }
        return;
      }

      // Ctrl+V / Cmd+V: 貼り付け（編集中はブラウザ標準に任せる）
      if (isModifier && e.key === "v" && !isEditable) {
        // 自由要素のペーストを優先
        if (freeClipboard && freeClipboard.length > 0) {
          e.preventDefault();
          const newIds = cloneFreeElements(freeClipboard, 20, 20);
          if (newIds.length === 1) {
            setSelectedFreeId(newIds[0]);
            setSelectedFreeIds([]);
          } else {
            setSelectedFreeIds(newIds);
            setSelectedFreeId(null);
          }
          setCaret({ kind: "none" });
          return;
        }
        // mainFlow ブロックのペースト
        if (clipboard) {
          e.preventDefault();
          const blocks = doc.mainFlow.blocks;
          // カーソル位置の次に挿入（なければ末尾）
          let insertIdx = blocks.length;
          if (caret.kind === "block") {
            const idx = blocks.findIndex((b) => b.id === caret.blockId);
            if (idx >= 0) insertIdx = idx + 1;
          }
          const newId = insertOperation(insertIdx, clipboard.text);
          setAutoEditId(null);
          setCaret({ kind: "block", blockId: newId });
        }
        return;
      }

      if (isEditable) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        // 複数自由要素の一括削除
        if (selectedFreeIds.length > 0) {
          e.preventDefault();
          selectedFreeIds.forEach((id) => removeFreeElement(id));
          setSelectedFreeIds([]);
          return;
        }
        if (caret.kind === "block") {
          e.preventDefault();
          deleteBlock(caret.blockId);
          setCaret({ kind: "none" });
        }
      }
      if (e.key === "Escape") {
        setAutoEditId(null);
        setCaret({ kind: "none" });
        setSelectedFreeId(null);
        setSelectedFreeIds([]);
        setDrawingArrow(null);
        setMergeSelectBranchId(null);
        if (insertMode) setInsertMode(null);
      }
      if (e.key === "Enter" && caret.kind === "block") {
        const blocks = doc.mainFlow.blocks;
        const idx = blocks.findIndex((b) => b.id === caret.blockId);
        if (idx >= 0 && blocks[idx].type === "arrow") {
          e.preventDefault();
          handleArrowNext(idx);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caret, deleteBlock, setCaret, doc, handleArrowNext, insertMode, setInsertMode,
     savedPath, markSaved, mergeSelectBranchId, undo, redo, clipboard, insertOperation,
     selectedFreeId, selectedFreeIds, freeClipboard, cloneFreeElements, removeFreeElement,
     setSelectedFreeId, setSelectedFreeIds],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ---- 画像挿入イベント受信（Ribbon の ImagePalette から発火） ----
  const { w: paperWForImg, h: paperHForImg } = getPaperDims(
    doc.page.size,
    doc.page.orientation,
  );
  useEffect(() => {
    function onInsertImage(e: Event) {
      const img = (e as CustomEvent<LibraryImage>).detail;
      // 自然サイズを取得して最大 320×240 に収める
      const htmlImg = new Image();
      htmlImg.onload = () => {
        const nw = htmlImg.naturalWidth  || 200;
        const nh = htmlImg.naturalHeight || 150;
        const maxW = 320, maxH = 240;
        const scale = Math.min(1, maxW / nw, maxH / nh);
        const w = Math.round(nw * scale);
        const h = Math.round(nh * scale);
        // 用紙の内側中央付近に配置（ヘッダー下を避ける）
        const x = Math.round((paperWForImg - w) / 2);
        const y = Math.round(paperHForImg * 0.3);
        const newId = addFreeImageElement(x, y, img.src, img.name, w, h);
        setSelectedFreeId(newId);
        setCaret({ kind: "none" });
        setAutoEditId(null);
      };
      htmlImg.onerror = () => {
        // 読み込み失敗時はデフォルトサイズで挿入
        const newId = addFreeImageElement(100, 200, img.src, img.name, 200, 150);
        setSelectedFreeId(newId);
      };
      htmlImg.src = img.src;
    }
    window.addEventListener("ptcl:insertImage", onInsertImage);
    return () => window.removeEventListener("ptcl:insertImage", onInsertImage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addFreeImageElement, paperWForImg, paperHForImg, setSelectedFreeId, setCaret]);

  // ---- 分岐接続線 SVG ----
  // ページ div の ref（ページ番号 → HTMLDivElement）
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const [branchConns, setBranchConns] = useState<BranchConnItem[]>([]);
  const [selectedBranchFlowId, setSelectedBranchFlowId] = useState<string | null>(null);

  // ブロック・ギャップ・ボタン以外の場所をクリックしたら選択解除
  // （各ブロックは e.stopPropagation() しているのでここには届かない）
  // 矢印描画モード中は選択解除しない
  function handleCanvasClick() {
    if (insertMode === "arrow") return;
    if (mergeSelectBranchId) {
      setMergeSelectBranchId(null);
      return;
    }
    setAutoEditId(null);
    setCaret({ kind: "none" });
    setSelectedFreeId(null);
    setSelectedFreeIds([]);
    setSelectedBranchFlowId(null);
  }

  // テキストボックス挿入モード: マウスダウンからドラッグしてサイズを決める
  // insertMode === null のとき: ラバーバンド選択を開始する
  function handlePaperMouseDown(e: React.MouseEvent<HTMLDivElement>, pageIdx: number) {
    if (insertMode === "text") {
      e.stopPropagation();
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      setDrawingBox({ pageIdx, startX, startY, curX: startX, curY: startY });

      function onMouseMove(ev: MouseEvent) {
        setDrawingBox({
          pageIdx, startX, startY,
          curX: ev.clientX - rect.left,
          curY: ev.clientY - rect.top,
        });
      }

      function onMouseUp(ev: MouseEvent) {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup",   onMouseUp);

        const endX = ev.clientX - rect.left;
        const endY = ev.clientY - rect.top;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.max(Math.abs(endX - startX), 80);  // 最小幅 80px
        const h = Math.max(Math.abs(endY - startY), 30);  // 最小高 30px

        setDrawingBox(null);
        setInsertMode(null);

        const newId = addFreeTextElement(x, y, w, h);
        setSelectedFreeId(newId);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
      return;
    }

    if (insertMode !== null) return;

    // insertMode === null: ラバーバンド選択
    // 自由要素は onMouseDown で stopPropagation するので、ここに届くのは紙面の空き領域のみ

    // input / contentEditable / button などフォーカス可能な要素がクリックされた場合は
    // e.preventDefault() を呼ばない（ブラウザのフォーカス動作を阻害しないため）
    const evTarget = e.target as HTMLElement;
    const isInteractive =
      evTarget.tagName === "INPUT" ||
      evTarget.tagName === "TEXTAREA" ||
      evTarget.tagName === "BUTTON" ||
      evTarget.tagName === "SELECT" ||
      evTarget.isContentEditable;
    if (!isInteractive) {
      e.preventDefault(); // ラバーバンド中のブラウザテキスト選択を防ぐ
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    // selectionRect は mousedown 直後には設定しない（0×0 の青い点が表示されてしまうため）
    // 5px 以上動いた時点で初めて表示する

    function onSelMove(ev: MouseEvent) {
      const curX = ev.clientX - rect.left;
      const curY = ev.clientY - rect.top;
      // 閾値を超えたときだけラバーバンドを表示
      if (Math.abs(curX - startX) > 5 || Math.abs(curY - startY) > 5) {
        setSelectionRect({ startX, startY, curX, curY });
      }
    }

    function onSelUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onSelMove);
      window.removeEventListener("mouseup",   onSelUp);

      const endX = ev.clientX - rect.left;
      const endY = ev.clientY - rect.top;
      setSelectionRect(null);

      const selX = Math.min(startX, endX);
      const selY = Math.min(startY, endY);
      const selW = Math.abs(endX - startX);
      const selH = Math.abs(endY - startY);

      // 5px 未満は通常クリック扱い → ラバーバンド選択しない
      if (selW < 5 && selH < 5) return;

      // 選択矩形と各自由要素の矩形が重なるものを収集
      const hits: string[] = [];
      for (const freeEl of doc.freeElements) {
        let elX: number, elY: number, elW: number, elH: number;
        if (freeEl.type === "arrow") {
          const xs = freeEl.points.map((p) => p.x);
          const ys = freeEl.points.map((p) => p.y);
          elX = Math.min(...xs); elY = Math.min(...ys);
          elW = Math.max(...xs) - elX; elH = Math.max(...ys) - elY;
        } else {
          elX = freeEl.x; elY = freeEl.y; elW = freeEl.w; elH = freeEl.h;
        }
        // AABB 交差判定
        if (selX < elX + elW && selX + selW > elX && selY < elY + elH && selY + selH > elY) {
          hits.push(freeEl.id);
        }
      }

      if (hits.length > 0) {
        setSelectedFreeIds(hits);
        setSelectedFreeId(null);
        setCaret({ kind: "none" });
        setAutoEditId(null);
      }
    }

    window.addEventListener("mousemove", onSelMove);
    window.addEventListener("mouseup",   onSelUp);
  }

  // 矢印描画モード: 左クリックで点追加、右クリックで終了（矢じり確定）
  function handlePaperClick(e: React.MouseEvent<HTMLDivElement>, pageIdx: number) {
    if (insertMode !== "arrow") return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDrawingArrow((prev) => {
      if (!prev || prev.pageIdx !== pageIdx) {
        // 1点目（始点）
        return { pageIdx, points: [{ x, y }], cursorX: x, cursorY: y };
      }
      // 2点目以降（中間点を追加）
      return { ...prev, points: [...prev.points, { x, y }], cursorX: x, cursorY: y };
    });
  }

  function handlePaperContextMenu(e: React.MouseEvent<HTMLDivElement>, pageIdx: number) {
    if (insertMode !== "arrow") return;
    e.preventDefault();
    e.stopPropagation();
    if (!drawingArrow || drawingArrow.pageIdx !== pageIdx) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 終点として確定（最低 2 点必要）
    const finalPoints = [...drawingArrow.points, { x, y }];
    if (finalPoints.length < 2) {
      setDrawingArrow(null);
      setInsertMode(null);
      return;
    }
    const newId = addFreeArrowElement(finalPoints);
    setSelectedFreeId(newId);
    setDrawingArrow(null);
    setInsertMode(null);
  }

  function handlePaperMouseMove(e: React.MouseEvent<HTMLDivElement>, pageIdx: number) {
    if (insertMode !== "arrow" || !drawingArrow || drawingArrow.pageIdx !== pageIdx) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawingArrow((prev) => prev ? { ...prev, cursorX: x, cursorY: y } : null);
  }

  // ---- マルチドラッグ: ベース座標のキャプチャ ----
  function handleFreeElementMoveStart(elId: string) {
    // 複数選択グループに属していない場合は何もしない
    const groupIds = selectedFreeIds.length > 1 && selectedFreeIds.includes(elId)
      ? selectedFreeIds : null;
    if (!groupIds) {
      multiDragBasesRef.current = new Map();
      return;
    }
    const bases = new Map<string, { x?: number; y?: number; points?: { x: number; y: number }[] }>();
    for (const id of groupIds) {
      const el = doc.freeElements.find((e) => e.id === id);
      if (!el) continue;
      if (el.type === "arrow") {
        bases.set(id, { points: el.points.map((p) => ({ ...p })) });
      } else {
        bases.set(id, { x: el.x, y: el.y });
      }
    }
    multiDragBasesRef.current = bases;
  }

  // ---- マルチドラッグ: onUpdate ラッパー ----
  // ドラッグ中の要素の onUpdate を横取りして、グループ全体を同じ量だけ動かす。
  // patch は { x, y } または { points } の形で来る。

  /** dx/dy からグループ全体の移動リストを組み立てる */
  function buildGroupMoves(
    groupIds: string[],
    dx: number,
    dy: number,
  ): Array<{ id: string; x?: number; y?: number; points?: { x: number; y: number }[] }> {
    const bases = multiDragBasesRef.current;
    const result: Array<{ id: string; x?: number; y?: number; points?: { x: number; y: number }[] }> = [];
    for (const id of groupIds) {
      const base = bases.get(id);
      const freeEl = doc.freeElements.find((e) => e.id === id);
      if (!base || !freeEl) continue;
      if (freeEl.type === "arrow" && base.points) {
        result.push({ id, points: base.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
      } else if (base.x !== undefined && base.y !== undefined) {
        result.push({ id, x: base.x + dx, y: base.y + dy });
      }
    }
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeFreeGroupUpdate<P extends Record<string, any>>(
    el: FreeElement,
    updateFn: (patch: P) => void,
  ): (patch: P) => void {
    return (patch) => {
      const bases = multiDragBasesRef.current;
      const groupIds = selectedFreeIds.length > 1 && selectedFreeIds.includes(el.id)
        ? selectedFreeIds : null;

      if (groupIds && bases.size > 0) {
        // x/y ベースの要素（text / image / table）がドラッグしているとき
        if ("x" in patch || "y" in patch) {
          const myBase = bases.get(el.id);
          if (myBase && myBase.x !== undefined && myBase.y !== undefined) {
            const dx = ((patch.x as number | undefined) ?? (el as { x: number }).x) - myBase.x;
            const dy = ((patch.y as number | undefined) ?? (el as { y: number }).y) - myBase.y;
            const moves = buildGroupMoves(groupIds, dx, dy);
            if (moves.length > 0) moveFreeElementsBulk(moves);
            return;
          }
        }
        // points ベースの要素（arrow）がドラッグしているとき
        if ("points" in patch && Array.isArray(patch.points) && el.type === "arrow") {
          const myBase = bases.get(el.id);
          const newPts = patch.points as { x: number; y: number }[];
          if (myBase && myBase.points && myBase.points.length > 0 && newPts.length > 0) {
            const dx = newPts[0].x - myBase.points[0].x;
            const dy = newPts[0].y - myBase.points[0].y;
            const moves = buildGroupMoves(groupIds, dx, dy);
            if (moves.length > 0) moveFreeElementsBulk(moves);
            return;
          }
        }
      }

      // グループ移動なし → 通常の単体更新
      updateFn(patch);
    };
  }

  // ---- プローブ要素でテキスト幅を実測 ----
  // 文字数ベースの推定を廃止し、DOMに非表示スパンを置いて
  // 「最長行」の実際のレンダリング幅を測定することで
  // 全角/半角の差・フォントサイズの違いも正確に反映する。
  const probeRef = useRef<HTMLSpanElement>(null);
  const [contentAwareMaxCols, setContentAwareMaxCols] = useState(MAX_COLS_PER_PAGE);

  const { blocks, attachments } = doc.mainFlow;

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;

    // 全 operation ブロックの「最長行」の実測幅を求める
    let maxLineW = 0;
    for (const block of blocks) {
      if (block.type !== "operation") continue;
      // richText の HTML タグを除去して改行に変換し、プレーンテキストを取得
      const plain = block.richText
        ? block.richText.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
        : block.text;
      for (const line of plain.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        probe.textContent = trimmed;
        maxLineW = Math.max(maxLineW, probe.scrollWidth);
      }
    }
    probe.textContent = "";

    if (maxLineW === 0) {
      setContentAwareMaxCols(MAX_COLS_PER_PAGE);
      return;
    }

    // 最長行が収まる最大列数を選択
    //
    // しきい値 = 列幅そのもの（UIクロームを引かない）
    //
    // 理由: テキストは text-center（中央揃え）なので、
    //   テキスト幅が「テキスト div 幅」を超えても
    //   左右均等にはみ出すため、列幅を超えるまで隣列に干渉しない。
    //   ハンドル(≈26px)とボタン(≈22px)は逆方向に相殺し合い
    //   「列幅 ≈ テキスト中央揃えの実効しきい値」となる。
    // しきい値 = 列幅 + COL_GAP * 4
    //   中央揃えテキストの右端が隣列のテキストエリア開始位置に
    //   ちょうど達する幅が ≈ 列幅 + COL_GAP*4 (≈416px @A4 2列)
    //   → 実際に隣列コンテンツと重なるギリギリまで許容
    let newCols = 1;
    for (let n = MAX_COLS_PER_PAGE; n >= 1; n--) {
      if (columnWidthForCount(n, contentW) + COL_GAP * 4 >= maxLineW) {
        newCols = n;
        break;
      }
    }
    setContentAwareMaxCols(newCols);
  // フォント設定が変わったときも再測定する
  }, [blocks, contentW, fontFamily, fontSize, bold, italic]);

  // ---- 列・ページ計算 ----
  const { branchFlows } = doc.mainFlow;
  // useMemo でメモ化: 毎レンダー新配列が生成されると useLayoutEffect が無限ループになる
  const pages = useMemo(
    () => layoutWithBranches(blocks, attachments, branchFlows, maxH, contentAwareMaxCols),
    [blocks, attachments, branchFlows, maxH, contentAwareMaxCols],
  );
  const maxCols = Math.max(...pages.map((p) => p.length), 1);
  // 多列: 紙面 contentW を自動分割。単列: ユーザー設定の flowWidth（contentW を上限）
  const colW =
    maxCols > 1
      ? columnWidthForCount(Math.min(maxCols, MAX_COLS_PER_PAGE), contentW)
      : Math.min(flowWidth, contentW);

  // ---- 分岐接続線の座標計算（branchFlows・pages 確定後に実行） ----
  useLayoutEffect(() => {
    const conns: BranchConnItem[] = [];

    for (const bf of branchFlows) {
      const sourceEl = document.querySelector<HTMLElement>(`[data-arrow-id="${bf.sourceArrowId}"]`);
      const entryEl  = document.querySelector<HTMLElement>(`[data-branch-entry="${bf.id}"]`);
      const exitEl   = document.querySelector<HTMLElement>(`[data-branch-exit="${bf.id}"]`);
      if (!sourceEl || !entryEl) continue;

      // どのページ div 内にあるか特定
      let pageEl: HTMLDivElement | null = null;
      let foundPageIdx = -1;
      for (const [idx, el] of pageEls.current.entries()) {
        if (el.contains(sourceEl)) { pageEl = el; foundPageIdx = idx; break; }
      }
      if (!pageEl) continue;

      const pr = pageEl.getBoundingClientRect();

      // 入口: source arrow 中心X（縦線と合流）→ 分岐ヘッダー左端中心
      const sr = sourceEl.getBoundingClientRect();
      const er = entryEl.getBoundingClientRect();
      const srcY = computeGapY(sourceEl, bf.sourceGapAfter, pageEl);
      const entry = {
        x1: (sr.left + sr.right) / 2 - pr.left,  // 縦矢印の中心X
        y1: srcY,
        x2: er.left  - pr.left,
        y2: er.top + er.height / 2 - pr.top,
      };

      // 出口: 分岐フッター左端中心 → 合流先ブロック中心X（縦線と合流）
      // 後方互換: mergeTargetId がなければ mergeTargetArrowId を使う
      const mergeId = bf.mergeTargetId ?? bf.mergeTargetArrowId ?? null;
      let exit: BranchConnItem["exit"];
      if (mergeId && exitEl) {
        const mergeEl = document.querySelector<HTMLElement>(`[data-conn-block="${mergeId}"]`);
        if (mergeEl && pageEl.contains(mergeEl)) {
          const xr = exitEl.getBoundingClientRect();
          const mr = mergeEl.getBoundingClientRect();
          const mrgY = computeGapY(mergeEl, bf.mergeGapAfter, pageEl);
          // arrow ブロック → 縦線の中心X に少しオフセット
          // operation ブロック（ボックス）→ 右端の外側
          const isArrow = !!mergeEl.dataset.arrowId;
          const mergeX = isArrow
            ? (mr.left + mr.right) / 2 - pr.left + 10
            : mr.right - pr.left + 8;
          exit = {
            x1: xr.left  - pr.left,
            y1: xr.top + xr.height / 2 - pr.top,
            x2: mergeX,
            y2: mrgY,
          };
        }
      }

      conns.push({ branchFlowId: bf.id, pageIdx: foundPageIdx, entry, exit });
    }

    setBranchConns(conns);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFlows, pages, doc.mainFlow.blocks, branchCarets, mergeSelectBranchId]);

  // ---- 分岐モード: 矢印クリックで分岐を作成 ----
  function handleArrowBranchCreate(arrowId: string) {
    // 既存の分岐がある場合は作成しない（1矢印につき1分岐）
    const existing = branchFlows.find((bf) => bf.sourceArrowId === arrowId);
    if (existing) return;
    createBranchFlow(arrowId);
    setInsertMode(null);
  }

  // ---- 合流ターゲット選択: 主フロー矢印クリックで setBranchMergeTarget ----
  function handleMainArrowSelectForMerge(arrowId: string) {
    if (!mergeSelectBranchId) return;
    setBranchMergeTarget(mergeSelectBranchId, arrowId);
    setMergeSelectBranchId(null);
  }

  // ---- 共通 MainFlow props ----
  const shared = {
    mainFlow: doc.mainFlow,
    caret,
    autoEditId,
    colW,
    onDirectInsert: handleDirectInsert,
    onMoveBlock: moveBlock,
    onBlockSelect: (id: string) => {
      // 合流選択モード中は主フロー矢印クリックで合流ターゲットを設定
      if (mergeSelectBranchId) {
        // ブロック種別チェック
        const block = doc.mainFlow.blocks.find((b) => b.id === id);
        if (block?.type === "arrow") {
          handleMainArrowSelectForMerge(id);
          return;
        }
      }
      setAutoEditId(null);
      setCaret({ kind: "block", blockId: id });
    },
    onOperationTextChange: (id: string, text: string, richText?: string) => {
      setAutoEditId(null);
      updateOperationText(id, text, richText);
    },
    onOperationDelete: (id: string) => {
      setAutoEditId(null);
      deleteBlock(id);
      setCaret({ kind: "none" });
    },
    onSelectArrowAfterOp: handleSelectArrowAfterOp,
    onArrowNext: handleArrowNext,
    onAddAttachment: addAttachment,
    onUpdateAttachment: updateAttachment,
    onRemoveAttachment: removeAttachment,
    onReorderAttachments: reorderAttachments,
    onInsertSpacer: (beforeBlockIndex: number) => insertSpacer(beforeBlockIndex),
    onUpdateSpacerHeight: updateSpacerHeight,
    onDeleteSpacer: deleteBlock,
    onInsertColumnBreak: (beforeBlockIndex: number) => {
      // 改列マーカーを挿入し、直後に新しい operation ブロックを自動追加する
      insertColumnBreak(beforeBlockIndex);
      const newId = insertOperation(beforeBlockIndex + 1);
      setAutoEditId(newId);
      setCaret({ kind: "block", blockId: newId });
    },
    onDeleteColumnBreak: deleteBlock,
    onArrowBranchCreate: (insertMode === "branch" ? handleArrowBranchCreate
      : mergeSelectBranchId ? (arrowId: string) => handleMainArrowSelectForMerge(arrowId)
      : undefined) as ((arrowId: string) => void) | undefined,
  };

  return (
    <>
      {/* テキスト幅実測用の非表示プローブ（OperationBlock と同じフォント設定） */}
      <span
        ref={probeRef}
        aria-hidden
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          visibility: "hidden",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          fontFamily: FONT_CSS[fontFamily],
          fontSize: `${fontSize}pt`,
          fontWeight: bold ? "bold" : "normal",
          fontStyle: italic ? "italic" : "normal",
        }}
      />

      {pages.map((pageCols, pageIdx) => (
        <div
          key={pageIdx}
          ref={(el) => {
            if (el) pageEls.current.set(pageIdx, el);
            else pageEls.current.delete(pageIdx);
          }}
          data-page-sheet
          className="relative bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
          style={{
            width: paperW,
            minHeight: paperH,
            cursor: insertMode === "text" ? "crosshair"
              : insertMode === "arrow" ? "crosshair"
              : insertMode === "branch" || mergeSelectBranchId ? "pointer"
              : undefined,
          }}
          onClick={(e) => {
            handleCanvasClick();
            handlePaperClick(e, pageIdx);
          }}
          onMouseDown={(e) => handlePaperMouseDown(e, pageIdx)}
          onMouseMove={(e) => handlePaperMouseMove(e, pageIdx)}
          onContextMenu={(e) => handlePaperContextMenu(e, pageIdx)}
        >
          <div className="flex w-full flex-col px-16 py-12">
            {pageIdx === 0 && <PageHeader />}
            <div
              className={[
                "flex flex-row",
                pageIdx === 0 ? "mt-6" : "",
                maxCols === 1 ? "justify-center" : "",
              ].join(" ")}
              style={{ gap: maxCols > 1 ? 24 : 0 }}
            >
              {pageCols.map((col) => {
                if (col.type === "main") {
                  return (
                    <div key={`main-${col.startIdx}`} style={{ width: colW, minWidth: 0 }}>
                      <MainFlow
                        {...shared}
                        sliceStart={col.startIdx}
                        sliceEnd={col.endIdx}
                      />
                    </div>
                  );
                }
                // branch column
                const bf = branchFlows.find((f) => f.id === col.branchFlowId);
                if (!bf) return null;
                const bfCaret = branchCarets[bf.id] ?? { kind: "none" };
                const bfAutoEdit = branchAutoEditIds[bf.id] ?? null;
                // 合流先の矢印（ラベルなし）
                return (
                  <div key={`branch-${bf.id}`} style={{ width: colW, minWidth: 0 }}>
                    <BranchColumn
                      branchFlow={bf}
                      mainFlowAttachments={doc.mainFlow.attachments}
                      colW={colW}
                      caret={bfCaret}
                      autoEditId={bfAutoEdit}
                      mergeTargetArrowId={bf.mergeTargetId ?? bf.mergeTargetArrowId ?? null}
                      isMergeSelectMode={mergeSelectBranchId === bf.id}
                      onMergeStart={() => {
                        if (mergeSelectBranchId === bf.id) {
                          setMergeSelectBranchId(null);
                        } else {
                          setMergeSelectBranchId(bf.id);
                        }
                      }}
                      onRemoveBranch={() => removeBranchFlow(bf.id)}
                      onDirectInsert={(beforeIdx) => {
                        const newId = insertBranchOperation(bf.id, beforeIdx);
                        setBranchAutoEditIds((prev) => ({ ...prev, [bf.id]: newId }));
                        setBranchCarets((prev) => ({ ...prev, [bf.id]: { kind: "block", blockId: newId } }));
                      }}
                      onMoveBlock={(blockId, beforeIdx) => {
                        moveBranchBlock(bf.id, blockId, beforeIdx);
                      }}
                      onBlockSelect={(blockId) => {
                        setBranchAutoEditIds((prev) => ({ ...prev, [bf.id]: null }));
                        setBranchCarets((prev) => ({ ...prev, [bf.id]: { kind: "block", blockId } }));
                      }}
                      onOperationTextChange={(blockId, text, richText) => {
                        setBranchAutoEditIds((prev) => ({ ...prev, [bf.id]: null }));
                        updateBranchOperationText(bf.id, blockId, text, richText);
                      }}
                      onOperationDelete={(blockId) => {
                        setBranchAutoEditIds((prev) => ({ ...prev, [bf.id]: null }));
                        deleteBranchBlock(bf.id, blockId);
                        setBranchCarets((prev) => ({ ...prev, [bf.id]: { kind: "none" } }));
                      }}
                      onSelectArrowAfterOp={(opIdx) => {
                        const bfBlocks = bf.blocks;
                        const nextBlock = bfBlocks[opIdx + 1];
                        if (nextBlock?.type === "arrow") {
                          setBranchAutoEditIds((prev) => ({ ...prev, [bf.id]: null }));
                          setBranchCarets((prev) => ({ ...prev, [bf.id]: { kind: "block", blockId: nextBlock.id } }));
                        } else {
                          const newId = insertBranchOperation(bf.id, opIdx + 1);
                          setBranchAutoEditIds((prev) => ({ ...prev, [bf.id]: newId }));
                          setBranchCarets((prev) => ({ ...prev, [bf.id]: { kind: "block", blockId: newId } }));
                        }
                      }}
                      onArrowNext={(arrowIdx) => {
                        const bfBlocks = bf.blocks;
                        const nextBlock = bfBlocks[arrowIdx + 1];
                        if (nextBlock?.type === "operation") {
                          setBranchAutoEditIds((prev) => ({ ...prev, [bf.id]: nextBlock.id }));
                          setBranchCarets((prev) => ({ ...prev, [bf.id]: { kind: "block", blockId: nextBlock.id } }));
                        }
                      }}
                      onAddAttachment={(anchorId, kind, text) => addAttachment(anchorId, kind, text)}
                      onUpdateAttachment={updateAttachment}
                      onRemoveAttachment={removeAttachment}
                      onInsertSpacer={(beforeIdx) => insertBranchSpacer(bf.id, beforeIdx)}
                      onUpdateSpacerHeight={(blockId, h) => updateBranchSpacerHeight(bf.id, blockId, h)}
                      onDeleteSpacer={(blockId) => deleteBranchBlock(bf.id, blockId)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* テキストボックス描画プレビュー矩形 */}
          {drawingBox?.pageIdx === pageIdx && (() => {
            const px = Math.min(drawingBox.startX, drawingBox.curX);
            const py = Math.min(drawingBox.startY, drawingBox.curY);
            const pw = Math.abs(drawingBox.curX - drawingBox.startX);
            const ph = Math.abs(drawingBox.curY - drawingBox.startY);
            return (
              <div
                style={{
                  position: "absolute",
                  left: px, top: py, width: pw, height: ph,
                  border: "1.5px dashed #60a5fa",
                  backgroundColor: "rgba(96,165,250,0.06)",
                  pointerEvents: "none",
                  zIndex: 150,
                }}
              />
            );
          })()}

          {/* ラバーバンド選択プレビュー矩形 */}
          {selectionRect && pageIdx === 0 && (() => {
            const px = Math.min(selectionRect.startX, selectionRect.curX);
            const py = Math.min(selectionRect.startY, selectionRect.curY);
            const pw = Math.abs(selectionRect.curX - selectionRect.startX);
            const ph = Math.abs(selectionRect.curY - selectionRect.startY);
            return (
              <div
                style={{
                  position: "absolute",
                  left: px, top: py, width: pw, height: ph,
                  border: "1.5px solid #3b82f6",
                  backgroundColor: "rgba(59,130,246,0.08)",
                  pointerEvents: "none",
                  zIndex: 151,
                }}
              />
            );
          })()}

          {/* 自由配置要素（テキスト・画像・表・矢印、1ページ目のみ） */}
          {pageIdx === 0 &&
            doc.freeElements.map((el) => {
              const isSelected = selectedFreeId === el.id || selectedFreeIds.includes(el.id);
              const commonProps = {
                selected: isSelected,
                onSelect: () => {
                  setSelectedFreeId(el.id);
                  setSelectedFreeIds([]);
                  setCaret({ kind: "none" });
                  setAutoEditId(null);
                },
                onDelete: () => {
                  removeFreeElement(el.id);
                  setSelectedFreeId(null);
                  setSelectedFreeIds(selectedFreeIds.filter((id) => id !== el.id));
                },
                onMoveStart: () => handleFreeElementMoveStart(el.id),
              };
              if (el.type === "text") {
                return (
                  <FreeTextBox
                    key={el.id}
                    {...commonProps}
                    el={el}
                    onUpdate={makeFreeGroupUpdate(el, (patch) => updateFreeElement(el.id, patch))}
                  />
                );
              }
              if (el.type === "image") {
                return (
                  <FreeImageBox
                    key={el.id}
                    {...commonProps}
                    el={el}
                    onUpdate={makeFreeGroupUpdate(el, (patch) => updateFreeImageElement(el.id, patch))}
                  />
                );
              }
              if (el.type === "table") {
                return (
                  <FreeTableBox
                    key={el.id}
                    {...commonProps}
                    el={el}
                    onUpdate={makeFreeGroupUpdate(el, (patch) => updateFreeTableElement(el.id, patch))}
                    onUpdateCell={(row, col, patch) => updateTableCell(el.id, row, col, patch)}
                  />
                );
              }
              if (el.type === "arrow") {
                return (
                  <FreeArrowBox
                    key={el.id}
                    {...commonProps}
                    el={el}
                    onUpdate={makeFreeGroupUpdate(el, (patch) => updateFreeArrowElement(el.id, patch))}
                  />
                );
              }
              return null;
            })}

          {/* 分岐接続線オーバーレイ */}
          {branchConns.some((c) => c.pageIdx === pageIdx) && (
            <BranchConnectionSvg
              connections={branchConns.filter((c) => c.pageIdx === pageIdx)}
              paperW={paperW}
              paperH={paperH}
              pageEl={pageEls.current.get(pageIdx) ?? null}
              selectedBranchFlowId={selectedBranchFlowId}
              onSelectBranchFlow={(id) => {
                setSelectedBranchFlowId(id);
                setCaret({ kind: "none" });
                setSelectedFreeId(null);
              }}
              onDragEntryArrow={(branchFlowId, arrowId, gapAfter) => setBranchSourceArrow(branchFlowId, arrowId, gapAfter)}
              onDragExitArrow={(branchFlowId, blockId, gapAfter) => setBranchMergeTarget(branchFlowId, blockId, gapAfter)}
            />
          )}

          {/* 矢印描画中のプレビュー */}
          {drawingArrow?.pageIdx === pageIdx && drawingArrow.points.length > 0 && (() => {
            const pts = [...drawingArrow.points, { x: drawingArrow.cursorX, y: drawingArrow.cursorY }];
            const polyStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
            return (
              <svg
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 200 }}
              >
                <polyline points={polyStr} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 3" />
                {drawingArrow.points.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r={5} fill="white" stroke="#3b82f6" strokeWidth={1.5} />
                ))}
              </svg>
            );
          })()}
        </div>
      ))}
    </>
  );
}

// ============================================================
// 分岐接続線 SVG オーバーレイ
// ページ上に絶対配置し、主フロー矢印 ↔ 分岐列をカーブ線で結ぶ。
// ドラッグハンドル（●）で接続元・合流先を変更できる。
// ============================================================
type ConnPoint = { x1: number; y1: number; x2: number; y2: number };
type BranchConnItem = {
  branchFlowId: string;
  pageIdx: number;
  entry: ConnPoint;
  exit?: ConnPoint;
};

/** SVG 座標値を小数点 1 桁で丸める */
function f(n: number) { return Math.round(n * 10) / 10; }

/**
 * clientX/Y の位置にある特定属性の HTML 要素を探す（SVG はスキップ）。
 */
function findElemAtPoint(clientX: number, clientY: number, attr: string): HTMLElement | null {
  const els = document.elementsFromPoint(clientX, clientY);
  for (const el of els) {
    if (el instanceof SVGElement) continue;
    const html = el as HTMLElement;
    if (html.dataset && attr.replace("data-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase()) in html.dataset) return html;
    const ancestor = html.closest?.(`[${attr}]`) as HTMLElement | null;
    if (ancestor) return ancestor;
  }
  return null;
}

/** data-arrow-id を持つ要素（ArrowBlock）を clientX/Y から探す */
function findArrowElemAtPoint(clientX: number, clientY: number): HTMLElement | null {
  const els = document.elementsFromPoint(clientX, clientY);
  for (const el of els) {
    if (el instanceof SVGElement) continue;
    const html = el as HTMLElement;
    if (html.dataset?.arrowId) return html;
    const anc = html.closest?.("[data-arrow-id]") as HTMLElement | null;
    if (anc?.dataset?.arrowId) return anc;
  }
  return null;
}

/** data-conn-block を持つ要素（ArrowBlock or OperationBlock）を clientX/Y から探す */
function findConnBlockAtPoint(clientX: number, clientY: number): HTMLElement | null {
  const els = document.elementsFromPoint(clientX, clientY);
  for (const el of els) {
    if (el instanceof SVGElement) continue;
    const html = el as HTMLElement;
    if (html.dataset?.connBlock) return html;
    const anc = html.closest?.("[data-conn-block]") as HTMLElement | null;
    if (anc?.dataset?.connBlock) return anc;
  }
  return null;
}

/** 最近傍の [data-arrow-id] 要素を探す（フォールバック用） */
function findNearestArrowElem(clientX: number, clientY: number, maxDist = 60): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>("[data-arrow-id]");
  let best: HTMLElement | null = null;
  let bestDist = maxDist;
  candidates.forEach((el) => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - clientX, 0, clientX - r.right);
    const dy = Math.max(r.top  - clientY, 0, clientY - r.bottom);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) { bestDist = dist; best = el; }
  });
  return best;
}

/** 最近傍の [data-conn-block] 要素を探す（フォールバック用） */
function findNearestConnBlock(clientX: number, clientY: number, maxDist = 60): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>("[data-conn-block]");
  let best: HTMLElement | null = null;
  let bestDist = maxDist;
  candidates.forEach((el) => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - clientX, 0, clientX - r.right);
    const dy = Math.max(r.top  - clientY, 0, clientY - r.bottom);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) { bestDist = dist; best = el; }
  });
  return best;
}

/**
 * ブロック要素内のアタッチ行ギャップ一覧（Y=clientY ベース）を返す。
 * ギャップID: null = 全行の上、attachmentId = その行の下端
 */
function getAttachGaps(blockEl: HTMLElement): Array<{ gapAfter: string | null; clientY: number }> {
  const rows = Array.from(blockEl.querySelectorAll<HTMLElement>("[data-attach-row]"));
  const br = blockEl.getBoundingClientRect();
  if (rows.length === 0) {
    return [{ gapAfter: null, clientY: br.top + br.height / 2 }];
  }
  const gaps: Array<{ gapAfter: string | null; clientY: number }> = [];
  // 全行より上
  gaps.push({ gapAfter: null, clientY: rows[0].getBoundingClientRect().top });
  // 各行の下端
  rows.forEach((row) => {
    const attId = row.dataset.attachRow ?? null;
    gaps.push({ gapAfter: attId, clientY: row.getBoundingClientRect().bottom });
  });
  return gaps;
}

/** clientY に最も近いギャップを返す */
function nearestGap(gaps: ReturnType<typeof getAttachGaps>, clientY: number) {
  let best = gaps[0];
  let bestDist = Infinity;
  for (const g of gaps) {
    const dist = Math.abs(clientY - g.clientY);
    if (dist < bestDist) { bestDist = dist; best = g; }
  }
  return best;
}

/**
 * ブロック要素と gapAfter から、ページ座標系の Y を計算する。
 * null = 全行より上（または中央）、ID = その行の下端、undefined = ブロック下端。
 */
function computeGapY(blockEl: HTMLElement, gapAfter: string | null | undefined, pageEl: HTMLElement): number {
  const pr = pageEl.getBoundingClientRect();
  const br = blockEl.getBoundingClientRect();
  const rows = Array.from(blockEl.querySelectorAll<HTMLElement>("[data-attach-row]"));
  if (rows.length === 0) return br.top + br.height / 2 - pr.top;
  if (gapAfter === undefined) {
    // 省略 = 最終行の下端
    return rows[rows.length - 1].getBoundingClientRect().bottom - pr.top;
  }
  if (gapAfter === null) {
    // 全行より上
    return rows[0].getBoundingClientRect().top - pr.top;
  }
  // 特定行の下端
  const rowEl = blockEl.querySelector<HTMLElement>(`[data-attach-row="${gapAfter}"]`);
  if (rowEl) return rowEl.getBoundingClientRect().bottom - pr.top;
  // 見つからなければ中央
  return br.top + br.height / 2 - pr.top;
}

function BranchConnectionSvg({
  connections,
  paperW,
  paperH,
  pageEl,
  selectedBranchFlowId,
  onSelectBranchFlow,
  onDragEntryArrow,
  onDragExitArrow,
}: {
  connections: BranchConnItem[];
  paperW: number;
  paperH: number;
  /** ページ div（座標変換用） */
  pageEl: HTMLDivElement | null;
  /** 選択中の分岐フロー ID（ハンドル表示に使う） */
  selectedBranchFlowId: string | null;
  /** 接続線クリック時に選択する */
  onSelectBranchFlow: (id: string) => void;
  /** 入口ハンドルをドロップしたときに呼ばれる（分岐元矢印とギャップを変更） */
  onDragEntryArrow: (branchFlowId: string, arrowId: string, gapAfter: string | null) => void;
  /** 出口ハンドルをドロップしたときに呼ばれる（合流先ブロック＝arrow/op とギャップを変更） */
  onDragExitArrow: (branchFlowId: string, blockId: string, gapAfter: string | null) => void;
}) {
  // ドラッグ中の仮ハンドル位置（React state = 描画用）
  const [dragState, setDragState] = useState<{
    branchFlowId: string;
    kind: "entry" | "exit";
    /** SVGページ座標 */
    x: number;
    y: number;
    /** ホバー中のブロック element */
    hoveredEl: HTMLElement | null;
    /** ホバー中のスナップギャップ情報 */
    hoveredGap: { gapAfter: string | null; clientY: number } | null;
  } | null>(null);

  // ドロップ先を ref に保存（pointerup closure 問題を回避）
  const hoveredRef = useRef<{ blockId: string; gapAfter: string | null } | null>(null);

  function startHandleDrag(
    e: React.PointerEvent<SVGCircleElement>,
    branchFlowId: string,
    kind: "entry" | "exit",
    startX: number,
    startY: number,
  ) {
    e.preventDefault();
    e.stopPropagation();

    hoveredRef.current = null;
    setDragState({ branchFlowId, kind, x: startX, y: startY, hoveredEl: null, hoveredGap: null });

    function toPageCoords(clientX: number, clientY: number) {
      if (!pageEl) return { x: clientX, y: clientY };
      const pr = pageEl.getBoundingClientRect();
      return { x: clientX - pr.left, y: clientY - pr.top };
    }

    function resolveHover(clientX: number, clientY: number) {
      // entry は arrow ブロック限定、exit は arrow/op どちらでも可
      const blockEl = kind === "entry"
        ? (findArrowElemAtPoint(clientX, clientY) ?? findNearestArrowElem(clientX, clientY, 48))
        : (findConnBlockAtPoint(clientX, clientY) ?? findNearestConnBlock(clientX, clientY, 48));
      if (!blockEl) return { blockEl: null, gap: null };
      const gaps = getAttachGaps(blockEl);
      const gap = nearestGap(gaps, clientY);
      return { blockEl, gap };
    }

    function onMove(ev: PointerEvent) {
      const { x, y } = toPageCoords(ev.clientX, ev.clientY);
      const { blockEl, gap } = resolveHover(ev.clientX, ev.clientY);
      const blockId = kind === "entry"
        ? blockEl?.dataset?.arrowId ?? null
        : blockEl?.dataset?.connBlock ?? null;
      hoveredRef.current = blockId && gap ? { blockId, gapAfter: gap.gapAfter } : null;
      setDragState((prev) =>
        prev ? { ...prev, x, y, hoveredEl: blockEl, hoveredGap: gap } : null,
      );
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      const { blockEl, gap } = resolveHover(ev.clientX, ev.clientY);
      const blockId = kind === "entry"
        ? blockEl?.dataset?.arrowId ?? null
        : blockEl?.dataset?.connBlock ?? null;
      const result = (blockId && gap)
        ? { blockId, gapAfter: gap.gapAfter }
        : hoveredRef.current;

      setDragState(null);
      hoveredRef.current = null;

      if (result) {
        if (kind === "entry") onDragEntryArrow(branchFlowId, result.blockId, result.gapAfter);
        else onDragExitArrow(branchFlowId, result.blockId, result.gapAfter);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: paperW,
        height: paperH,
        overflow: "visible",
        pointerEvents: "none", // 子要素で個別に pointerEvents: all/stroke を設定
        zIndex: 5,
      }}
    >
      <defs>
        {/* 入口用矢印ヘッド（青、右向き） */}
        <marker id="bconn-arr-entry" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 7 3, 0 6" fill="#60a5fa" />
        </marker>
        {/* 出口用矢印ヘッド（緑、パス終端方向に orient="auto" で合わせる） */}
        <marker id="bconn-arr-exit" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 7 3, 0 6" fill="#34d399" />
        </marker>
        {/* ドラッグ中ハイライト用矢印ヘッド（オレンジ） */}
        <marker id="bconn-arr-drag" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 7 3, 0 6" fill="#f97316" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const { entry, exit } = conn;
        const activeDrag = dragState?.branchFlowId === conn.branchFlowId ? dragState : null;

        // ドラッグ中は entry.x1,y1 を仮座標に置き換える
        const entryX1 = (activeDrag?.kind === "entry") ? activeDrag.x : entry.x1;
        const entryY1 = (activeDrag?.kind === "entry") ? activeDrag.y : entry.y1;

        // ── 入口パス: source arrow 中心X → 分岐列ヘッダー左端 ──
        // 縦矢印から横に出て折れる。入口は右寄り (-6px)、出口と重ならないよう分ける
        const entryBendX = entry.x2 - 6;  // 分岐列手前で折れる（右寄り）
        const entryD =
          Math.abs(entryY1 - entry.y2) < 3
            ? `M ${f(entryX1)} ${f(entryY1)} H ${f(entry.x2)}`
            : `M ${f(entryX1)} ${f(entryY1)} H ${f(entryBendX)} V ${f(entry.y2)} H ${f(entry.x2)}`;

        // ── 出口パス: 分岐列フッター左端 → 合流先 arrow 中心X ──
        // 出口は左寄り (+6px)、入口と重ならないよう分ける
        let exitD: string | null = null;
        let exitX2 = exit?.x2 ?? 0;
        let exitY2 = exit?.y2 ?? 0;
        if (exit) {
          if (activeDrag?.kind === "exit") {
            exitX2 = activeDrag.x;
            exitY2 = activeDrag.y;
          }
          const exitBendX = exit.x1 + 6;  // 分岐列直後で折れる（左寄り）
          exitD =
            Math.abs(exit.y1 - exitY2) < 3
              ? `M ${f(exit.x1)} ${f(exit.y1)} H ${f(exitX2)}`
              : `M ${f(exit.x1)} ${f(exit.y1)} H ${f(exitBendX)} V ${f(exitY2)} H ${f(exitX2)}`;
        }

        // ドラッグ中のハイライト色
        const entryDragging = activeDrag?.kind === "entry";
        const exitDragging  = activeDrag?.kind === "exit";

        const isSelected = selectedBranchFlowId === conn.branchFlowId;

        return (
          <g key={conn.branchFlowId}>
            {/* 入口矢印（青点線）― 見た目 */}
            <path
              d={entryD}
              fill="none"
              stroke={entryDragging ? "#f97316" : "#93c5fd"}
              strokeWidth={entryDragging ? 2 : 1.5}
              strokeDasharray="5 3"
              markerEnd={entryDragging ? "url(#bconn-arr-drag)" : "url(#bconn-arr-entry)"}
              style={{ pointerEvents: "none" }}
            />
            {/* 入口矢印 ― クリック判定用（透明・太め） */}
            <path
              d={entryD}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onSelectBranchFlow(conn.branchFlowId); }}
            />
            {/* 出口矢印（緑点線）― 見た目 */}
            {exitD && (
              <path
                d={exitD}
                fill="none"
                stroke={exitDragging ? "#f97316" : "#6ee7b7"}
                strokeWidth={exitDragging ? 2 : 1.5}
                strokeDasharray="5 3"
                markerEnd={exitDragging ? "url(#bconn-arr-drag)" : "url(#bconn-arr-exit)"}
                style={{ pointerEvents: "none" }}
              />
            )}
            {/* 出口矢印 ― クリック判定用（透明・太め） */}
            {exitD && (
              <path
                d={exitD}
                fill="none"
                stroke="transparent"
                strokeWidth={10}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); onSelectBranchFlow(conn.branchFlowId); }}
              />
            )}

            {/* ── ドラッグハンドル: 選択中のみ表示 ── */}
            {isSelected && (
              <>
                {/* 入口ハンドル（青●）― source arrow 右端 */}
                <circle
                  cx={f(entryX1)}
                  cy={f(entryY1)}
                  r={6}
                  fill={entryDragging ? "#f97316" : "#60a5fa"}
                  stroke="white"
                  strokeWidth={1.5}
                  style={{ pointerEvents: "all", cursor: "grab" }}
                  onPointerDown={(e) => startHandleDrag(e, conn.branchFlowId, "entry", entry.x1, entry.y1)}
                />
                {/* 出口ハンドル（緑●）― 合流先の矢じり位置 */}
                {exit && (
                  <circle
                    cx={f(exitX2)}
                    cy={f(exitY2)}
                    r={6}
                    fill={exitDragging ? "#f97316" : "#34d399"}
                    stroke="white"
                    strokeWidth={1.5}
                    style={{ pointerEvents: "all", cursor: "grab" }}
                    onPointerDown={(e) => startHandleDrag(e, conn.branchFlowId, "exit", exit.x2, exit.y2)}
                  />
                )}
              </>
            )}

            {/* ドラッグ中のホバーブロックハイライト＋ギャップインジケーター */}
            {activeDrag?.hoveredEl && activeDrag.hoveredGap && pageEl && (() => {
              const blockEl = activeDrag.hoveredEl;
              const gap = activeDrag.hoveredGap;
              const pr = pageEl.getBoundingClientRect();
              const br = blockEl.getBoundingClientRect();
              const rx = f(br.left - pr.left - 3);
              const ry = f(br.top - pr.top - 3);
              const rw = f(br.width + 6);
              const rh = f(br.height + 6);
              const gapPageY = f(gap.clientY - pr.top);
              const isEntry = activeDrag.kind === "entry";
              const color = isEntry ? "#60a5fa" : "#34d399";
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={rx} y={ry} width={rw} height={rh}
                    rx={4}
                    fill={isEntry ? "rgba(147,197,253,0.10)" : "rgba(110,231,183,0.10)"}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <line
                    x1={rx} y1={gapPageY} x2={rx + rw} y2={gapPageY}
                    stroke="#f97316"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${rx + rw + 3},${gapPageY} ${rx + rw + 8},${gapPageY - 4} ${rx + rw + 13},${gapPageY} ${rx + rw + 8},${gapPageY + 4}`}
                    fill="#f97316"
                  />
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// ページヘッダー（タイトル / 作成者 / 作成日）
// タイトル・作成者はリッチテキスト対応 contentEditable。
// グローバルフォント設定を CSS として継承し、
// リボンの B/I/U・フォント操作もテキスト選択経由で適用できる。
// ============================================================
function PageHeader() {
  const meta    = useDocumentStore((s) => s.doc?.meta);
  const setMeta = useDocumentStore((s) => s.setMeta);
  const { fontFamily, bold, italic } = useDisplayStore();
  if (!meta) return null;

  // グローバルフォントを CSS として流す（インライン書式は上書き可能）
  const baseFontStyle: React.CSSProperties = {
    fontFamily: FONT_CSS[fontFamily],
    fontStyle:  italic ? "italic" : undefined,
  };

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 pb-4">
      {/* タイトル: contentEditable でリッチテキスト対応 */}
      <RichHeaderRow
        label="タイトル"
        initialHtml={meta.titleRich ?? meta.title}
        placeholder="無題のプロトコル"
        onCommit={(text, rich) => setMeta({ title: text, titleRich: rich })}
        large
        fontStyle={{
          ...baseFontStyle,
          fontWeight: bold ? "bold" : "600", // グローバル bold が優先、なければ semibold
        }}
      />
      {/* 作成者: contentEditable でリッチテキスト対応 */}
      <RichHeaderRow
        label="作成者"
        initialHtml={meta.authorRich ?? meta.author}
        placeholder="例: 山田 太郎"
        onCommit={(text, rich) => setMeta({ author: text, authorRich: rich })}
        fontStyle={{
          ...baseFontStyle,
          fontWeight: bold ? "bold" : undefined,
        }}
      />
      {/* 作成日: プレーン input だがグローバルフォント（bold含む）は反映 */}
      <PlainHeaderRow
        label="作成日"
        value={meta.createdAt.slice(0, 10)}
        placeholder="YYYY-MM-DD"
        onChange={(v) => setMeta({ createdAt: v })}
        fontStyle={{ ...baseFontStyle, fontWeight: bold ? "bold" : undefined }}
      />
    </div>
  );
}

/**
 * contentEditable ヘッダー行（タイトル・作成者用）。
 * - リボンの B/I/U がテキスト選択経由で適用される
 * - fontStyle props でグローバルフォントを継承
 * - onCommit は blur 時に innerText + innerHTML を返す
 */
function RichHeaderRow({
  label, initialHtml, placeholder, onCommit, large = false, fontStyle = {},
}: {
  label: string;
  initialHtml: string;
  placeholder: string;
  onCommit: (text: string, richHtml?: string) => void;
  large?: boolean;
  fontStyle?: React.CSSProperties;
}) {
  const editRef = useRef<HTMLDivElement>(null);
  // ハイライトなしの実コンテンツを保持（blur 時に handleBlur が直接更新する）
  const cleanHtmlRef = useRef(initialHtml);
  // 前回の initialHtml を追跡（外部変化 = replaceAll か blur かを区別するため）
  const prevInitialHtmlRef = useRef(initialHtml);
  const [isFocused, setIsFocused] = useState(false);
  const searchQuery = useSearchStore((s) => s.query);

  // 非フォーカス時: initialHtml の外部変化（replaceAll など）または searchQuery の変化を反映する。
  // blur 直後は initialHtml がまだ古い値のことがあるため、
  // initialHtml が前回と異なる場合のみ cleanHtmlRef を更新する。
  useEffect(() => {
    if (!editRef.current || isFocused) return;
    // initialHtml が外部から変化した（replaceAll 等）場合のみ cleanHtmlRef を同期
    if (initialHtml !== prevInitialHtmlRef.current) {
      prevInitialHtmlRef.current = initialHtml;
      cleanHtmlRef.current = initialHtml;
    }
    editRef.current.innerHTML = searchQuery
      ? highlightHtml(cleanHtmlRef.current, searchQuery, true)
      : cleanHtmlRef.current;
  }, [initialHtml, searchQuery, isFocused]);

  function handleFocus() {
    setIsFocused(true);
    if (editRef.current) {
      // 検索ハイライト（<mark class="ptcl-hl">）が残っている場合のみ innerHTML を
      // クリーンな内容に差し替える。
      // restoreSelection() → ce.focus() によってフォーカスが当たるケースでは
      // DOM を再構築すると保存済み選択範囲のノード参照が無効になるため、
      // ハイライトがないときは innerHTML を上書きしない。
      if (editRef.current.querySelector(".ptcl-hl")) {
        editRef.current.innerHTML = cleanHtmlRef.current;
      }
    }
  }

  function handleBlur() {
    requestAnimationFrame(() => {
      const active = document.activeElement as HTMLElement | null;
      // リボン要素にフォーカスが移った場合はコミットしない
      if (active?.closest("[data-ribbon]")) return;
      if (!editRef.current) return;
      const innerHTML = editRef.current.innerHTML;
      const innerText = editRef.current.innerText.trim();
      // プレーンテキスト判定: <span> / <b> などインライン要素がなければプレーン扱い
      const hasInlineMarkup = /<[a-z]/i.test(innerHTML);
      const isPlain = !hasInlineMarkup;
      const newClean = isPlain ? innerText : innerHTML;
      cleanHtmlRef.current = newClean;
      // prevInitialHtmlRef も先行更新しておく。
      // こうすることで isFocused=false で useEffect が発火したとき、
      // 「initialHtml が変化した」とみなされず cleanHtmlRef を上書きしない。
      prevInitialHtmlRef.current = newClean;
      setIsFocused(false);
      onCommit(innerText, isPlain ? undefined : innerHTML);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-neutral-400">{label}</span>
      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          // Enter キーで改行しない（タイトル・作成者は1行想定）
          if (e.key === "Enter") e.preventDefault();
        }}
        style={{
          ...fontStyle,
          fontSize: large ? "1.1rem" : "0.875rem",
        }}
        className={[
          "flex-1 border-b border-transparent bg-transparent px-1 py-0.5 outline-none",
          "text-neutral-800",
          "hover:border-neutral-200 focus:border-blue-300",
          large ? "font-semibold" : "",
          "empty:before:text-neutral-300 empty:before:italic",
          "empty:before:content-[attr(data-placeholder)]",
        ].join(" ")}
      />
    </div>
  );
}

/** プレーンテキストヘッダー行（作成日など、書式不要なフィールド用）。 */
function PlainHeaderRow({
  label, value, placeholder, onChange, fontStyle = {},
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  fontStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-neutral-400">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...fontStyle, fontSize: "0.875rem" }}
        className={[
          "flex-1 border-b border-transparent bg-transparent px-1 py-0.5 outline-none",
          "text-neutral-800 placeholder-neutral-300",
          "hover:border-neutral-200 focus:border-blue-300",
        ].join(" ")}
      />
    </div>
  );
}
