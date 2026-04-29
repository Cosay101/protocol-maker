"use client";
// 下向き矢印ブロック。
// アタッチメントはグローバル追加順（order フィールド）で表示。
//
// ビジュアルルール:
//   side-in (←): tipがステムに接触。  |stem|← ——— label
//   side-out (→): ステムから右へ出る。  |stem| ——→ label
//   loop    (↺): ステムに重なる横長楕円ループ矢印。高さ最小。
//
// アタッチメントのラベルは contentEditable div。
//   - フォーカス時: リボンのフォント/サイズ/B/I/U がブロックレベルで適用される
//   - テキスト選択時: リボンがインラインスタイルを適用する
//   - グローバル未選択時: displayStore のフォント設定がそのまま反映される
import { useState, useRef, useEffect } from "react";
import type { ArrowBlock as ArrowBlockType, Attachment, BlockStyle } from "@/types/ptcl";
import { useDisplayStore, FONT_CSS, type FontFamily } from "@/stores/displayStore";
import { useSearchStore } from "@/stores/searchStore";
import { highlightHtml } from "@/lib/ptcl/search";
import { InsertGap } from "./InsertGap";

type Props = {
  block: ArrowBlockType;
  attachments: Attachment[];
  gapIndex: number;
  gapActive: boolean;
  selected: boolean;
  onSelect: () => void;
  onGapDirectInsert: () => void;
  onGapInsertColumnBreak?: () => void;
  onAddAttachment: (kind: "side-in" | "side-out" | "loop", text: string) => void;
  onUpdateAttachment: (id: string, text: string, richText?: string) => void;
  onRemoveAttachment: (id: string) => void;
  onNext: () => void;
};

// ---- 定数 ----
const STEM_W = 20;     // 中央ステムゾーン幅(px)
const STEM_TOP = 8;    // ステム上部余白
const STEM_BOTTOM = 18;// ステム下部（矢印先端含む）余白
const ROW_H = 32;      // side-in / side-out の行高
const LOOP_H = 18;     // loop の行高（コンパクト）

