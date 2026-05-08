"use client";
// 分岐ブロック。フロー中の条件分岐を表す。
//
// 表示レイアウト:
//   ◇ [条件テキスト]
//    /              \
//  [はい]         [いいえ]
//
// 選択時: 各フィールドが contentEditable になり編集可能。
// 非選択時: 静的テキスト表示。

import { useRef, useEffect, useCallback } from "react";
import type { BranchBlock as BranchBlockType } from "@/types/ptcl";

type Props = {
  block: BranchBlockType;
  selected: boolean;
  colW: number;
  onSelect: () => void;
  onUpdate: (patch: { condition?: string; yesLabel?: string; noLabel?: string }) => void;
  onDelete: () => void;
};

/** contentEditable div のコミット処理（trim してコールバック） */
function useEditableField(
  ref: React.RefObject<HTMLDivElement | null>,
  selected: boolean,
  value: string,
  onCommit: (v: string) => void,
) {
  // 選択状態になったとき / 値が変わったときに初期化
  useEffect(() => {
    if (!selected || !ref.current) return;
    // カーソル位置を破壊しないよう、値が変わったときのみ更新
    if (ref.current.innerText.trim() !== value) {
      ref.current.innerText = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const commit = useCallback(() => {
    onCommit(ref.current?.innerText.trim() ?? "");
  }, [ref, onCommit]);

  return commit;
}

export function BranchBlock({ block, selected, colW, onSelect, onUpdate, onDelete }: Props) {
  const condRef  = useRef<HTMLDivElement>(null);
  const yesRef   = useRef<HTMLDivElement>(null);
  const noRef    = useRef<HTMLDivElement>(null);

  const commitCond = useEditableField(condRef,  selected, block.condition, (v) => onUpdate({ condition: v }));
  const commitYes  = useEditableField(yesRef,   selected, block.yesLabel,  (v) => onUpdate({ yesLabel: v }));
  const commitNo   = useEditableField(noRef,    selected, block.noLabel,   (v) => onUpdate({ noLabel: v }));

  const borderColor = "#9ca3af";
  const forkColor   = "#d1d5db";

  // SVG フォーク線の座標
  const midX    = colW / 2;
  const leftX   = Math.max(16, colW * 0.18);
  const rightX  = Math.min(colW - 16, colW * 0.82);
  const forkH   = 28;

  return (
    <div
      className={[
        "group relative select-none rounded-md transition-colors",
        "cursor-pointer hover:bg-neutral-50",
      ].join(" ")}
      style={{ width: colW }}
      onClick={(e) => { e.stopPropagation(); if (!selected) onSelect(); }}
    >
      {/* 条件テキスト行 */}
      <div className="flex items-center justify-center gap-1.5 px-8 pt-3 pb-1">
        {/* ダイヤモンドアイコン */}
        <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0">
          <polygon
            points="7,0 14,7 7,14 0,7"
            fill="none"
            stroke={borderColor}
            strokeWidth={1.5}
          />
        </svg>

        {selected ? (
          <div
            ref={condRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={commitCond}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); condRef.current?.blur(); }
              if (e.key === "Escape") { e.preventDefault(); condRef.current?.blur(); }
            }}
            onClick={(e) => e.stopPropagation()}
            data-placeholder="条件を入力…"
            className={[
              "min-w-[80px] max-w-full border-b border-blue-300 text-center text-sm",
              "text-neutral-800 outline-none",
              "empty:before:italic empty:before:text-neutral-300",
              "empty:before:content-[attr(data-placeholder)]",
            ].join(" ")}
          />
        ) : (
          <span
            className={[
              "text-center text-sm",
              block.condition ? "text-neutral-800" : "italic text-neutral-300",
            ].join(" ")}
          >
            {block.condition || "条件を入力…"}
          </span>
        )}
      </div>

      {/* フォーク線（SVG） */}
      <svg
        width={colW}
        height={forkH}
        style={{ display: "block", overflow: "visible" }}
        aria-hidden
      >
        <line x1={midX}  y1={0} x2={leftX}  y2={forkH} stroke={forkColor} strokeWidth={1.5} />
        <line x1={midX}  y1={0} x2={rightX} y2={forkH} stroke={forkColor} strokeWidth={1.5} />
      </svg>

      {/* 分岐ラベル行 */}
      <div className="flex items-start justify-between pb-3" style={{ paddingLeft: Math.max(4, leftX - 32), paddingRight: Math.max(4, colW - rightX - 32) }}>
        {/* Yes ラベル */}
        {selected ? (
          <div
            ref={yesRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={commitYes}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); yesRef.current?.blur(); }
              if (e.key === "Escape") { e.preventDefault(); yesRef.current?.blur(); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-[32px] border-b border-blue-200 text-center text-xs text-blue-600 outline-none"
          />
        ) : (
          <span className="text-xs font-medium text-blue-500">{block.yesLabel}</span>
        )}

        {/* No ラベル */}
        {selected ? (
          <div
            ref={noRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={commitNo}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); noRef.current?.blur(); }
              if (e.key === "Escape") { e.preventDefault(); noRef.current?.blur(); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-[32px] border-b border-blue-200 text-center text-xs text-neutral-500 outline-none"
          />
        ) : (
          <span className="text-xs font-medium text-neutral-400">{block.noLabel}</span>
        )}
      </div>

      {/* × 削除ボタン */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className={[
          "absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full",
          "text-[10px] text-neutral-300 transition-[opacity,color] hover:text-red-400",
          "opacity-0 group-hover:opacity-100",
        ].join(" ")}
        tabIndex={-1}
        aria-label="削除"
      >
        ✕
      </button>
    </div>
  );
}
