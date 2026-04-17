"use client";
// 操作ブロック。3状態：idle / selected / editing
// - idle: 普通の表示
// - selected: 青枠（クリックで選択）
// - editing: インライン textarea（ダブルクリックで入る）
import { useEffect, useRef, useState } from "react";
import type { OperationBlock as OperationBlockType } from "@/types/ptcl";

type Props = {
  block: OperationBlockType;
  selected: boolean;
  onSelect: () => void;
  onTextChange: (text: string) => void;
  onDelete: () => void;
};

export function OperationBlock({
  block,
  selected,
  onSelect,
  onTextChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 外から text が変わったとき（undo等）draft も追従
  useEffect(() => {
    if (!editing) setDraft(block.text);
  }, [block.text, editing]);

  // 編集モードに入ったらフォーカス
  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  function commitEdit() {
    setEditing(false);
    const trimmed = draft.trim();
    // 空文字でも保存はするが、警告等は将来対応
    onTextChange(trimmed || block.text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      // 編集キャンセル
      setDraft(block.text);
      setEditing(false);
    }
    // Enter（Shift+Enter で改行）は textarea の既定動作に任せる
    e.stopPropagation(); // 親の Delete ハンドラに届かないようにする
  }

  if (editing) {
    return (
      <div className="mx-auto w-[280px]">
        <textarea
          ref={textareaRef}
          value={draft}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full resize-none rounded border-2 border-blue-400 bg-white px-3 py-2 text-sm text-neutral-800 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={() => {
        onSelect();
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSelect();
          setEditing(true);
        }
      }}
      className={[
        "mx-auto w-[280px] cursor-pointer select-none rounded border px-4 py-3 text-sm",
        "transition-[border-color,box-shadow]",
        selected
          ? "border-blue-400 shadow-[0_0_0_2px_rgb(96_165_250/0.4)]"
          : "border-neutral-300 bg-white hover:border-neutral-400",
        block.text === "" ? "text-neutral-300 italic" : "text-neutral-800",
      ].join(" ")}
    >
      {block.text || "（空のステップ）"}
    </div>
  );
}
