"use client";
// 自由矢印（ポリライン）コンポーネント。パワポ準拠の操作感。
//
// 操作:
//   ライン上クリック     → 全体選択
//   全体選択中ライン上ドラッグ → 全体移動
//   制御点ドラッグ       → その点を移動（始点・終点・中間点すべて）
//   中間点の × ボタン    → その点を削除
//   全体削除ボタン       → 矢印全体を削除
//   矢じりは常に終点に表示

import { useState } from "react";
import type { ArrowFreeElement } from "@/types/ptcl";

type Point = { x: number; y: number };

type Props = {
  el: ArrowFreeElement;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Omit<ArrowFreeElement, "id" | "type">>) => void;
  onDelete: () => void;
  /** マルチドラッグ開始通知 */
  onMoveStart?: () => void;
};

const HANDLE_R  = 6;    // 制御点ハンドル半径 (px)
const HIT_W     = 16;   // ライン hit-test 幅 (px)
const ARROW_LEN = 14;   // 矢じり長さ
const ARROW_DEG = 28;   // 矢じり半角 (度)
const DEL_OFFSET = 18;  // × ボタンのハンドルからのオフセット

function ptStr(pts: Point[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

function arrowhead(pts: Point[]): string {
  if (pts.length < 2) return "";
  const tip = pts[pts.length - 1];
  const prv = pts[pts.length - 2];
  const a = Math.atan2(tip.y - prv.y, tip.x - prv.x);
  const r = (ARROW_DEG * Math.PI) / 180;
  const p1x = tip.x - ARROW_LEN * Math.cos(a + r);
  const p1y = tip.y - ARROW_LEN * Math.sin(a + r);
  const p2x = tip.x - ARROW_LEN * Math.cos(a - r);
  const p2y = tip.y - ARROW_LEN * Math.sin(a - r);
  return `${p1x},${p1y} ${tip.x},${tip.y} ${p2x},${p2y}`;
}

function bbox(pts: Point[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys),
  };
}

/**
 * ウィンドウレベルのドラッグを開始する。
 * onMove には「ドラッグ開始点からの累計移動量 (dx, dy)」を渡す。
 * クロージャ内の points が stale になっても、
 * 呼び出し側で「開始時のスナップショット + 累計デルタ」で絶対座標を計算するため安全。
 */
function startWindowDrag(
  startX: number,
  startY: number,
  onMove: (dx: number, dy: number) => void,
  onEnd?: () => void,
) {
  function onPointermove(ev: PointerEvent) {
    onMove(ev.clientX - startX, ev.clientY - startY);
  }
  function onPointerup() {
    window.removeEventListener("pointermove", onPointermove);
    window.removeEventListener("pointerup",   onPointerup);
    onEnd?.();
  }
  window.addEventListener("pointermove", onPointermove);
  window.addEventListener("pointerup",   onPointerup);
}

export function FreeArrowBox({ el, selected, onSelect, onUpdate, onDelete, onMoveStart }: Props) {
  const { points, color, strokeWidth } = el;
  const [hovered, setHovered] = useState(false);

  const lineColor = selected ? "#3b82f6" : color;
  const bb = bbox(points);

  // ---- ライン全体のポインターダウン ----
  function handleLinePointerDown(e: React.PointerEvent<SVGElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (!selected) {
      // まず選択だけ。ドラッグは次の pointerdown から。
      onSelect();
      return;
    }

    // 全体ドラッグ: ドラッグ開始時の全点をスナップショット
    onMoveStart?.();
    const startPts = points.map((p) => ({ ...p }));
    startWindowDrag(e.clientX, e.clientY, (dx, dy) => {
      onUpdate({ points: startPts.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
    });
  }

  // ---- 制御点のポインターダウン ----
  function handlePointPointerDown(e: React.PointerEvent<SVGCircleElement>, ptIdx: number) {
    e.preventDefault();
    e.stopPropagation();

    if (!selected) {
      onSelect();
      return;
    }

    // この点のスナップショット + 他の点スナップショット
    const startPt  = { ...points[ptIdx] };
    const startPts = points.map((p) => ({ ...p }));
    startWindowDrag(e.clientX, e.clientY, (dx, dy) => {
      onUpdate({
        points: startPts.map((p, i) =>
          i === ptIdx ? { x: startPt.x + dx, y: startPt.y + dy } : p,
        ),
      });
    });
  }

  const showHandles = selected || hovered;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: selected ? 60 : 50,
      }}
    >
      {/* ---- hit-test 用透明太線（ライン全体の当たり判定） ---- */}
      <polyline
        points={ptStr(points)}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_W}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "stroke", cursor: selected ? "move" : "pointer" }}
        onPointerDown={handleLinePointerDown}
        onClick={(e) => e.stopPropagation()}   // 紙面の click に伝播しない
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* ---- 実線 ---- */}
      <polyline
        points={ptStr(points)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      />

      {/* ---- 矢じり ---- */}
      <polyline
        points={arrowhead(points)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
      />

      {/* ---- 全体削除ボタン（選択時のみ、バウンディングボックス右上） ---- */}
      {selected && (
        <g
          style={{ pointerEvents: "all", cursor: "pointer" }}
          transform={`translate(${bb.maxX + 18},${bb.minY - 18})`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <circle r={10} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fill="#ef4444"
            style={{ userSelect: "none" }}
          >
            ✕
          </text>
        </g>
      )}

      {/* ---- 制御点ハンドル ---- */}
      {showHandles && points.map((pt, idx) => {
        const isEndpoint = idx === 0 || idx === points.length - 1;

        return (
          <g key={idx}>
            {/* ハンドル本体 */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={HANDLE_R}
              fill={selected ? "#dbeafe" : "#eff6ff"}
              stroke={selected ? "#3b82f6" : "#93c5fd"}
              strokeWidth={1.5}
              style={{ pointerEvents: "all", cursor: selected ? "grab" : "pointer" }}
              onPointerDown={(e) => handlePointPointerDown(e, idx)}
              onClick={(e) => e.stopPropagation()}
            />
            {/* 中間点の × ボタン（始点・終点には不表示） */}
            {selected && !isEndpoint && (
              <g
                style={{ pointerEvents: "all", cursor: "pointer" }}
                transform={`translate(${pt.x + DEL_OFFSET},${pt.y - DEL_OFFSET})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ points: points.filter((_, i) => i !== idx) });
                }}
              >
                <circle r={8} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fill="#ef4444"
                  style={{ userSelect: "none" }}
                >
                  ✕
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
