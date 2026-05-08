"use client";
// ブロック間の挿入ボタン。クリックでドロップダウンを表示し、
// 「ボックスを挿入」または「空白を挿入」を選択できる。
import { useState, useRef, useEffect } from "react";

type Props = {
  index: number;
  onDirectInsert: () => void;
  /** 空白を挿入するコールバック（省略時はメニューなし） */
  onInsertSpacer?: () => void;
  /** 改列マーカーを挿入するコールバック（省略時は非表示） */
  onInsertColumnBreak?: () => void;
  extraH?: number;
};

const BASE_H = 20;
const MIN_H  = 4;

export function InsertGap({ onDirectInsert, onInsertSpacer, onInsertColumnBreak, extraH = 0 }: Props) {
  const h = Math.max(MIN_H, BASE_H + extraH);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasMenu = !!(onInsertSpacer || onInsertColumnBreak);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    const id = requestAnimationFrame(() => document.addEventListener("pointerdown", onDown));
    return () => { cancelAnimationFrame(id); document.removeEventListener("pointerdown", onDown); };
  }, [menuOpen]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (hasMenu) {
      setMenuOpen((v) => !v);
    } else {
      onDirectInsert();
    }
  }

  return (
    <div
      ref={ref}
      data-no-print
      className="group relative flex w-full cursor-pointer items-center justify-center select-none"
      style={{ height: h }}
      title="ここにステップを追加"
      onClick={handleClick}
      role="button"
      tabIndex={-1}
      onKeyDown={(e) => e.key === "Enter" && handleClick(e as unknown as React.MouseEvent)}
    >
      {/* 水平ライン */}
      <div className="h-[2px] w-full rounded-full bg-transparent transition-colors group-hover:bg-blue-200" />
      {/* + バッジ */}
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-transparent px-1.5 text-[10px] font-bold leading-4 text-transparent transition-colors group-hover:bg-blue-400 group-hover:text-white">
        +
      </span>

      {/* ドロップダウンメニュー */}
      {menuOpen && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl"
          style={{ minWidth: 160 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-blue-50 hover:text-blue-600"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDirectInsert(); }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded border border-neutral-300 text-[10px]">□</span>
            ボックスを挿入
          </button>
          {onInsertSpacer && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-blue-50 hover:text-blue-600"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onInsertSpacer(); }}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-neutral-300 text-[10px]">⬜</span>
              空白を挿入
            </button>
          )}
          {onInsertColumnBreak && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-blue-50 hover:text-blue-600"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onInsertColumnBreak(); }}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded border border-blue-300 text-[10px] text-blue-400">↵</span>
              改列を挿入
            </button>
          )}
        </div>
      )}
    </div>
  );
}