// HTML エスケープ（テキストを innerHTML に埋め込む際に使用）
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// グローバルフォント設定の型
type GlobalFontProps = {
  fontFamily: FontFamily;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

// アタッチメントの有効スタイルを計算（attachment.style > グローバル）
function makeEffectiveStyle(att: Attachment, g: GlobalFontProps): React.CSSProperties {
  const s = att.style as BlockStyle | undefined;
  return {
    fontFamily:     FONT_CSS[(s?.fontFamily ?? g.fontFamily) as FontFamily],
    fontSize:       `${s?.fontSize ?? g.fontSize}px`,
    fontWeight:     (s?.bold      ?? g.bold)      ? "bold"      : "normal",
    fontStyle:      (s?.italic    ?? g.italic)    ? "italic"    : "normal",
    textDecoration: (s?.underline ?? g.underline) ? "underline" : "none",
  };
}

export function ArrowBlock({
  block,
  attachments,
  gapIndex,
  selected,
  onSelect,
  onGapDirectInsert,
  onGapInsertColumnBreak,
  onAddAttachment,
  onUpdateAttachment,
  onRemoveAttachment,
  onNext,
}: Props) {
  const [paletteOpenRaw, setPaletteOpen] = useState(false);
  const [pendingKindRaw, setPendingKind] = useState<"side-in" | "side-out" | "loop" | null>(null);
  // selected が false になったときに自動的に閉じる（useEffect 不要）
  const paletteOpen = selected && paletteOpenRaw;
  const pendingKind = selected ? pendingKindRaw : null;
  const {
    blockGap,
    fontFamily, fontSize, bold, italic, underline,
  } = useDisplayStore();

  const globalFont: GlobalFontProps = { fontFamily, fontSize, bold, italic, underline };

  const sorted = [...attachments].sort((a, b) => a.order - b.order);

  // 行の合計高さ
  const rowsHeight = sorted.reduce(
    (h, a) => h + (a.kind === "loop" ? LOOP_H : ROW_H),
    0,
  ) + (pendingKind ? (pendingKind === "loop" ? LOOP_H : ROW_H) : 0);

  const stemLineH = STEM_TOP + rowsHeight + (STEM_BOTTOM - 8);

  function handlePaletteAdd(kind: "side-in" | "side-out" | "loop") {
    setPaletteOpen(false);
    setPendingKind(kind);
  }

  // 空テキストでも常に追加する（後から編集可能）
  function commitPending(text: string) {
    if (!pendingKind) return;
    onAddAttachment(pendingKind, text.trim());
    setPendingKind(null);
  }

  return (
    <div
      className="relative flex w-full flex-col items-center"
      data-arrow-id={block.id}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div
        className={[
          "relative flex w-full flex-col rounded transition-colors",
          selected ? "bg-blue-50" : "cursor-pointer hover:bg-neutral-50",
        ].join(" ")}
        style={{ minHeight: STEM_TOP + rowsHeight + STEM_BOTTOM }}
      >
        {/* 縦ステム */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: 2, height: stemLineH }}
        >
          <div className={["h-full w-full", selected ? "bg-blue-400" : "bg-gray-900"].join(" ")} />
        </div>
        {/* 矢印先端 */}
        <svg
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{ top: stemLineH }}
          width="12" height="8" viewBox="0 0 12 8"
        >
          <polygon points="0,0 12,0 6,8" fill={selected ? "#60a5fa" : "#111827"} />
        </svg>

        {/* アタッチメント行 */}
        <div className="flex w-full flex-col" style={{ paddingTop: STEM_TOP, paddingBottom: STEM_BOTTOM }}>
          {sorted.map((att) =>
            att.kind === "loop" ? (
              <LoopRow
                key={att.id}
                att={att}
                selected={selected}
                stemW={STEM_W}
                globalFont={globalFont}
                onUpdate={(t, r) => onUpdateAttachment(att.id, t, r)}
                onRemove={() => onRemoveAttachment(att.id)}
                onNext={onNext}
              />
            ) : (
              <SideRow
                key={att.id}
                att={att}
                selected={selected}
                stemW={STEM_W}
                globalFont={globalFont}
                onUpdate={(t, r) => onUpdateAttachment(att.id, t, r)}
                onRemove={() => onRemoveAttachment(att.id)}
                onNext={onNext}
              />
            )
          )}
          {pendingKind && (
            pendingKind === "loop" ? (
              <PendingLoopRow stemW={STEM_W} onCommit={commitPending} onCancel={() => setPendingKind(null)} />
            ) : (
              <PendingSideRow kind={pendingKind} stemW={STEM_W} onCommit={commitPending} onCancel={() => setPendingKind(null)} />
            )
          )}
        </div>
      </div>

      {/* ＋ 追加ボタン: 矢印ブロックの枠外（右下）に配置 */}
      {selected && (
        <div
          className="z-20 flex w-full justify-end pr-1"
          onClick={(e) => e.stopPropagation()}
        >
          {paletteOpen ? (
            <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white text-xs shadow-xl">
              <div className="border-b border-neutral-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                追加
              </div>
              <PaletteItem icon="←" label="左入力（試薬の添加など）" onClick={() => handlePaletteAdd("side-in")} />
              <PaletteItem icon="→" label="右出力（アスピレートなど）" onClick={() => handlePaletteAdd("side-out")} />
              <PaletteItem icon="↺" label="ループ / 繰り返し" onClick={() => handlePaletteAdd("loop")} />
              <button
                className="px-3 py-1.5 text-left text-neutral-400 hover:bg-neutral-50"
                onClick={() => setPaletteOpen(false)}
              >キャンセル</button>
            </div>
          ) : (
            <button
              className="rounded-full bg-blue-400 px-2.5 py-0.5 text-[11px] font-medium text-white shadow hover:bg-blue-500"
              onClick={() => setPaletteOpen(true)}
            >+ 追加</button>
          )}
        </div>
      )}

      <InsertGap index={gapIndex} onDirectInsert={onGapDirectInsert} onInsertColumnBreak={onGapInsertColumnBreak} extraH={blockGap} />
    </div>
  );
}

