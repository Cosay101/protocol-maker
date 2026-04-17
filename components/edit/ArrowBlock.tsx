"use client";
// 下向き矢印ブロック。side-in / side-out の付属情報も描画する。
// ギャップ（次のoperationへの挿入位置）を内包する。
import type { ArrowBlock as ArrowBlockType, Attachment } from "@/types/ptcl";
import { InsertGap } from "./InsertGap";

type Props = {
  block: ArrowBlockType;
  attachments: Attachment[];  // この arrow に紐付く side-in / side-out
  gapIndex: number;           // この arrow の下の gap の beforeBlockIndex
  gapActive: boolean;
  onGapClick: () => void;
};

export function ArrowBlock({
  attachments,
  gapIndex,
  gapActive,
  onGapClick,
}: Props) {
  const sideIns = attachments
    .filter((a) => a.kind === "side-in")
    .sort((a, b) => a.order - b.order);
  const sideOuts = attachments
    .filter((a) => a.kind === "side-out")
    .sort((a, b) => a.order - b.order);

  const maxRows = Math.max(sideIns.length, sideOuts.length, 1);
  // 矢印の高さ: 付属要素の行数に応じて伸びる（基本32px + 1行20px）
  const arrowHeight = 32 + (maxRows - 1) * 20;

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* 矢印本体 + side labels */}
      <div
        className="relative flex w-full items-center justify-center"
        style={{ height: arrowHeight }}
      >
        {/* 縦線 + 下向き三角（SVG） */}
        <svg
          width="20"
          height={arrowHeight}
          viewBox={`0 0 20 ${arrowHeight}`}
          className="shrink-0"
        >
          <line
            x1="10"
            y1="0"
            x2="10"
            y2={arrowHeight - 8}
            stroke="#9ca3af"
            strokeWidth="1.5"
          />
          <polygon
            points={`4,${arrowHeight - 8} 16,${arrowHeight - 8} 10,${arrowHeight}`}
            fill="#9ca3af"
          />
        </svg>

        {/* Side-in labels（左側） */}
        {sideIns.length > 0 && (
          <div className="absolute left-0 flex flex-col items-end gap-1 pr-6">
            {sideIns.map((att) => (
              <div key={att.id} className="flex items-center gap-1">
                {/* 水平線 */}
                <div className="h-[1px] w-10 bg-neutral-400" />
                {/* 左向き三角 */}
                <svg width="6" height="8" viewBox="0 0 6 8">
                  <polygon points="6,0 6,8 0,4" fill="#9ca3af" />
                </svg>
                <span className="text-xs text-neutral-600">{att.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Side-out labels（右側） */}
        {sideOuts.length > 0 && (
          <div className="absolute right-0 flex flex-col items-start gap-1 pl-6">
            {sideOuts.map((att) => (
              <div key={att.id} className="flex items-center gap-1">
                <span className="text-xs text-neutral-600">{att.text}</span>
                {/* 右向き三角 */}
                <svg width="6" height="8" viewBox="0 0 6 8">
                  <polygon points="0,0 0,8 6,4" fill="#9ca3af" />
                </svg>
                {/* 水平線 */}
                <div className="h-[1px] w-10 bg-neutral-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 挿入ギャップ（矢印の下） */}
      <InsertGap index={gapIndex} active={gapActive} onClick={onGapClick} />
    </div>
  );
}
