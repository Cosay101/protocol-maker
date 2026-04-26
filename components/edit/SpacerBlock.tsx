"use client";
// 空白スペーサーブロック。高さをドラッグで変更できる。
// ホバー時に × 削除ボタンと下端リサイズハンドルを表示。

import { useState } from "react";

type Props = {
  h: number;
  colW: number;
  onUpdateHeight: (h: number) => void;
  onDelete: () => void;
};

export function SpacerBlock({ h, colW, onUpdateHeight, onDelete }: Props) {
  const [hovered, setHovered] = useState(false);

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const baseH = h;
    function onMouseMove(ev: MouseEvent) {
      onUpdateHeight(Math.max(20, Math.round(baseH + ev.clientY - startY)));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      style={{ width: colW, height: h, position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* × 削除ボタン（ホバー時のみ表示） */}
      {hovered && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: "absolute",
            top: "50%",
            right: 4,
            transform: "translateY(-50%)",
          }}
          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-400"
          tabIndex={-1}
          aria-label="空白を削除"
          title="空白を削除"
        >
          ✕
        </button>
      )}

      {/* 下端のリサイズハンドル（ホバー時のみ表示） */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 48,
          height: 10,
          cursor: "s-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseDown={handleResizeMouseDown}
        title="ドラッグして高さを変更"
      >
        <div
          className="h-1 w-8 rounded-full bg-neutral-200 transition-opacity hover:bg-blue-400"
          style={{ opacity: hovered ? 1 : 0 }}
        />
      </div>
    </div>
  );
}
