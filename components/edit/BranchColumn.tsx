"use client";
// 分岐列コンポーネント。
// 主フロー列の右隣に配置され、独立した編集可能フローを持つ。
// 下部に「合流」ボタンを表示し、クリックで主フローの矢印と合流させる。
import type { Attachment, BranchFlow, EditorCaret, MainFlow as MainFlowType } from "@/types/ptcl";
import { MainFlow } from "./MainFlow";

type Props = {
  branchFlow: BranchFlow;
  /** 主フローの全アタッチメント（分岐列の矢印アタッチメント参照用） */
  mainFlowAttachments: Attachment[];
  /** 列幅 */
  colW: number;
  /** 分岐のキャレット（BranchColumn 独自管理） */
  caret: EditorCaret;
  autoEditId?: string | null;
  onDirectInsert: (beforeBlockIndex: number) => void;
  onMoveBlock: (blockId: string, beforeBlockIndex: number) => void;
  onBlockSelect: (blockId: string) => void;
  onOperationTextChange: (blockId: string, text: string, richText?: string) => void;
  onOperationDelete: (blockId: string) => void;
  onSelectArrowAfterOp: (opBlockIndex: number) => void;
  onArrowNext: (arrowBlockIndex: number) => void;
  onAddAttachment: (anchorId: string, kind: "side-in" | "side-out" | "loop", text: string) => void;
  onUpdateAttachment: (id: string, text: string, richText?: string) => void;
  onRemoveAttachment: (id: string) => void;
  onInsertSpacer: (beforeBlockIndex: number) => void;
  onUpdateSpacerHeight: (blockId: string, h: number) => void;
  onDeleteSpacer: (blockId: string) => void;
  /** 合流モードを開始する（クリックで主フロー矢印を選択させる） */
  onMergeStart: () => void;
  /** 分岐を削除する */
  onRemoveBranch: () => void;
  /** 現在の合流先矢印 id（あれば） */
  mergeTargetArrowId: string | null;
  /** 合流先矢印のラベル（あれば） */
  mergeTargetLabel?: string;
  /** 合流モード選択中かどうか */
  isMergeSelectMode?: boolean;
};

// BranchFlow の blocks + 主フローのアタッチメントを MainFlowType として構築するアダプタ。
// アタッチメントはグローバルで anchorId が一意のため、主フロー配列に格納しても問題ない。
function branchFlowAsMainFlow(bf: BranchFlow, mainFlowAttachments: Attachment[]): MainFlowType {
  // bf.attachments は通常空だが念のためマージ
  const blockIds = new Set(bf.blocks.map((b) => b.id));
  const relevant = mainFlowAttachments.filter((a) => blockIds.has(a.anchorId));
  const merged = [...bf.attachments, ...relevant.filter(
    (a) => !bf.attachments.some((ba) => ba.id === a.id),
  )];
  return {
    blocks: bf.blocks as MainFlowType["blocks"],
    attachments: merged,
    branchFlows: [],
  };
}

