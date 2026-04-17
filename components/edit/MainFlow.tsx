"use client";
// 主フロー全体のレンダラ。blocks を上から下へ順に描画する。
// ギャップは OperationBlock の上（先頭）、ArrowBlock の下に配置する。
import type { EditorCaret, MainFlow as MainFlowType } from "@/types/ptcl";
import { InsertGap } from "./InsertGap";
import { OperationBlock } from "./OperationBlock";
import { ArrowBlock } from "./ArrowBlock";

type Props = {
  mainFlow: MainFlowType;
  caret: EditorCaret;
  onGapClick: (beforeBlockIndex: number) => void;
  onBlockSelect: (blockId: string) => void;
  onOperationTextChange: (blockId: string, text: string) => void;
  onOperationDelete: (blockId: string) => void;
};

export function MainFlow({
  mainFlow,
  caret,
  onGapClick,
  onBlockSelect,
  onOperationTextChange,
  onOperationDelete,
}: Props) {
  const { blocks, attachments } = mainFlow;

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center py-2">
        {/* 空フロー時の先頭ギャップ（大きめ表示） */}
        <button
          type="button"
          onClick={() => onGapClick(0)}
          className="mt-4 rounded border border-dashed border-neutral-300 px-6 py-3 text-xs text-neutral-400 hover:border-blue-300 hover:text-blue-400"
        >
          + 最初のステップを追加
        </button>
      </div>
    );
  }

  const elements: React.ReactNode[] = [];

  // 先頭ギャップ（blocks[0] の上）
  elements.push(
    <InsertGap
      key="gap-top"
      index={0}
      active={caret.kind === "gap" && caret.beforeBlockIndex === 0}
      onClick={() => onGapClick(0)}
    />,
  );

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "operation") {
      elements.push(
        <OperationBlock
          key={block.id}
          block={block}
          selected={caret.kind === "block" && caret.blockId === block.id}
          onSelect={() => onBlockSelect(block.id)}
          onTextChange={(text) => onOperationTextChange(block.id, text)}
          onDelete={() => onOperationDelete(block.id)}
        />,
      );
    } else if (block.type === "arrow") {
      const arrowAttachments = attachments.filter(
        (a) => a.anchorId === block.id,
      );
      const gapIndex = i + 1; // この arrow の下のギャップ位置
      elements.push(
        <ArrowBlock
          key={block.id}
          block={block}
          attachments={arrowAttachments}
          gapIndex={gapIndex}
          gapActive={caret.kind === "gap" && caret.beforeBlockIndex === gapIndex}
          onGapClick={() => onGapClick(gapIndex)}
        />,
      );
    }
  }

  // 末尾ギャップ（最後の operation の下）
  const tailIndex = blocks.length;
  elements.push(
    <InsertGap
      key="gap-tail"
      index={tailIndex}
      active={caret.kind === "gap" && caret.beforeBlockIndex === tailIndex}
      onClick={() => onGapClick(tailIndex)}
    />,
  );

  return (
    <div className="flex w-full flex-col items-stretch py-2">{elements}</div>
  );
}
