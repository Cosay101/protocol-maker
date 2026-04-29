"use client";
// 主フロー全体のレンダラ。blocks を上から下へ順に描画する。
import { useState } from "react";
import type { EditorCaret, MainFlow as MainFlowType } from "@/types/ptcl";
import { useDisplayStore } from "@/stores/displayStore";
import { InsertGap } from "./InsertGap";
import { OperationBlock } from "./OperationBlock";
import { ArrowBlock } from "./ArrowBlock";
import { SpacerBlock } from "./SpacerBlock";
import { ColumnBreakBlock } from "./ColumnBreakBlock";

type Props = {
  mainFlow: MainFlowType;
  /** 表示する blocks のスライス開始インデックス（省略時 = 0） */
  sliceStart?: number;
  /** 表示する blocks のスライス終了インデックス（exclusive、省略時 = blocks.length） */
  sliceEnd?: number;
  caret: EditorCaret;
  autoEditId?: string | null;
  colW: number; // 列幅（スペーサーブロックに渡す）
  /** beforeBlockIndex はグローバルインデックス */
  onDirectInsert: (beforeBlockIndex: number) => void;
  onMoveBlock: (blockId: string, beforeBlockIndex: number) => void;
  onBlockSelect: (blockId: string) => void;
  onOperationTextChange: (blockId: string, text: string, richText?: string) => void;
  onOperationDelete: (blockId: string) => void;
  /** opBlockIndex はグローバルインデックス */
  onSelectArrowAfterOp: (opBlockIndex: number) => void;
  /** arrowBlockIndex はグローバルインデックス */
  onArrowNext: (arrowBlockIndex: number) => void;
  onAddAttachment: (anchorId: string, kind: "side-in" | "side-out" | "loop", text: string) => void;
  onUpdateAttachment: (id: string, text: string, richText?: string) => void;
  onRemoveAttachment: (id: string) => void;
  onInsertSpacer: (beforeBlockIndex: number) => void;
  onUpdateSpacerHeight: (blockId: string, h: number) => void;
  onDeleteSpacer: (blockId: string) => void;
  /** 改列マーカーを挿入する（省略時は InsertGap メニューに表示しない） */
  onInsertColumnBreak?: (beforeBlockIndex: number) => void;
  /** 改列マーカーを削除する */
  onDeleteColumnBreak?: (blockId: string) => void;
  /** 分岐モード時に矢印クリックで分岐を作成する（省略時は通常選択） */
  onArrowBranchCreate?: (arrowId: string) => void;
};

