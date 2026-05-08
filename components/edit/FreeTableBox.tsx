"use client";
// 自由配置テーブルボックス
//
// 選択の3段階:
//   1. 全体選択 (mode="table")  : グリッド線部分をクリック → 全セルが青ボーダー
//   2. セル選択 (mode="cell")   : セル内部をクリック → そのセルだけ青、他は黒
//   3. テキスト編集 (mode="edit"): セルをダブルクリック → そのセルだけ青、他は黒、文字入力可
//
// グリッド線の判定:
//   コンテナの onMouseDown でクリック座標を取得し、
//   各列・行の境界線から BORDER_HIT px 以内 → 全体選択モード
//   それ以外 → セルの onClick に委ねる
//
// 操作:
//   - グリッド線ドラッグ → テーブル移動
//   - 角/辺ハンドル     → サイズ変更
//   - Escape           → cell→table
//   - Del              → テーブル削除（全体選択時のみ）
import { useState, useRef, useCallback, useEffect } from "react";
import type { TableFreeElement } from "@/types/ptcl";
import { FONT_CSS, type FontFamily } from "@/stores/displayStore";
import { useUiStore } from "@/stores/uiStore";
import { useSearchStore } from "@/stores/searchStore";
import { highlightHtml } from "@/lib/ptcl/search";

type CellPatch = {
  text?: string;
  richText?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFamily?: "gothic" | "mincho";
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
};

type Props = {
  el: TableFreeElement;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Omit<TableFreeElement, "id" | "type">>) => void;
  onUpdateCell: (row: number, col: number, patch: CellPatch) => void;
  onDelete: () => void;
  /** マルチドラッグ開始通知 */
  onMoveStart?: () => void;
};

// グリッド線クリック感知幅 (px) — 線の両側合計 BORDER_HIT*2 px が反応
const BORDER_HIT = 5;

const HANDLES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
type HandleDir = (typeof HANDLES)[number];

