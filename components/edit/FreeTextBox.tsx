"use client";
// 自由配置テキストボックス（パワポライク）
//   - クリック            → 選択
//   - ダブルクリック      → テキスト編集（contentEditable）
//   - ボーダードラッグ    → 移動
//   - 角/辺のハンドル     → リサイズ
//   - Del (選択中)        → 削除
//   - Escape (編集中)     → 編集終了
//   - 編集中にテキスト選択 → ミニフォーマットツールバー表示
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import type { TextFreeElement } from "@/types/ptcl";
import { FONT_CSS, FONT_SIZES, type FontFamily } from "@/stores/displayStore";
import { useSearchStore } from "@/stores/searchStore";
import { highlightHtml } from "@/lib/ptcl/search";

type Patch = Partial<Omit<TextFreeElement, "id" | "type">>;

type Props = {
  el: TextFreeElement;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Patch) => void;
  onDelete: () => void;
};

// 8 方向のリサイズハンドル
const HANDLES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
type HandleDir = (typeof HANDLES)[number];

const HANDLE_STYLE: Record<HandleDir, React.CSSProperties> = {
  n:  { top: -4, left: "50%", transform: "translateX(-50%)", cursor: "n-resize"  },
  ne: { top: -4, right: -4,                                   cursor: "ne-resize" },
  e:  { top: "50%", right: -4, transform: "translateY(-50%)", cursor: "e-resize"  },
  se: { bottom: -4, right: -4,                                 cursor: "se-resize" },
  s:  { bottom: -4, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" },
  sw: { bottom: -4, left: -4,                                   cursor: "sw-resize" },
  w:  { top: "50%", left: -4,  transform: "translateY(-50%)", cursor: "w-resize"  },
  nw: { top: -4, left: -4,                                     cursor: "nw-resize" },
};

export function FreeTextBox({ el, selected, onSelect, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);

  // ブロックレベルのフォントスタイル（リボンから設定・インライン書式で上書き可能）
  const blockStyle: React.CSSProperties = {
    fontFamily:     el.fontFamily ? FONT_CSS[el.fontFamily] : undefined,
    fontSize:       el.fontSize   ? `${el.fontSize}px`      : undefined,
    fontWeight:     el.bold       ? "bold"                   : undefined,
    fontStyle:      el.italic     ? "italic"                 : undefined,
    textDecoration: el.underline  ? "underline"              : undefined,
  };
  const [hasSelection, setHasSelection] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedRangesRef = useRef<Range[]>([]);

  // 編集開始時にフォーカスしてカーソルを末尾へ
  // useLayoutEffect: React DOM 更新直後・ブラウザ描画前に innerHTML をセットし
  // 空の div にイベントが来る隙間をなくす。
  useLayoutEffect(() => {
    if (!editing || !editRef.current) return;
    const div = editRef.current;
    div.innerHTML = el.text || "";
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  // el.text を依存に入れると編集中に上書きされるため除外
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // beforeinput をネイティブリスナーで直接ブロック（insertParagraph = Enter のみ）
  // Shift+Enter (insertLineBreak) は改行として許可する。
  useEffect(() => {
    if (!editing || !editRef.current) return;
    const div = editRef.current;
    const handler = (e: InputEvent) => {
      if (e.inputType === "insertParagraph") {
        e.preventDefault();
      }
    };
    div.addEventListener("beforeinput", handler);
    return () => div.removeEventListener("beforeinput", handler);
  }, [editing]);

  // 編集中: テキスト選択の監視 → ミニツールバー表示制御
  useEffect(() => {
    if (!editing) {
      setHasSelection(false);
      savedRangesRef.current = [];
      return;
    }

    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !editRef.current?.contains(sel.anchorNode)) {
        setHasSelection(false);
        return;
      }
      // 選択あり → ranges を保存
      setHasSelection(true);
      const ranges: Range[] = [];
      for (let i = 0; i < sel.rangeCount; i++) {
        ranges.push(sel.getRangeAt(i).cloneRange());
      }
      savedRangesRef.current = ranges;
    }

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [editing]);

  // ---- 選択を contenteditable に復元 ----
  function restoreSelection() {
    const el = editRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    savedRangesRef.current.forEach((r) => {
      try { sel.addRange(r); } catch { /* ignore stale range */ }
    });
  }

  // ---- インラインスタイル適用（選択範囲をスパンでラップ） ----
  function applyInlineStyle(prop: string, val: string) {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0).cloneRange();
    // コンテンツを抽出してスパンに包む
    const fragment = range.extractContents();
    const span = document.createElement("span");
    span.style.setProperty(prop, val);
    span.appendChild(fragment);
    range.insertNode(span);
    // スパン内を再選択（連続適用のため）
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
    savedRangesRef.current = [newRange.cloneRange()];
  }

  function commitEdit() {
    if (!editRef.current) return;
    const div = editRef.current;

    // beforeinput が先行して挿入した末尾の <br> / 空 <div> を除去する
    while (div.lastChild) {
      const last = div.lastChild;
      if (last.nodeType === Node.ELEMENT_NODE) {
        const el = last as HTMLElement;
        if (el.tagName === "BR" || (el.tagName === "DIV" && el.innerHTML === "<br>")) {
          div.removeChild(last);
          continue;
        }
      }
      break;
    }

    const innerHTML = div.innerHTML;
    const innerText = div.innerText.trim();
    const isPlain = innerHTML === innerText || innerHTML === innerText.replace(/\n/g, "<br>");
    setEditing(false);
    onUpdate({ text: isPlain ? innerText : innerHTML });
  }

  // blur ガード: ツールバーまたはリボンへのフォーカス移動では commitEdit しない
  function handleEditBlur() {
    requestAnimationFrame(() => {
      const active = document.activeElement as HTMLElement | null;
      if (toolbarRef.current?.contains(active)) return;
      if (active?.closest("[data-ribbon]")) return;
      commitEdit();
    });
  }

  // ---- 移動ドラッグ ----
  const handleMoveMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editing) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect();

      const startX = e.clientX;
      const startY = e.clientY;
      const baseX  = el.x;
      const baseY  = el.y;

      function onMouseMove(ev: MouseEvent) {
        onUpdate({ x: baseX + ev.clientX - startX, y: baseY + ev.clientY - startY });
      }
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup",   onMouseUp);
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
    },
    [editing, el.x, el.y, onSelect, onUpdate],
  );

  // ---- リサイズドラッグ ----
  function handleResizeMouseDown(e: React.MouseEvent, dir: HandleDir) {
    e.stopPropagation();
    e.preventDefault();

    const startX  = e.clientX;
    const startY  = e.clientY;
    const baseX   = el.x;
    const baseY   = el.y;
    const baseW   = el.w;
    const baseH   = el.h;

    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let x = baseX, y = baseY, w = baseW, h = baseH;

      if (dir.includes("e")) w = Math.max(80, baseW + dx);
      if (dir.includes("s")) h = Math.max(30, baseH + dy);
      if (dir.includes("w")) { w = Math.max(80, baseW - dx); x = baseX + baseW - w; }
      if (dir.includes("n")) { h = Math.max(30, baseH - dy); y = baseY + baseH - h; }

      onUpdate({ x, y, w, h });
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
  }

  // ---- キーボード（表示モード） ----
  function handleKeyDown(e: React.KeyboardEvent) {
    if (editing) return;
    e.stopPropagation();
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onDelete(); }
    if (e.key === "Enter") { e.preventDefault(); setEditing(true); }
  }

  const isEmpty = !el.text;
  const searchQuery = useSearchStore((s) => s.query);
  const displayHtml = searchQuery && !editing
    ? highlightHtml(el.text || "", searchQuery, true)
    : (el.text || "");

  return (
    <div
      tabIndex={0}
      style={{
        position: "absolute",
        left: el.x,
        top:  el.y,
        width: el.w,
        minHeight: el.h,
        outline: "none",
        userSelect: editing ? "auto" : "none",
      }}
      onClick={(e)       => { e.stopPropagation(); if (!editing) onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onSelect(); setEditing(true); }}
      onKeyDown={handleKeyDown}
    >
      {/* ---- ミニフォーマットツールバー（編集中 & テキスト選択時） ---- */}
      {editing && hasSelection && (
        <div
          ref={toolbarRef}
          style={{ position: "absolute", top: -42, left: 0, zIndex: 200 }}
          className="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 shadow-lg"
        >
          {/* B / I / U: onMouseDown で preventDefault → selection を保持 */}
          <FormatBtn
            label="B"
            className="font-bold"
            onMouseDown={() => applyInlineStyle("font-weight", "bold")}
          />
          <FormatBtn
            label="I"
            className="italic"
            onMouseDown={() => applyInlineStyle("font-style", "italic")}
          />
          <FormatBtn
            label="U"
            className="underline"
            onMouseDown={() => applyInlineStyle("text-decoration", "underline")}
          />

          <div className="mx-1 h-4 w-px bg-neutral-200" />

          {/* フォントファミリー */}
          <select
            tabIndex={-1}
            onChange={(e) => {
              applyInlineStyle("font-family", FONT_CSS[e.target.value as FontFamily]);
              e.target.value = "";
            }}
            defaultValue=""
            className="h-6 rounded border border-neutral-200 bg-white px-1 text-[10px] text-neutral-700 outline-none focus:border-blue-400"
          >
            <option value="" disabled>フォント</option>
            {(Object.keys(FONT_CSS) as FontFamily[]).map((f) => (
              <option key={f} value={f}>
                {f === "gothic" ? "ゴシック" : "明朝"}
              </option>
            ))}
          </select>

          {/* フォントサイズ */}
          <select
            tabIndex={-1}
            onChange={(e) => {
              applyInlineStyle("font-size", `${e.target.value}pt`);
              e.target.value = "";
            }}
            defaultValue=""
            className="h-6 w-14 rounded border border-neutral-200 bg-white px-1 text-[10px] text-neutral-700 outline-none focus:border-blue-400"
          >
            <option value="" disabled>サイズ</option>
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {/* ---- メインボックス ---- */}
      <div
        onMouseDown={handleMoveMouseDown}
        style={{
          width:   "100%",
          minHeight: el.h,
          boxSizing: "border-box",
          border:  selected
            ? "1.5px solid #60a5fa"
            : el.frame
            ? "1px solid #d1d5db"
            : "1.5px dashed transparent",
          borderRadius: 2,
          backgroundColor: el.frame ? "rgba(255,255,255,0.95)" : "transparent",
          padding:  "6px 10px",
          cursor:   editing ? "text" : selected ? "move" : "default",
        }}
      >
        {editing ? (
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleEditBlur}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Escape") { setEditing(false); }
              // Shift+Enter → 改行、Enter のみ → 編集終了
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-h-[1em] leading-snug text-neutral-800 outline-none"
            style={{ ...blockStyle, wordBreak: "break-all", whiteSpace: "pre-wrap", textAlign: el.textAlign ?? "center" }}
          />
        ) : (
          <div
            className="min-h-[1em] leading-snug"
            style={{ ...blockStyle, wordBreak: "break-all", whiteSpace: "pre-wrap", textAlign: el.textAlign ?? "center" }}
          >
            {isEmpty ? (
              <span className="italic text-neutral-300">テキストを入力…</span>
            ) : (
              <span
                className="text-neutral-800"
                dangerouslySetInnerHTML={{ __html: displayHtml }}
              />
            )}
          </div>
        )}
      </div>

      {/* ---- リサイズハンドル ---- */}
      {selected && !editing && HANDLES.map((dir) => (
        <div
          key={dir}
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            backgroundColor: "#60a5fa",
            border: "1.5px solid white",
            borderRadius: 2,
            ...HANDLE_STYLE[dir],
          }}
          onMouseDown={(e) => handleResizeMouseDown(e, dir)}
        />
      ))}

      {/* ---- 削除ボタン ---- */}
      {selected && !editing && (
        <button
          type="button"
          style={{ position: "absolute", top: -10, right: -10 }}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-400 text-[10px] text-white hover:bg-red-400"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          tabIndex={-1}
          aria-label="削除"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ---- ミニツールバーボタン ----
function FormatBtn({
  label,
  className = "",
  onMouseDown,
}: {
  label: string;
  className?: string;
  onMouseDown: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault(); // フォーカスを contenteditable から奪わない
        onMouseDown();
      }}
      className={[
        "flex h-6 w-6 items-center justify-center rounded text-[11px] text-neutral-700",
        "hover:bg-neutral-100 active:bg-neutral-200",
        className,
      ].join(" ")}
    >
      {label}
    </button>
  );
}
