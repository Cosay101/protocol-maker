// 検索・置換ユーティリティ
//
// highlightHtml  : HTML/テキスト内の query を <mark class="ptcl-hl"> でハイライト
// replaceInText  : プレーンテキスト内の query を replacement に置換
// replaceInHtml  : リッチテキスト (HTML) 内のテキストノードの query を置換
// countInText    : テキスト内の query 出現回数
// countMatchesInDoc : ドキュメント全体のマッチ件数

import type { PtclDocument } from "@/types/ptcl";

/** クエリ文字列を正規表現用にエスケープする */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** HTML タグを除去してプレーンテキストを得る（カウント用） */
function htmlToPlain(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
}

/** テキスト内の query 出現回数（大文字小文字を無視） */
export function countInText(text: string, query: string): number {
  if (!query || !text) return 0;
  const re = new RegExp(escapeRe(query), "gi");
  return (text.match(re) ?? []).length;
}

/**
 * HTML/テキスト文字列内の query を <mark class="ptcl-hl"> でラップした HTML を返す。
 * isRichText=true のとき HTML タグの外側のテキストノードのみ対象にする。
 */
export function highlightHtml(content: string, query: string, isRichText = false): string {
  if (!query || !content) return content;
  const re = new RegExp(`(${escapeRe(query)})`, "gi");

  if (!isRichText) {
    // プレーンテキスト（または escapeHtml 済み）: そのまま置換
    return content.replace(re, '<mark class="ptcl-hl">$1</mark>');
  }

  // リッチテキスト: タグ内には置換せず、テキスト部分だけ対象
  return content.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag;
    if (text) return text.replace(re, '<mark class="ptcl-hl">$1</mark>');
    return "";
  });
}

/**
 * プレーンテキスト内の query を replacement に置換する（大文字小文字を無視）。
 */
export function replaceInText(text: string, query: string, replacement: string): string {
  if (!query || !text) return text;
  return text.replace(new RegExp(escapeRe(query), "gi"), replacement);
}

/**
 * HTML 文字列内のテキストノード部分の query を replacement に置換する。
 * HTML タグ自体はそのまま保持する。
 */
export function replaceInHtml(html: string, query: string, replacement: string): string {
  if (!query || !html) return html;
  const re = new RegExp(escapeRe(query), "gi");
  return html.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag;
    if (text) return text.replace(re, replacement);
    return "";
  });
}

/** ドキュメント全体で query がいくつヒットするか数える */
export function countMatchesInDoc(doc: PtclDocument, query: string): number {
  if (!query) return 0;
  let count = 0;

  // ヘッダー
  const titleText = doc.meta.titleRich ? htmlToPlain(doc.meta.titleRich) : doc.meta.title;
  const authorText = doc.meta.authorRich ? htmlToPlain(doc.meta.authorRich) : doc.meta.author;
  count += countInText(titleText, query);
  count += countInText(authorText, query);

  // フローチャート: OperationBlock
  for (const block of doc.mainFlow.blocks) {
    if (block.type !== "operation") continue;
    const text = block.richText ? htmlToPlain(block.richText) : block.text;
    count += countInText(text, query);
  }

  // フローチャート: Attachment（特殊アクション）
  for (const att of doc.mainFlow.attachments) {
    const text = att.richText ? htmlToPlain(att.richText) : att.text;
    count += countInText(text, query);
  }

  // 自由配置要素
  for (const el of doc.freeElements) {
    if (el.type === "text") {
      // el.text はインライン書式 HTML を含む場合があるため htmlToPlain でテキスト部分のみ取り出す
      count += countInText(htmlToPlain(el.text ?? ""), query);
    }
    if (el.type === "table") {
      for (let r = 0; r < el.rows; r++) {
        for (let c = 0; c < el.cols; c++) {
          const cell = el.cells[`${r},${c}`];
          if (!cell) continue;
          const text = cell.richText ? htmlToPlain(cell.richText) : cell.text ?? "";
          count += countInText(text, query);
        }
      }
    }
  }

  return count;
}