// ------------------------------------------------------------------
// SideRow: side-in / side-out（ステム右側）
//
//   side-in:  tipがステムに接触 → |stem|← ——— label
//   side-out: ステムから出て →   |stem| ——→ label
// ------------------------------------------------------------------
function SideRow({ att, selected, stemW, globalFont, onUpdate, onRemove, onNext }: {
  att: Attachment;
  selected: boolean;
  stemW: number;
  globalFont: GlobalFontProps;
  onUpdate: (text: string, richText?: string) => void;
  onRemove: () => void;
  onNext: () => void;
}) {
  const kind = att.kind as "side-in" | "side-out";
  const color = selected ? "#60a5fa" : "#111827";
  const editRef = useRef<HTMLDivElement>(null);
  const efStyle = makeEffectiveStyle(att, globalFont);
  const searchQuery = useSearchStore((s) => s.query);
  const rawDisplayHtml = att.richText ?? escapeHtml(att.text);
  const displayHtml = searchQuery && !selected
    ? highlightHtml(rawDisplayHtml, searchQuery, !!att.richText)
    : rawDisplayHtml;

  // 選択状態になったとき contentEditable を att の内容で初期化する
  useEffect(() => {
    if (!selected || !editRef.current) return;
    editRef.current.innerHTML = att.richText ?? escapeHtml(att.text);
  // att の変更で実行するとカーソルが飛ぶため、selected の変化時のみ初期化
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function commitEdit() {
    if (!editRef.current) return;
    const innerHTML = editRef.current.innerHTML;
    const innerText = editRef.current.innerText.trim();
    const isPlain = innerHTML === escapeHtml(innerText) || innerHTML === innerText;
    onUpdate(innerText, isPlain ? undefined : innerHTML);
  }

  const labelEl = selected ? (
    <div
      ref={editRef}
      contentEditable
      suppressContentEditableWarning
      data-attachment-id={att.id}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          commitEdit();
          onNext();
        }
        if (e.key === "Escape") { e.preventDefault(); onNext(); }
      }}
      onClick={(e) => e.stopPropagation()}
      style={{ ...efStyle, display: "inline-block", minWidth: 112 }}
      className="rounded border border-blue-200 bg-white px-1.5 py-0.5 text-neutral-700 outline-none focus:border-blue-400"
    />
  ) : (
    <span
      style={efStyle}
      className="text-neutral-700"
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  );

  const removeBtn = selected && (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      className="shrink-0 px-0.5 text-[10px] text-neutral-300 hover:text-red-400"
    >✕</button>
  );

  // paddingLeft で下矢印ステム（left:50%, width:2px）の右端より確実に右に配置する
  // calc(50% + 12px) → ステム中心から12px右 = ステム右端から11px右
  return (
    <div
      className="flex w-full items-center gap-1.5"
      style={{ height: ROW_H, paddingLeft: "calc(50% + 12px)" }}
    >
      {/* 矢印アーム（矢じりと棒を隙間なく並べる）
          side-in:  ←——— label
          side-out: ———→ label
          矢じり(7px) + 棒(16px) = 23px で両方統一 */}
      <div className="flex shrink-0 items-center">
        {kind === "side-in" && <Arrowhead dir="left" color={color} />}
        <div className="h-[1.5px] w-4" style={{ background: color }} />
        {kind === "side-out" && <Arrowhead dir="right" color={color} />}
      </div>
      {labelEl}
      {removeBtn}
    </div>
  );
}

// ------------------------------------------------------------------
// LoopRow: ↺ ステムが楕円の中心を貫く横長ループ矢印
// absolute で left:50% / translateX(-50%) → ステム中心に楕円を配置
// ------------------------------------------------------------------
const LOOP_SVG_W = 100; // 楕円の全幅(px)
const LOOP_SVG_H = 18;