export function MainFlow({
  mainFlow,
  sliceStart,
  sliceEnd,
  caret,
  autoEditId,
  colW,
  onDirectInsert,
  onMoveBlock,
  onBlockSelect,
  onOperationTextChange,
  onOperationDelete,
  onSelectArrowAfterOp,
  onArrowNext,
  onAddAttachment,
  onUpdateAttachment,
  onRemoveAttachment,
  onInsertSpacer,
  onUpdateSpacerHeight,
  onDeleteSpacer,
  onInsertColumnBreak,
  onDeleteColumnBreak,
  onArrowBranchCreate,
}: Props) {
  const { attachments } = mainFlow;
  // スライスとオフセットを計算
  const blockOffset = sliceStart ?? 0;
  const blocks = mainFlow.blocks.slice(blockOffset, sliceEnd ?? mainFlow.blocks.length);

  // ブロック間の余白
  const { blockGap } = useDisplayStore();

  // ドラッグ状態
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  if (blocks.length === 0 && blockOffset === 0) {
    // 先頭列かつ空のとき = 初期状態
    return (
      <div className="flex flex-col items-center py-2">
        <button
          type="button"
          onClick={() => onDirectInsert(0)}
          className="mt-4 rounded border border-dashed border-neutral-300 px-6 py-3 text-xs text-neutral-400 hover:border-blue-300 hover:text-blue-400"
        >
          + 最初のステップを追加
        </button>
      </div>
    );
  }

  const elements: React.ReactNode[] = [];

  // 先頭ドロップゾーン
  elements.push(
    <DropZone
      key="drop-0"
      index={0}
      active={dragId !== null && dropTargetIndex === 0}
      onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(0); }}
      onDrop={() => {
        if (dragId) { onMoveBlock(dragId, blockOffset); }
        setDragId(null); setDropTargetIndex(null);
      }}
    />,
  );

  // 先頭ギャップ（dragId がないときのみ表示）
  if (!dragId) {
    elements.push(
      <InsertGap
        key="gap-top"
        index={blockOffset}
        onDirectInsert={() => onDirectInsert(blockOffset)}
        onInsertSpacer={() => onInsertSpacer(blockOffset)}
        onInsertColumnBreak={onInsertColumnBreak ? () => onInsertColumnBreak(blockOffset) : undefined}
        extraH={blockGap}
      />,
    );
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const globalI = blockOffset + i; // グローバルインデックス

    if (block.type === "operation") {
      elements.push(
        <OperationBlock
          key={block.id}
          block={block}
          selected={caret.kind === "block" && caret.blockId === block.id}
          autoEdit={autoEditId === block.id}
          isDragging={dragId === block.id}
          onSelect={() => onBlockSelect(block.id)}
          onTextChange={(text, richText) => onOperationTextChange(block.id, text, richText)}
          onDelete={() => onOperationDelete(block.id)}
          onInsertAfter={() => onSelectArrowAfterOp(globalI)}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDragId(block.id);
          }}
          onDragEnd={() => { setDragId(null); setDropTargetIndex(null); }}
          onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(i); }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && dragId !== block.id) onMoveBlock(dragId, globalI);
            setDragId(null); setDropTargetIndex(null);
          }}
        />,
      );
    } else if (block.type === "spacer") {
      elements.push(
        <SpacerBlock
          key={block.id}
          h={block.h}
          colW={colW}
          onUpdateHeight={(newH) => onUpdateSpacerHeight(block.id, newH)}
          onDelete={() => onDeleteSpacer(block.id)}
        />,
      );
      // スペーサーの後にも InsertGap を表示（ドラッグ中は非表示）
      if (!dragId) {
        elements.push(
          <InsertGap
            key={`gap-spacer-${block.id}`}
            index={globalI + 1}
            onDirectInsert={() => onDirectInsert(globalI + 1)}
            onInsertSpacer={() => onInsertSpacer(globalI + 1)}
            onInsertColumnBreak={onInsertColumnBreak ? () => onInsertColumnBreak(globalI + 1) : undefined}
            extraH={blockGap}
          />,
        );
      }
    } else if (block.type === "arrow") {
      const arrowAttachments = attachments.filter((a) => a.anchorId === block.id);
      const gapLocalIndex = i + 1;
      const gapGlobalIndex = blockOffset + gapLocalIndex;
      elements.push(
        <ArrowBlock
          key={block.id}
          block={block}
          attachments={arrowAttachments}
          gapIndex={gapGlobalIndex}
          gapActive={false}
          selected={caret.kind === "block" && caret.blockId === block.id}
          onSelect={() => {
            if (onArrowBranchCreate) {
              onArrowBranchCreate(block.id);
            } else {
              onBlockSelect(block.id);
            }
          }}
          onGapDirectInsert={() => onDirectInsert(gapGlobalIndex)}
          onGapInsertColumnBreak={onInsertColumnBreak ? () => onInsertColumnBreak(gapGlobalIndex) : undefined}
          onAddAttachment={(kind, text) => onAddAttachment(block.id, kind, text)}
          onUpdateAttachment={onUpdateAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onNext={() => onArrowNext(globalI)}
        />,
      );
    } else if (block.type === "columnBreak") {
      elements.push(
        <ColumnBreakBlock
          key={block.id}
          onDelete={() => onDeleteColumnBreak?.(block.id)}
        />,
      );
    }
    // branch ブロックは UI 廃止済み（スキーマ・ストアは後方互換のために残す）

    // op の後ろにドロップゾーン挿入
    if (block.type === "operation" && dragId) {
      const di = i + 1;
      elements.push(
        <DropZone
          key={`drop-${di}`}
          index={di}
          active={dropTargetIndex === di}
          onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(di); }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) onMoveBlock(dragId, blockOffset + di);
            setDragId(null); setDropTargetIndex(null);
          }}
        />,
      );
    }

    // 通常の InsertGap（drag 中は非表示）
    if (block.type === "operation" && !dragId) {
      elements.push(
        <InsertGap
          key={`gap-${globalI}`}
          index={globalI + 1}
          onDirectInsert={() => onDirectInsert(globalI + 1)}
          onInsertSpacer={() => onInsertSpacer(globalI + 1)}
          onInsertColumnBreak={onInsertColumnBreak ? () => onInsertColumnBreak(globalI + 1) : undefined}
          extraH={blockGap}
        />,
      );
    }
  }

  // 末尾 InsertGap: 最後のブロックが arrow の場合は ArrowBlock が内部で持つので不要
  if (!dragId) {
    const lastBlock = blocks[blocks.length - 1];
    if (!lastBlock || lastBlock.type !== "arrow") {
      const tailGlobalIndex = blockOffset + blocks.length;
      elements.push(
        <InsertGap
          key="gap-tail"
          index={tailGlobalIndex}
          onDirectInsert={() => onDirectInsert(tailGlobalIndex)}
          onInsertSpacer={() => onInsertSpacer(tailGlobalIndex)}
          onInsertColumnBreak={onInsertColumnBreak ? () => onInsertColumnBreak(tailGlobalIndex) : undefined}
          extraH={blockGap}
        />,
      );
    }
  }

  return (
    <div
      className="flex w-full flex-col items-stretch py-2"
      onDragLeave={(e) => {
        // コンテナ外に出たらクリア
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropTargetIndex(null);
        }
      }}
    >
      {elements}
    </div>
  );
}

// ドラッグ中に表示されるドロップゾーンライン
function DropZone({
  index,
  active,
  onDragOver,
  onDrop,
}: {
  index: number;
  active: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className="flex h-8 w-full items-center px-4"
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-drop-index={index}
    >
      <div
        className={[
          "h-0.5 w-full rounded-full transition-colors",
          active ? "bg-blue-400" : "bg-transparent",
        ].join(" ")}
      />
    </div>
  );
}
