// mainFlow の不変条件（operation/arrow交互・末尾/先頭arrow禁止）を保つ正規化関数。
// 全ての mainFlow 変更後に必ず呼ぶ。冪等性あり（2回呼んでも同じ結果）。
import type { MainFlow, MainFlowBlock, BranchFlow } from "@/types/ptcl";
import { newBlockId } from "@/lib/id";

export function normalizeMainFlow(mainFlow: MainFlow): MainFlow {
  let blocks = [...mainFlow.blocks];
  let attachments = [...mainFlow.attachments];
  const branchFlows = mainFlow.branchFlows ?? [];

  if (blocks.length === 0) return { blocks, attachments, branchFlows };

  // Step 1: 先頭の arrow を取り除く（attachments は次の arrow に移譲、なければ削除）
  while (blocks.length > 0 && blocks[0].type === "arrow") {
    const removedId = blocks[0].id;
    blocks = blocks.slice(1);
    const nextArrow = blocks.find((b) => b.type === "arrow");
    if (nextArrow) {
      attachments = attachments.map((a) =>
        a.anchorId === removedId ? { ...a, anchorId: nextArrow.id } : a,
      );
    } else {
      attachments = attachments.filter((a) => a.anchorId !== removedId);
    }
  }

  if (blocks.length === 0) return { blocks, attachments, branchFlows };

  // Step 2: 末尾の arrow を取り除く（attachments は前の arrow に移譲、なければ削除）
  while (blocks.length > 0 && blocks[blocks.length - 1].type === "arrow") {
    const removedId = blocks[blocks.length - 1].id;
    blocks = blocks.slice(0, -1);
    const prevArrow = [...blocks].reverse().find((b) => b.type === "arrow");
    if (prevArrow) {
      attachments = attachments.map((a) =>
        a.anchorId === removedId ? { ...a, anchorId: prevArrow.id } : a,
      );
    } else {
      attachments = attachments.filter((a) => a.anchorId !== removedId);
    }
  }

  if (blocks.length === 0) return { blocks, attachments, branchFlows };

  // Step 3: 連続 arrow を合体（前を残し、後ろの attachments を前に移譲）
  const merged: MainFlowBlock[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (block.type === "arrow" && last?.type === "arrow") {
      attachments = attachments.map((a) =>
        a.anchorId === block.id ? { ...a, anchorId: last.id } : a,
      );
    } else {
      merged.push(block);
    }
  }

  // Step 4: 連続 operation / branch の間に arrow を自動挿入
  // また spacer の直後に来る operation / branch の前にも arrow を挿入
  const isContentBlock = (b: MainFlowBlock) =>
    b.type === "operation" || b.type === "branch";
  const needsArrow = (a: MainFlowBlock, b: MainFlowBlock) =>
    (isContentBlock(a) && isContentBlock(b)) ||
    (a.type === "spacer" && isContentBlock(b));
  const final: MainFlowBlock[] = [];
  for (let i = 0; i < merged.length; i++) {
    final.push(merged[i]);
    if (i < merged.length - 1 && needsArrow(merged[i], merged[i + 1])) {
      final.push({ id: newBlockId(), type: "arrow" });
    }
  }

  // Step 5: anchorId が存在しない attachment を除去
  const arrowIds = new Set(
    final.filter((b) => b.type === "arrow").map((b) => b.id),
  );
  attachments = attachments.filter((a) => arrowIds.has(a.anchorId));

  return { blocks: final, attachments, branchFlows };
}

/**
 * 分岐列のブロック列を正規化する（operation/arrow 交互・先頭末尾 arrow 禁止）。
 * mainFlow と同じ不変条件を適用するが columnBreak・branch は含まない。
 */
export function normalizeBranchFlow(bf: BranchFlow): BranchFlow {
  let blocks = [...bf.blocks] as MainFlowBlock[];
  let attachments = [...bf.attachments];

  if (blocks.length === 0) return { ...bf, blocks: [], attachments };

  // 先頭 arrow 除去
  while (blocks.length > 0 && blocks[0].type === "arrow") {
    const removedId = blocks[0].id;
    blocks = blocks.slice(1);
    const nextArrow = blocks.find((b) => b.type === "arrow");
    if (nextArrow) {
      attachments = attachments.map((a) =>
        a.anchorId === removedId ? { ...a, anchorId: nextArrow.id } : a,
      );
    } else {
      attachments = attachments.filter((a) => a.anchorId !== removedId);
    }
  }

  // 末尾 arrow 除去
  while (blocks.length > 0 && blocks[blocks.length - 1].type === "arrow") {
    const removedId = blocks[blocks.length - 1].id;
    blocks = blocks.slice(0, -1);
    const prevArrow = [...blocks].reverse().find((b) => b.type === "arrow");
    if (prevArrow) {
      attachments = attachments.map((a) =>
        a.anchorId === removedId ? { ...a, anchorId: prevArrow.id } : a,
      );
    } else {
      attachments = attachments.filter((a) => a.anchorId !== removedId);
    }
  }

  if (blocks.length === 0) return { ...bf, blocks: [], attachments };

  // 連続 arrow 合体
  const merged: MainFlowBlock[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (block.type === "arrow" && last?.type === "arrow") {
      attachments = attachments.map((a) =>
        a.anchorId === block.id ? { ...a, anchorId: last.id } : a,
      );
    } else {
      merged.push(block);
    }
  }

  // 連続 operation の間に arrow 挿入
  const final: MainFlowBlock[] = [];
  for (let i = 0; i < merged.length; i++) {
    final.push(merged[i]);
    if (
      i < merged.length - 1 &&
      merged[i].type === "operation" &&
      merged[i + 1].type === "operation"
    ) {
      final.push({ id: newBlockId(), type: "arrow" });
    }
  }

  // 孤立 attachment 除去
  const arrowIds = new Set(final.filter((b) => b.type === "arrow").map((b) => b.id));
  attachments = attachments.filter((a) => arrowIds.has(a.anchorId));

  return {
    ...bf,
    blocks: final as BranchFlow["blocks"],
    attachments,
  };
}