function LoopRow({ att, selected, onUpdate, onRemove, onNext, globalFont }: {
  att: Attachment;
  selected: boolean;
  stemW: number;
  globalFont: GlobalFontProps;
  onUpdate: (text: string, richText?: string) => void;
  onRemove: () => void;
  onNext: () => void;
}) {
  const color = selected ? "#60a5fa" : "#111827";
  const editRef = useRef<HTMLDivElement>(null);
  const efStyle = makeEffectiveStyle(att, globalFont);
  const searchQuery = useSearchStore((s) => s.query);
  const rawDisplayHtml = att.richText ?? escapeHtml(att.text);
  const displayHtml = searchQuery && !selected
    ? highlightHtml(rawDisplayHtml, searchQuery, !!att.richText)
    : rawDisplayHtml;

  useEffect(() => {
    if (!selected || !editRef.current) return;
    editRef.current.innerHTML = att.richText ?? escapeHtml(att.text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function commitEdit() {
    if (!editRef.current) return;
    const innerHTML = editRef.current.innerHTML;
    const innerText = editRef.current.innerText.trim();
    const isPlain = innerHTML === escapeHtml(innerText) || innerHTML === innerText;
    onUpdate(innerText, isPlain ? undefined : innerHTML);
  }

  return (
    <div className="relative flex w-full overflow-visible" style={{ height: LOOP_H }}>
      {/* LoopSvg: ステム中心に絶対配置 */}
      <div
        className="pointer-events-none absolute top-0"
        style={{ left: "50%", transform: `translateX(-50%)` }}
      >
        <LoopSvg color={color} />
      </div>

      {/* ラベル + 削除ボタン: 楕円右端の少し外 */}
      <div
        className="absolute flex items-center gap-1"
        style={{ left: `calc(50% + ${LOOP_SVG_W / 2 + 6}px)`, top: 0, height: LOOP_H }}
      >
        {selected ? (
          /* 選択中: contentEditable（リッチテキスト対応）*/
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            data-attachment-id={att.id}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); onNext(); }
              if (e.key === "Escape") { e.preventDefault(); onNext(); }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ ...efStyle, display: "inline-block", minWidth: 96 }}
            className="rounded border border-blue-200 bg-white px-1.5 py-0.5 text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-blue-400 empty:before:italic empty:before:text-neutral-300 empty:before:content-['ラベル（省略可）']"
          />
        ) : att.text || att.richText ? (
          /* 非選択: テキストあり */
          <span
            style={efStyle}
            className="text-neutral-600"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        ) : null}
        {selected && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 px-0.5 text-[10px] text-neutral-300 hover:text-red-400"
          >✕</button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// 新規入力行（side-in / side-out）
// ------------------------------------------------------------------
function PendingSideRow({ kind, stemW, onCommit, onCancel }: {
  kind: "side-in" | "side-out";
  stemW: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const color = "#60a5fa";
  const placeholder = kind === "side-in" ? "例: 試薬の添加" : "例: アスピレート";

  // 空テキストでも常にコミット（後から選択状態で編集可能）
  function commit() {
    onCommit(ref.current?.value.trim() ?? "");
  }

  return (
    <div
      className="flex w-full items-center gap-1.5"
      style={{ height: ROW_H, paddingLeft: "calc(50% + 12px)" }}
    >
      {/* 矢印アーム: side-in ←———、side-out ———→ */}
      <div className="flex shrink-0 items-center">
        {kind === "side-in" && <Arrowhead dir="left" color={color} />}
        <div className="h-[1.5px] w-4" style={{ background: color }} />
        {kind === "side-out" && <Arrowhead dir="right" color={color} />}
      </div>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-32 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-blue-500"
      />
    </div>
  );
}

// ------------------------------------------------------------------
// 新規ループ追加行（即追加 or ラベル入力して追加）
// LoopRow と同じ absolute 中央配置でステム中心に楕円を乗せる
// ------------------------------------------------------------------
function PendingLoopRow({ onCommit, onCancel }: {
  stemW?: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const color = "#60a5fa";

  function commit() {
    onCommit(ref.current?.value.trim() ?? "");
  }

  return (
    <div className="relative flex w-full overflow-visible" style={{ height: LOOP_H }}>
      {/* LoopSvg: ステム中心に絶対配置 */}
      <div
        className="pointer-events-none absolute top-0"
        style={{ left: "50%", transform: "translateX(-50%)" }}
      >
        <LoopSvg color={color} />
      </div>
      {/* ラベル入力: 楕円右端の外 */}
      <div
        className="absolute flex items-center"
        style={{ left: `calc(50% + ${LOOP_SVG_W / 2 + 6}px)`, top: 0, height: LOOP_H }}
      >
        <input
          ref={ref}
          type="text"
          placeholder="ラベル（省略可）"
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-24 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// SVG: 横長楕円ループ矢印 ↺
// viewBox を x=-50..50 に対称化し、ステム（x=0）が楕円の中心を貫く
// ------------------------------------------------------------------
function LoopSvg({ color }: { color: string }) {
  return (
    <svg
      width={LOOP_SVG_W}
      height={LOOP_SVG_H}
      viewBox="-50 0 100 18"
      className="shrink-0 overflow-visible"
      style={{ display: "block" }}
    >
      {/* 上弧: 左端(-44,9) → 右端(44,9) — 中心 x=0 を通る */}
      <path
        d="M -44,9 C -22,1 22,1 44,9"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* 下弧: 右端(44,9) → 左端(-44,9) */}
      <path
        d="M 44,9 C 22,17 -22,17 -44,9"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* 時計回り矢先（右側・上弧の終端付近）*/}
      <polygon points="37,4 47,9 37,14" fill={color} />
    </svg>
  );
}

// ------------------------------------------------------------------
// 矢先 SVG（← / →）
// ------------------------------------------------------------------
function Arrowhead({ dir, color }: { dir: "left" | "right"; color: string }) {
  return (
    <svg width="7" height="10" viewBox="0 0 7 10" className="shrink-0">
      {dir === "left"
        ? <polygon points="7,1 0,5 7,9" fill={color} />
        : <polygon points="0,1 7,5 0,9" fill={color} />
      }
    </svg>
  );
}

// ------------------------------------------------------------------
// パレット行
// ------------------------------------------------------------------
function PaletteItem({ icon, label, onClick }: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <span className="w-4 shrink-0 text-center font-bold text-blue-500">{icon}</span>
      <span className="text-neutral-700">{label}</span>
    </button>
  );
}