export function BranchColumn({
  branchFlow,
  mainFlowAttachments,
  colW,
  caret,
  autoEditId,
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
  onMergeStart,
  onRemoveBranch,
  mergeTargetArrowId,
  mergeTargetLabel,
  isMergeSelectMode = false,
}: Props) {
  return (
    <div
      className="flex flex-col"
      style={{ width: colW }}
      data-branch-col={branchFlow.id}
      data-branch-source-arrow={branchFlow.sourceArrowId}
      data-branch-merge-arrow={branchFlow.mergeTargetArrowId ?? ""}
    >
      {/* ヘッダー: 削除ボタンのみ（計測の基準点） */}
      <div
        className="group mb-1 flex items-center justify-end rounded-t border border-blue-200 bg-blue-50 px-2 py-1"
        data-branch-entry={branchFlow.id}
      >
        <button
          type="button"
          onClick={onRemoveBranch}
          className="rounded px-1 text-[10px] text-blue-200 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
          title="この分岐を削除"
        >
          ✕
        </button>
      </div>

      {/* フロー本体 */}
      <div className="rounded-b border border-t-0 border-blue-100 bg-white">
        <BranchFlowRenderer
          branchFlow={branchFlow}
          mainFlowAttachments={mainFlowAttachments}
          colW={colW}
          caret={caret}
          autoEditId={autoEditId}
          onDirectInsert={onDirectInsert}
          onMoveBlock={onMoveBlock}
          onBlockSelect={onBlockSelect}
          onOperationTextChange={onOperationTextChange}
          onOperationDelete={onOperationDelete}
          onSelectArrowAfterOp={onSelectArrowAfterOp}
          onArrowNext={onArrowNext}
          onAddAttachment={onAddAttachment}
          onUpdateAttachment={onUpdateAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onInsertSpacer={onInsertSpacer}
          onUpdateSpacerHeight={onUpdateSpacerHeight}
          onDeleteSpacer={onDeleteSpacer}
        />
      </div>

      {/* フッター: 合流ボタン（計測の基準点） */}
      <div className="mt-2 flex flex-col items-center gap-1" data-branch-exit={branchFlow.id}>
        {mergeTargetArrowId ? (
          /* 合流済み: 緑の細いライン + ホバーで変更ボタン */
          <div className="group flex w-full items-center gap-1">
            <div className="h-px flex-1 bg-green-300" />
            <button
              type="button"
              onClick={onMergeStart}
              className="shrink-0 rounded px-1 text-[10px] text-green-300 opacity-0 transition-opacity hover:text-green-600 group-hover:opacity-100"
              title="合流先を変更"
            >
              ✕
            </button>
            <div className="h-px flex-1 bg-green-300" />
          </div>
        ) : (
          /* 未合流: 青の細いライン（クリックで合流モード、選択中はアンバー） */
          <button
            type="button"
            onClick={onMergeStart}
            className={[
              "w-full rounded border py-1 text-[10px] transition-colors",
              isMergeSelectMode
                ? "border-amber-300 bg-amber-50 text-amber-500 ring-1 ring-amber-200"
                : "border-blue-100 bg-blue-50 text-blue-300 hover:bg-blue-100 hover:text-blue-400",
            ].join(" ")}
            title={isMergeSelectMode ? "主フローの矢印をクリック" : "合流先を設定"}
          >
            {isMergeSelectMode ? "矢印をクリック…" : "↩"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- 分岐フロー内部レンダラ ----
// BranchFlow のブロック型は MainFlowBlock のサブセットなので型アサーションで対応する。

function BranchFlowRenderer({
  branchFlow,
  mainFlowAttachments,
  colW,
  caret,
  autoEditId,
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
}: Omit<Props,
  | "onMergeStart"
  | "onRemoveBranch"
  | "mergeTargetArrowId"
  | "mergeTargetLabel"
  | "isMergeSelectMode"
>) {
  const pseudoMainFlow = branchFlowAsMainFlow(branchFlow, mainFlowAttachments);

  return (
    <MainFlow
      mainFlow={pseudoMainFlow}
      caret={caret}
      autoEditId={autoEditId}
      colW={colW}
      onDirectInsert={onDirectInsert}
      onMoveBlock={onMoveBlock}
      onBlockSelect={onBlockSelect}
      onOperationTextChange={onOperationTextChange}
      onOperationDelete={onOperationDelete}
      onSelectArrowAfterOp={onSelectArrowAfterOp}
      onArrowNext={onArrowNext}
      onAddAttachment={onAddAttachment}
      onUpdateAttachment={onUpdateAttachment}
      onRemoveAttachment={onRemoveAttachment}
      onInsertSpacer={onInsertSpacer}
      onUpdateSpacerHeight={onUpdateSpacerHeight}
      onDeleteSpacer={onDeleteSpacer}
    />
  );
}
