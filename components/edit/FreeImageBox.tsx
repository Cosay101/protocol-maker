"use client";
// 自由配置画像ボックス（パワポライク）
//   - クリック            → 選択
//   - ドラッグ            → 移動
//   - 角/辺ハンドル       → リサイズ（回転に対応）
//   - 回転ハンドル        → 回転（Shift: 15° スナップ）
//   - ツールバー          → 左右反転 / 上下反転 / リセット / 削除
//   - Del (選択中)        → 削除
import { useRef, useCallback } from "react";
import type { ImageFreeElement } from "@/types/ptcl";

type Patch = Partial<Omit<ImageFreeElement, "id" | "type">>;

type Props = {
  el: ImageFreeElement;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Patch) => void;
  onDelete: () => void;
  /** マルチドラッグ開始通知 */
  onMoveStart?: () => void;
};

// 8 方向リサイズハンドル
const HANDLES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
type HandleDir = (typeof HANDLES)[number];

const HANDLE_STYLE: Record<HandleDir, React.CSSProperties> = {
  n:  { top: -5,    left: "50%",  transform: "translateX(-50%)", cursor: "n-resize"  },
  ne: { top: -5,    right: -5,                                    cursor: "ne-resize" },
  e:  { top: "50%", right: -5,   transform: "translateY(-50%)", cursor: "e-resize"  },
  se: { bottom: -5, right: -5,                                    cursor: "se-resize" },
  s:  { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "s-resize"  },
  sw: { bottom: -5, left: -5,                                     cursor: "sw-resize" },
  w:  { top: "50%", left: -5,   transform: "translateY(-50%)", cursor: "w-resize"  },
  nw: { top: -5,    left: -5,                                     cursor: "nw-resize" },
};

