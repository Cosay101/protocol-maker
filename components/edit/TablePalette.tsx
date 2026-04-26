"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDocumentStore } from "@/stores/documentStore";
import { getPaperDims } from "@/lib/ptcl/layout";
import { useUiStore } from "@/stores/uiStore";

type Props = {
  /** トリガーボタンの位置（fixed 配置の基準） */
  anchorRect: DOMRect;
  onClose: () => void;
};

export function TablePalette({ anchorRect, onClose }: Props) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const panelRef = useRef<HTMLDivElement>(null);
  const addFreeTableElement = useDocumentStore((s) => s.addFreeTableElement);
  const doc = useDocumentStore((s) => s.doc);
  const setSelectedFreeId = useUiStore((s) => s.setSelectedFreeId);

  // パネル外クリックで閉じる
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    const id = requestAnimationFrame(() => document.addEventListener("pointerdown", onDown));
    return () => { cancelAnimationFrame(id); document.removeEventListener("pointerdown", onDown); };
  }, [onClose]);

  function handleInsert() {
    if (!doc) return;
    const { w: paperW, h: paperH } = getPaperDims(doc.page.size, doc.page.orientation);
    const cellW = Math.min(100, Math.floor((paperW - 128) / cols));
    const cellH = 36;
    const w = cols * cellW;
    const h = rows * cellH;
    const x = Math.round((paperW - w) / 2);
    const y = Math.round(paperH * 0.35);
    const id = addFreeTableElement(x, y, rows, cols);
    setSelectedFreeId(id);
    onClose();
  }

  const previewRows = Math.min(rows, 6);
  const previewCols = Math.min(cols, 6);

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        zIndex: 9999,
      }}
      className="w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 text-xs font-semibold text-neutral-600">表を挿入</div>

      {/* 行・列入力 */}
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-neutral-500">行</label>
        <input
          type="number"
          min={1}
          max={20}
          value={rows}
          onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value))))}
          className="h-7 w-16 rounded border border-neutral-200 px-2 text-xs text-neutral-700 outline-none focus:border-blue-400"
        />
        <span className="text-xs text-neutral-400">×</span>
        <label className="text-xs text-neutral-500">列</label>
        <input
          type="number"
          min={1}
          max={20}
          value={cols}
          onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value))))}
          className="h-7 w-16 rounded border border-neutral-200 px-2 text-xs text-neutral-700 outline-none focus:border-blue-400"
        />
      </div>

      {/* プレビューグリッド */}
      <div className="mb-3 flex justify-center">
        <div
          style={{
            display: "inline-grid",
            gridTemplateColumns: `repeat(${previewCols}, 20px)`,
            gridTemplateRows: `repeat(${previewRows}, 16px)`,
            border: "1px solid #000",
          }}
        >
          {Array.from({ length: previewRows * previewCols }, (_, i) => (
            <div key={i} style={{ border: "0.5px solid #000", width: 20, height: 16 }} />
          ))}
        </div>
        {(rows > 6 || cols > 6) && (
          <span className="ml-2 self-center text-[10px] text-neutral-400">…({rows}×{cols})</span>
        )}
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center rounded-lg bg-blue-500 py-2 text-xs font-semibold text-white hover:bg-blue-600"
        onClick={handleInsert}
      >
        挿入
      </button>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