const HANDLE_STYLE: Record<HandleDir, React.CSSProperties> = {
  n:  { top: -5,    left: "50%",  transform: "translateX(-50%)", cursor: "n-resize" },
  ne: { top: -5,    right: -5,                                    cursor: "ne-resize" },
  e:  { top: "50%", right: -5,   transform: "translateY(-50%)", cursor: "e-resize" },
  se: { bottom: -5, right: -5,                                    cursor: "se-resize" },
  s:  { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" },
  sw: { bottom: -5, left: -5,                                     cursor: "sw-resize" },
  w:  { top: "50%", left: -5,   transform: "translateY(-50%)", cursor: "w-resize" },
  nw: { top: -5,    left: -5,                                     cursor: "nw-resize" },
};

export function FreeTableBox({ el, selected, onSelect, onUpdate, onUpdateCell, onDelete, onMoveStart }: Props) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell]   = useState<{ row: number; col: number } | null>(null);
  const editRef      = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // グリッド線クリックが発生したことを onClick に伝えるフラグ
  const borderClickRef = useRef(false);

  // uiStore へ選択中セルを同期（Ribbon がスタイル適用先を判定するため）
  const setSelectedTableCell = useUiStore((s) => s.setSelectedTableCell);
  const searchQuery = useSearchStore((s) => s.query);

  // 選択モード
  const mode = !selected
    ? "none"
    : editingCell != null
    ? "edit"
    : selectedCell != null
    ? "cell"
    : "table";

  // 外部から deselect されたら内部状態もリセット
  useEffect(() => {
    if (!selected) {
      setSelectedCell(null);
      setEditingCell(null);
      setSelectedTableCell(null);
    }
  }, [selected, setSelectedTableCell]);

  // selectedCell / editingCell が変わるたびに uiStore へ同期
  useEffect(() => {
    if (!selected) return;
    const activeCell = editingCell ?? selectedCell;
    if (activeCell) {
      setSelectedTableCell({ tableId: el.id, row: activeCell.row, col: activeCell.col });
    } else {
      // mode="table"（全体選択）
      setSelectedTableCell(null);
    }
  }, [selected, selectedCell, editingCell, el.id, setSelectedTableCell]);

  // ---- セルサイズ計算 ----
  const colWidths  = el.colWidths  ?? Array(el.cols).fill(1 / el.cols);
  const rowHeights = el.rowHeights ?? Array(el.rows).fill(1 / el.rows);

  function colPixels(c: number) { return Math.round(el.w * colWidths[c]); }
  function rowPixels(r: number) { return Math.round(el.h * rowHeights[r]); }
  function colOffset(c: number) {
    let x = 0;
    for (let i = 0; i < c; i++) x += colPixels(i);
    return x;
  }
  function rowOffset(r: number) {
    let y = 0;
    for (let i = 0; i < r; i++) y += rowPixels(i);
    return y;
  }

  // ---- セル編集コミット ----
  function commitCellEdit() {
    if (!editRef.current || !editingCell) return;
    const { row, col } = editingCell;
    const innerHTML = editRef.current.innerHTML;
    const innerText = editRef.current.innerText.trim();
    const isPlain   = innerHTML === innerText || innerHTML === innerText.replace(/\n/g, "<br>");
    onUpdateCell(row, col, {
      text:     isPlain ? innerText : innerHTML,
      richText: isPlain ? undefined : innerHTML,
    });
    setEditingCell(null);
  }

  // 編集開始時にコンテンツを初期化
  useEffect(() => {
    if (!editingCell || !editRef.current) return;
    const { row, col } = editingCell;
    const cell = el.cells[`${row},${col}`];
    editRef.current.innerHTML = cell?.richText ?? cell?.text ?? "";
    editRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editRef.current);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell]);

  // ---- グリッド線上かどうかを座標で判定 ----
  function isOnGridLine(ox: number, oy: number): boolean {
    // 列境界線（縦線）
    const cws = el.colWidths ?? Array(el.cols).fill(1 / el.cols);
    let cumX = 0;
    for (let c = 0; c <= el.cols; c++) {
      if (Math.abs(ox - cumX) < BORDER_HIT) return true;
      if (c < el.cols) cumX += Math.round(el.w * cws[c]);
    }
    // 行境界線（横線）
    const rhs = el.rowHeights ?? Array(el.rows).fill(1 / el.rows);
    let cumY = 0;
    for (let r = 0; r <= el.rows; r++) {
      if (Math.abs(oy - cumY) < BORDER_HIT) return true;
      if (r < el.rows) cumY += Math.round(el.h * rhs[r]);
    }
    return false;
  }

  // ---- コンテナ MouseDown ----
  // セルの onMouseDown は存在しないのでイベントはここまでバブルしてくる。
  // 座標でグリッド線か内部かを判定し、グリッド線なら全体選択＋移動を開始する。
  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 常に stopPropagation: ページキャンバスに伝わるのを防ぐ
      e.stopPropagation();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;

      if (!isOnGridLine(ox, oy)) {
        // セル内部クリック → cells の onClick に委ねる（ここでは何もしない）
        return;
      }

      // グリッド線クリック: ドラッグ移動 + クリックで全体選択
      e.preventDefault();
      if (editingCell) commitCellEdit();

      const startX = e.clientX, startY = e.clientY;
      const baseX = el.x, baseY = el.y;
      let moved = false;
      let moveStartNotified = false;

      function onMouseMove(ev: MouseEvent) {
        if (!moved && (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3)) {
          moved = true;
        }
        if (moved) {
          if (!moveStartNotified) { moveStartNotified = true; onMoveStart?.(); }
          onUpdate({ x: baseX + ev.clientX - startX, y: baseY + ev.clientY - startY });
        }
      }
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup",   onMouseUp);
        if (!moved) {
          // グリッド線クリック確定: 全体選択モードへ
          // cells の onClick が続けて発火するのを抑制するフラグを立てる
          borderClickRef.current = true;
          onSelect();
          setSelectedCell(null);
          setEditingCell(null);
          // click イベントが処理された後にフラグをリセット
          requestAnimationFrame(() => { borderClickRef.current = false; });
        }
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [el.x, el.y, el.w, el.h, el.rows, el.cols, el.colWidths, el.rowHeights, editingCell, onSelect, onUpdate, onMoveStart],
  );

  // ---- リサイズ ----
  function handleResizeMouseDown(e: React.MouseEvent, dir: HandleDir) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const baseX = el.x, baseY = el.y, baseW = el.w, baseH = el.h;
    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      let x = baseX, y = baseY, w = baseW, h = baseH;
      if (dir.includes("e")) w = Math.max(80, baseW + dx);
      if (dir.includes("s")) h = Math.max(40, baseH + dy);
      if (dir.includes("w")) { w = Math.max(80, baseW - dx); x = baseX + baseW - w; }
      if (dir.includes("n")) { h = Math.max(40, baseH - dy); y = baseY + baseH - h; }
      onUpdate({ x, y, w, h });
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
  }

  // ---- キーボード ----
  function handleKeyDown(e: React.KeyboardEvent) {
    if (mode === "edit") return;
    e.stopPropagation();
    if (e.key === "Escape" && mode === "cell") {
      setSelectedCell(null);
    }
    if ((e.key === "Delete" || e.key === "Backspace") && mode === "table") {
      e.preventDefault();
      onDelete();
    }
  }

  // ---- セルのボーダー色 ----
  function cellBorderColor(r: number, c: number): string {
    if (mode === "table") return "#3b82f6";
    if (mode === "cell" || mode === "edit") {
      const isSel = (selectedCell?.row === r && selectedCell?.col === c)
                 || (editingCell?.row  === r && editingCell?.col  === c);
      return isSel ? "#3b82f6" : "#000";
    }
    return "#000";
  }

  function cellBorderWidth(r: number, c: number): number {
    if (mode === "none") return 1;
    if (mode === "table") return 1.5;
    const isSel = (selectedCell?.row === r && selectedCell?.col === c)
               || (editingCell?.row  === r && editingCell?.col  === c);
    return isSel ? 1.5 : 1;
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-table-container="true"
      style={{
        position: "absolute",
        left: el.x,
        top:  el.y,
        width:  el.w,
        height: el.h,
        outline: "none",
        userSelect: mode === "edit" ? "auto" : "none",
        // グリッド線上では move カーソルを表示
        cursor: "default",
      }}
      onMouseDown={handleContainerMouseDown}
      // click が canvas まで届かないようにする
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {/* ===== セルグリッド ===== */}
      {Array.from({ length: el.rows }, (_, r) =>
        Array.from({ length: el.cols }, (_, c) => {
          const key       = `${r},${c}`;
          const cell      = el.cells[key];
          const cx        = colOffset(c);
          const cy        = rowOffset(r);
          const cw        = colPixels(c);
          const ch        = rowPixels(r);
          const isEditing = editingCell?.row === r && editingCell?.col === c;
          const borderColor = cellBorderColor(r, c);
          const borderW     = cellBorderWidth(r, c);

          const cellTextStyle: React.CSSProperties = {
            fontFamily:     cell?.fontFamily ? FONT_CSS[cell.fontFamily as FontFamily] : undefined,
            fontSize:       cell?.fontSize   ? `${cell.fontSize}px`                   : undefined,
            fontWeight:     cell?.bold       ? "bold"                                  : undefined,
            fontStyle:      cell?.italic     ? "italic"                                : undefined,
            textDecoration: cell?.underline  ? "underline"                             : undefined,
            textAlign:      cell?.textAlign  ?? "left",
          };

          return (
            <div
              key={key}
              style={{
                position:   "absolute",
                left:       cx,
                top:        cy,
                width:      cw,
                height:     ch,
                border:     `${borderW}px solid ${borderColor}`,
                boxSizing:  "border-box",
                overflow:   "hidden",
                padding:    "2px 4px",
                cursor:     isEditing ? "text" : "default",
                transition: "border-color 0.1s",
              }}
              // onMouseDown は設定しない:
              //   → バブルしてコンテナの handleContainerMouseDown が座標を判定する
              onClick={(e) => {
                // 常に stopPropagation (canvas への伝播を防ぐ)
                e.stopPropagation();
                // グリッド線クリックとして処理済みなら何もしない
                if (borderClickRef.current) return;
                // セル内部クリック: セル選択
                if (!selected) onSelect();
                if (editingCell && (editingCell.row !== r || editingCell.col !== c)) {
                  commitCellEdit();
                }
                if (!isEditing) {
                  setSelectedCell({ row: r, col: c });
                  setEditingCell(null);
                  // コンテナにフォーカスを移してキーボード操作（Escape など）を有効化
                  containerRef.current?.focus();
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!selected) onSelect();
                setSelectedCell({ row: r, col: c });
                setEditingCell({ row: r, col: c });
              }}
            >
              {isEditing ? (
                <div
                  ref={editRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="h-full w-full outline-none"
                  style={{ ...cellTextStyle, minHeight: "1em", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                  onBlur={() => {
                    requestAnimationFrame(() => {
                      const active = document.activeElement as HTMLElement | null;
                      // リボン操作中（フォント変更など）は commit しない
                      // → CE を保持したまま書式適用できるようにする
                      if (active?.closest("[data-ribbon]")) return;
                      if (!active || !active.closest("[data-table-container]")) {
                        commitCellEdit();
                      }
                    });
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") { e.preventDefault(); commitCellEdit(); }
                    if (e.key === "Tab")    { e.preventDefault(); commitCellEdit(); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", ...cellTextStyle }}
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      const raw = cell?.richText ?? cell?.text ?? "";
                      return searchQuery
                        ? highlightHtml(raw, searchQuery, !!cell?.richText)
                        : raw;
                    })(),
                  }}
                />
              )}
            </div>
          );
        })
      )}

      {/* ===== リサイズハンドル（selected のとき） ===== */}
      {selected && !editingCell && HANDLES.map((dir) => (
        <div
          key={dir}
          style={{
            position: "absolute",
            width: 10, height: 10,
            backgroundColor: "white",
            border: "1.5px solid #60a5fa",
            borderRadius: 2,
            zIndex: 20,
            ...HANDLE_STYLE[dir],
          }}
          onMouseDown={(e) => { e.stopPropagation(); handleResizeMouseDown(e, dir); }}
        />
      ))}

      {/* ===== ツールバー（selected のとき） ===== */}
      {selected && mode !== "edit" && (
        <div
          style={{ position: "absolute", top: -44, left: 0, zIndex: 200 }}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 shadow-lg whitespace-nowrap"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-neutral-400">列幅</span>
          <input
            type="number"
            min={40}
            value={Math.round(el.w / el.cols)}
            onChange={(e) => {
              const cellW = Math.max(40, Number(e.target.value));
              onUpdate({ w: cellW * el.cols });
            }}
            className="h-6 w-14 rounded border border-neutral-200 px-1 text-[11px] text-neutral-700 outline-none focus:border-blue-400"
          />
          <span className="text-[10px] text-neutral-400">px　行高</span>
          <input
            type="number"
            min={20}
            value={Math.round(el.h / el.rows)}
            onChange={(e) => {
              const cellH = Math.max(20, Number(e.target.value));
              onUpdate({ h: cellH * el.rows });
            }}
            className="h-6 w-14 rounded border border-neutral-200 px-1 text-[11px] text-neutral-700 outline-none focus:border-blue-400"
          />
          <span className="text-[10px] text-neutral-400">px</span>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <button
            type="button"
            className="flex h-6 items-center rounded px-1 text-[10px] text-red-400 hover:bg-red-50"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