export function FreeImageBox({ el, selected, onSelect, onUpdate, onDelete, onMoveStart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotation = el.rotation ?? 0;

  // ---- 移動ドラッグ ----
  const handleMoveMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect();
      onMoveStart?.();
      const startX = e.clientX, startY = e.clientY;
      const baseX = el.x, baseY = el.y;
      function onMouseMove(ev: MouseEvent) {
        onUpdate({ x: baseX + ev.clientX - startX, y: baseY + ev.clientY - startY });
      }
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [el.x, el.y, onSelect, onUpdate, onMoveStart],
  );

  // ---- リサイズドラッグ（回転を考慮した座標変換）----
  function handleResizeMouseDown(e: React.MouseEvent, dir: HandleDir) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const baseX = el.x, baseY = el.y, baseW = el.w, baseH = el.h;
    // マウスデルタをローカル座標（要素の向き）に変換するための逆回転
    const rad    = -rotation * Math.PI / 180;
    const cosInv = Math.cos(rad), sinInv = Math.sin(rad);
    // 中心をスクリーン座標に戻すための正回転
    const rotRad = rotation * Math.PI / 180;
    const cosr = Math.cos(rotRad), sinr = Math.sin(rotRad);

    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // スクリーンデルタ → ローカル座標
      const ldx = dx * cosInv - dy * sinInv;
      const ldy = dx * sinInv + dy * cosInv;

      let newW = baseW, newH = baseH;
      if (dir.includes("e")) newW = Math.max(40, baseW + ldx);
      if (dir.includes("s")) newH = Math.max(40, baseH + ldy);
      if (dir.includes("w")) newW = Math.max(40, baseW - ldx);
      if (dir.includes("n")) newH = Math.max(40, baseH - ldy);

      // 反対側エッジを固定するために中心をずらす
      let deltaLocalCx = 0, deltaLocalCy = 0;
      if      (dir.includes("w")) deltaLocalCx = (baseW - newW) / 2;
      else if (dir.includes("e")) deltaLocalCx = (newW - baseW) / 2;
      if      (dir.includes("n")) deltaLocalCy = (baseH - newH) / 2;
      else if (dir.includes("s")) deltaLocalCy = (newH - baseH) / 2;

      // ローカル中心デルタ → スクリーン座標
      const cx = baseX + baseW / 2 + deltaLocalCx * cosr - deltaLocalCy * sinr;
      const cy = baseY + baseH / 2 + deltaLocalCx * sinr + deltaLocalCy * cosr;

      onUpdate({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH });
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // ---- 回転ドラッグ ----
  function handleRotateMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    // 要素の中心をクライアント座標で取得
    const rect = containerRef.current!.getBoundingClientRect();
    const cxClient = rect.left + rect.width  / 2;
    const cyClient = rect.top  + rect.height / 2;

    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - cxClient;
      const dy = ev.clientY - cyClient;
      // 上方向が 0°、時計回りが正
      let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
      if (ev.shiftKey) angle = Math.round(angle / 15) * 15;
      onUpdate({ rotation: Math.round(angle * 10) / 10 });
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // ---- キーボード ----
  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete();
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-image-container="true"
      style={{
        position: "absolute",
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "50% 50%",
        outline: "none",
        userSelect: "none",
        cursor: selected ? "move" : "default",
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={handleMoveMouseDown}
      onKeyDown={handleKeyDown}
    >
      {/* ---- 画像本体 ---- */}
      <img
        src={el.src}
        alt={el.name}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          transform: `scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
          pointerEvents: "none",
        }}
      />

      {/* ---- 選択時ボーダー ---- */}
      {selected && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "1.5px solid #60a5fa",
            pointerEvents: "none",
          }}
        />
      )}

      {/* ---- 回転ハンドル（選択時） ---- */}
      {selected && (
        <>
          {/* 線 */}
          <div
            style={{
              position: "absolute",
              top: -22,
              left: "50%",
              transform: "translateX(-50%)",
              width: 1,
              height: 18,
              backgroundColor: "#60a5fa",
              pointerEvents: "none",
            }}
          />
          {/* ハンドル円 */}
          <div
            title="ドラッグして回転（Shift: 15° スナップ）"
            style={{
              position: "absolute",
              top: -34,
              left: "50%",
              transform: "translateX(-50%)",
              width: 14,
              height: 14,
              backgroundColor: "white",
              border: "1.5px solid #60a5fa",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
            }}
            onMouseDown={handleRotateMouseDown}
          />
        </>
      )}

      {/* ---- リサイズハンドル（選択時） ---- */}
      {selected && HANDLES.map((dir) => (
        <div
          key={dir}
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            backgroundColor: "white",
            border: "1.5px solid #60a5fa",
            borderRadius: 2,
            zIndex: 5,
            ...HANDLE_STYLE[dir],
          }}
          onMouseDown={(e) => handleResizeMouseDown(e, dir)}
        />
      ))}

      {/* ---- 選択時ツールバー（反転 / リセット / 削除） ---- */}
      {selected && (
        <div
          style={{ position: "absolute", top: -44, left: 0, zIndex: 200 }}
          className="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 shadow-lg whitespace-nowrap"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ToolBtn title="左右反転" onClick={() => onUpdate({ flipX: !el.flipX })}>↔</ToolBtn>
          <ToolBtn title="上下反転" onClick={() => onUpdate({ flipY: !el.flipY })}>↕</ToolBtn>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <ToolBtn
            title="回転・反転をリセット"
            onClick={() => onUpdate({ rotation: 0, flipX: false, flipY: false })}
          >
            ↺
          </ToolBtn>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <ToolBtn
            title="削除"
            className="text-red-400 hover:!bg-red-50"
            onClick={onDelete}
          >
            ✕
          </ToolBtn>
        </div>
      )}
    </div>
  );
}

// ---- ツールバーボタン ----
function ToolBtn({
  children,
  title,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={[
        "flex h-6 min-w-[24px] items-center justify-center rounded px-1 text-[12px] text-neutral-700",
        "hover:bg-neutral-100 active:bg-neutral-200",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
