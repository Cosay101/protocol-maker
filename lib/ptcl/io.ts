// .ptcl ファイルの読み書き。Tauri FS 薄ラッパ経由で動く。
// SSR / ブラウザでは Tauri API が無いため、runtime エラーを投げる（UI側はガードする）。
import { PtclDocumentSchema } from "@/lib/ptcl/schema";
import { migrateToLatest } from "@/lib/ptcl/migrate";
import { readTextFile, writeTextFile } from "@/lib/tauri/fs";
import type { PtclDocument } from "@/types/ptcl";
import { newDocumentId } from "@/lib/id";
import { nowIso } from "@/lib/date";

/**
 * 新規ドキュメントを生成する。
 */
export function createEmptyDocument(params?: {
  title?: string;
  author?: string;
}): PtclDocument {
  const now = nowIso();
  return {
    format: "ptcl",
    schemaVersion: "1.0",
    id: newDocumentId(),
    meta: {
      title: params?.title ?? "",
      author: params?.author ?? "",
      createdAt: now,
      updatedAt: now,
    },
    page: { size: "A4", orientation: "portrait" },
    mainFlow: { blocks: [], attachments: [] },
    freeElements: [],
  };
}

/**
 * JSON 文字列を検証して PtclDocument にパースする。
 * 未知の schemaVersion は migrate → validate の順で試す。
 */
export function parseDocument(json: string): PtclDocument {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const normalized = migrateToLatest(raw);
  return PtclDocumentSchema.parse(normalized);
}

/**
 * PtclDocument を pretty JSON にシリアライズする。
 * UTF-8 / LF / 末尾改行で保存するのが規約。
 */
export function stringifyDocument(doc: PtclDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

/**
 * パスから .ptcl を読み込む。
 */
export async function loadDocument(path: string): Promise<PtclDocument> {
  const text = await readTextFile(path);
  return parseDocument(text);
}

/**
 * パスへ .ptcl を書き込む。updatedAt はここで更新しない（呼び元の責務）。
 */
export async function saveDocument(
  path: string,
  doc: PtclDocument,
): Promise<void> {
  await writeTextFile(path, stringifyDocument(doc));
}
