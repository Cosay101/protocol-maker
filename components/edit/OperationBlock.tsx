"use client";
// 操作ブロック。3状態：idle / selected / editing
//
// テキスト編集には contentEditable div を使用する。
//   - クリックした位置にカーソルが自然に配置される（ブラウザ標準動作）
//   - テキスト選択後のリボン操作でインライン書式を適用できる
//   - 改行のたびに高さが自動拡張する
//
// 上書きモード:
//   selected 状態でキーを押すと内容をクリアして即編集開始する。
//
// スタイルマージ:
//   block.style（ブロック個別）が global displayStore より優先される。
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import type { OperationBlock as OperationBlockType } from "@/types/ptcl";
import { useDisplayStore, FONT_CSS } from "@/stores/displayStore";
import { useUiStore } from "@/stores/uiStore";
import { useSearchStore } from "@/stores/searchStore";
import { highlightHtml } from "@/lib/ptcl/search";

type Props = {
  block: OperationBlockType;
  selected: boolean;
  autoEdit?: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onTextChange: (text: string, richText?: string) => void;
  onDelete: () => void;
  onInsertAfter?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
};

/** HTML エスケープ（テキストを安全に innerHTML に埋め込む） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** contentEditable div のカーソルを末尾へ移動する */
function moveCursorToEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function OperationBlock({
  block,
  selected,
  autoEdit = false,
  isDragging = false,
  onSelect,
  onTextChange,
  onDelete,
  onInsertAfter,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const [editing, setEditing] = useState(autoEdit);
  const editRef = useRef<HTMLDivElement>(null);

  // クリック位置を保存して編集開始時にカーソル復元
  const savedClickPos = useRef<{ x: number; y: number } | null>(null);
  // 上書きモード用: 最初の1文字
  const overwriteCharRef = useRef<string | null>(null);
  // contentEditable を初期化済みか（React の再描画との衝突を防ぐ）
  const initializedRef = useRef(false);
  // 上書きモードで innerHTML をセット済みか（IME の composition 開始時にクリアするため）
  const overwriteWasSetRef = useRef(false);

  // 編集状態を uiStore に通知（リボンの B/I/U 無効化に使う）
  const setEditingBlockId = useUiStore((s) => s.setEditingBlockId);

  // 検索ハイライト
  const searchQuery = useSearchStore((s) => s.query);

  // グローバル設定を読み込み、ブロック個別スタイルで上書きする
  const global = useDisplayStore();
  const bs = block.style;
  const effectiveFontFamily = bs?.fontFamily ?? global.fontFamily;
  const effectiveFontSize   = bs?.fontSize   ?? global.fontSize;
  const effectiveBold       = bs?.bold       ?? global.bold;
  const effectiveItalic     = bs?.italic     ?? global.italic;
  const effectiveUnderline  = bs?.underline  ?? global.underline;
  const effectiveTextAlign  = bs?.textAlign  ?? global.textAlign ?? "center";

  const fontStyle: React.CSSProperties = {
    fontFamily:     FONT_CSS[effectiveFontFamily],
    fontSize:       `${effectiveFontSize}px`,
    fontWeight:     effectiveBold ? "bold" : "normal",
    fontStyle:      effectiveItalic ? "italic" : "normal",
    textDecoration: effectiveUnderline ? "underline" : "none",
    textAlign:      effectiveTextAlign,
  };

  // 編集状態を uiStore に同期
  useEffect(() => {
    if (editing) {
      setEditingBlockId(block.id);
    } else {
      setEditingBlockId(null);
    }
    return () => setEditingBlockId(null);
  }, [editing, block.id, setEditingBlockId]);

  // beforeinput をネイティブリスナーで直接ブロック
  // React の onBeforeInput はルート委譲のため、DOM 挿入が先に起きてから
  // preventDefault が呼ばれる（手遅れ）。element に直接アタッチすることで解決する。
  useEffect(() => {
    if (!editing || !editRef.current) return;
    const div = editRef.current;
    const handler = (e: InputEvent) => {
      if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
        e.preventDefault();
      }
    };
    div.addEventListener("beforeinput", handler);
    return () => div.removeEventListener("beforeinput", handler);
  }, [editing]);

  // 編集開始時: contentEditable を初期化してフォーカスを当てる
  // useLayoutEffect を使うことで「React が DOM を更新した直後・ブラウザ描画前」に
  // innerHTML をセットし、ブラウザがまだ空の div にイベントを送れる隙間を無くす。
  useLayoutEffect(() => {
    if (!editing || !editRef.current) return;
    const div = editRef.current;

    const overwrite = overwriteCharRef.current;
    if (overwrite !== null) {
      // 上書きモード: 最初の1文字だけセット
      div.innerHTML = escapeHtml(overwrite);
      overwriteCharRef.current = null;
      initializedRef.current = true;
      overwriteWasSetRef.current = true;
      moveCursorToEnd(div);
    } else {
      // 通常の編集開始: 既存コンテンツを設定
      div.innerHTML = block.richText ?? escapeHtml(block.text);
      initializedRef.current = true;
      overwriteWasSetRef.current = false;
      div.focus();

      // クリック位置にカーソルを置く
      const pos = savedClickPos.current;
      savedClickPos.current = null;
      if (pos !== null) {
        const range =
          // Chrome/Tauri
          (document.caretRangeFromPoint?.(pos.x, pos.y)) ??
          // Firefox
          (() => {
            const posFromPoint = (document as Document & {
              caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
            }).caretPositionFromPoint?.(pos.x, pos.y);
            if (!posFromPoint) return null;
            const r = document.createRange();
            r.setStart(posFromPoint.offsetNode, posFromPoint.offset);
            r.collapse(true);
            return r;
          })();
        if (range) {
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          return;
        }
      }
      moveCursorToEnd(div);
    }
  // block.text/richText を依存に入れると編集中に上書きされるため意図的に除外
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commitEdit = useCallback(() => {
    if (!editRef.current) return;
    if (!initializedRef.current) return; // 二重コミット防止

    const div = editRef.current;

    // beforeinput が先行して挿入した末尾の <br> / 空 <div> を除去する
    // (Tauri WebView2 では insertParagraph が keydown より先に DOM を書き換える)
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

    // 純粋なプレーンテキストかどうか判定（<br> のみはプレーン扱い）
    const plainEquiv = escapeHtml(innerText.replace(/\n/g, ""));
    const isPlain = innerHTML === escapeHtml(innerText) || innerHTML === plainEquiv;

    initializedRef.current = false;
    overwriteWasSetRef.current = false;
    setEditing(false);
    onTextChange(innerText, isPlain ? undefined : innerHTML);
  }, [onTextChange]);

  /**
   * リボン（data-ribbon 属性のある要素）にフォーカスが移った場合はコミットしない。
   * requestAnimationFrame でフォーカス先が確定してから判定する。
   */
  function handleEditBlur() {
    requestAnimationFrame(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest("[data-ribbon]")) {
        // フォーカスがリボン上にある → コミットせず編集継続
        return;
      }
      commitEdit();
    });
  }

  // ---- 表示モードのクリック ----
  function handleViewClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (selected) {
      // 選択済みブロックをクリック → クリック位置からそのまま編集開始
      savedClickPos.current = { x: e.clientX, y: e.clientY };
      setEditing(true);
    } else {
      onSelect();
    }
  }

  function handleViewDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    savedClickPos.current = { x: e.clientX, y: e.clientY };
    if (!selected) onSelect();
    setEditing(true);
  }

  // ---- 表示モードのキーボード操作 ----
  function handleViewKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (!selected) return;

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      savedClickPos.current = null;
      setEditing(true);
      return;
    }
    // 印字可能文字 → 上書き（既存テキストを消して新規入力）
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      overwriteCharRef.current = e.key;
      setEditing(true);
    }
  }

  // ---- 編集モードのキーボード操作 ----
  function handleEditKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();

    // IME 変換中は Escape / Enter / Del を通常の編集操作として扱う
    // (isComposing=true のとき: Escape=変換キャンセル, Enter=変換確定)
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Escape") {
      // 変更を破棄
      if (editRef.current) {
        editRef.current.innerHTML = block.richText ?? escapeHtml(block.text);
      }
      initializedRef.current = false;
      setEditing(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      onInsertAfter?.();
      return;
    }
    // 空欄で Del / Backspace → ブロック削除
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      editRef.current?.innerText.trim() === ""
    ) {
      e.preventDefault();
      onDelete();
    }
  }

  // ---- ドラッグは編集中に無効化 ----
  const dragProps = editing
    ? {}
    : { draggable: true, onDragStart, onDragEnd, onDragOver, onDrop };

  // 表示用 HTML（テキストが空ならプレースホルダー）
  const rawDisplayHtml = block.richText ?? escapeHtml(block.text);
  const displayHtml = searchQuery && !editing
    ? highlightHtml(rawDisplayHtml, searchQuery, !!block.richText)
    : rawDisplayHtml;
  const isEmpty = !block.text && !block.richText;

  return (
    <div
      className={[
        "group flex select-none items-start rounded-md py-1",
        "transition-[background,opacity]",
        "cursor-pointer hover:bg-neutral-50",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
      style={{
        // テキストが短い時: 列幅いっぱい（min-width: 100%）
        // テキストが長い時: テキスト幅に追従（width: max-content）
        minWidth: "100%",
        width: "max-content",
      }}
      data-conn-block={block.id}
      {...dragProps}
    >
      {/* ドラッグハンドル */}
      <div
        data-no-print
        className={[
          "mt-2 shrink-0 px-1.5 text-sm transition-colors",
          editing
            ? "cursor-default text-neutral-200"
            : "cursor-grab text-neutral-200 group-hover:text-neutral-400 active:cursor-grabbing",
        ].join(" ")}
        aria-hidden
        onClick={(e) => {
          e.stopPropagation();
          if (!selected && !editing) onSelect();
        }}
      >
        ⠿
      </div>

      {editing ? (
        /* ---- 編集モード: contentEditable div ---- */
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleEditBlur}
          onCompositionStart={() => {
            // 上書きモードで innerHTML に1文字セット済みの状態で IME が起動すると
            // ブラウザがその文字に加えて IME の入力も挿入し二重になる。
            // composition 開始時点で innerHTML をクリアして IME に白紙から書かせる。
            if (overwriteWasSetRef.current && editRef.current) {
              editRef.current.innerHTML = "";
              overwriteWasSetRef.current = false;
            }
          }}
          onKeyDown={handleEditKeyDown}
          data-placeholder="ステップを入力…"
          style={{
            ...fontStyle,
            minHeight: "1.5em",
            whiteSpace: "nowrap",
          }}
          className={[
            "flex-1 cursor-text py-2 leading-snug outline-none",
            "border-b-2 border-blue-400 text-neutral-800",
            "empty:before:text-neutral-300 empty:before:italic",
            "empty:before:content-[attr(data-placeholder)]",
          ].join(" ")}
        />
      ) : (
        /* ---- 表示モード: クリック可能な div ---- */
        <div
          tabIndex={0}
          onClick={handleViewClick}
          onDoubleClick={handleViewDoubleClick}
          onKeyDown={handleViewKeyDown}
          style={{
            ...fontStyle,
            userSelect: "none",
            WebkitUserSelect: "none",
            whiteSpace: "nowrap",
          }}
          className={[
            "flex-1 cursor-pointer py-2 leading-snug outline-none",
            isEmpty ? "italic text-neutral-300" : "text-neutral-800",
          ].join(" ")}
          dangerouslySetInnerHTML={{
            __html: isEmpty ? "（空のステップ）" : displayHtml,
          }}
        />
      )}

      {/* × 削除ボタン */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={[
          "mt-2 shrink-0 px-1.5 text-xs text-neutral-300 transition-[opacity,color] hover:text-red-400",
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
