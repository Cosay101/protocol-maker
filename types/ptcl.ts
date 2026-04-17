// Zod スキーマから推論した型を再輸出。アプリ全体はここ経由で型を使う。
import type { z } from "zod";
import type {
  MetaSchema,
  PageSchema,
  OperationBlockSchema,
  ArrowBlockSchema,
  MainFlowBlockSchema,
  SideInAttachmentSchema,
  SideOutAttachmentSchema,
  AttachmentSchema,
  MainFlowSchema,
  TextFreeElementSchema,
  FreeElementSchema,
  PtclDocumentSchema,
  MainFlowFragmentSchema,
  FreeElementsFragmentSchema,
  RecentItemSchema,
  RecentsSchema,
  PinnedSchema,
  TemplateVariableSchema,
  TemplateSchema,
  TemplatesSchema,
  UiStateSchema,
} from "@/lib/ptcl/schema";

// ---------- ドキュメント ----------
export type Meta = z.infer<typeof MetaSchema>;
export type Page = z.infer<typeof PageSchema>;

export type OperationBlock = z.infer<typeof OperationBlockSchema>;
export type ArrowBlock = z.infer<typeof ArrowBlockSchema>;
export type MainFlowBlock = z.infer<typeof MainFlowBlockSchema>;

export type SideInAttachment = z.infer<typeof SideInAttachmentSchema>;
export type SideOutAttachment = z.infer<typeof SideOutAttachmentSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;

export type MainFlow = z.infer<typeof MainFlowSchema>;

export type TextFreeElement = z.infer<typeof TextFreeElementSchema>;
export type FreeElement = z.infer<typeof FreeElementSchema>;

export type PtclDocument = z.infer<typeof PtclDocumentSchema>;

// ---------- クリップボード ----------
export type MainFlowFragment = z.infer<typeof MainFlowFragmentSchema>;
export type FreeElementsFragment = z.infer<typeof FreeElementsFragmentSchema>;

// ---------- ローカルメタ ----------
export type RecentItem = z.infer<typeof RecentItemSchema>;
export type Recents = z.infer<typeof RecentsSchema>;
export type Pinned = z.infer<typeof PinnedSchema>;
export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type Templates = z.infer<typeof TemplatesSchema>;
export type UiState = z.infer<typeof UiStateSchema>;

// ---------- ビュー型 ----------

/**
 * Home 画面のアーカイブ一覧行で使う集約型。
 * recents + pinned + 実ファイル存在確認の結果をマージしたもの。
 */
export type ArchiveEntry = {
  id: string;
  path: string;
  /** meta.title 優先、次に titleCache。null ならファイル名フォールバック。 */
  title: string | null;
  updatedAt: string;
  lastOpenedAt: string;
  pinned: boolean;
  /** 実ファイルが読めたか。false のときは UI でグレーアウト。 */
  exists: boolean;
};

// ---------- エディタのキャレット ----------

export type FocusZone =
  | "home"
  | "header"
  | "mainFlow"
  | "freeLayer"
  | "textEditing";

/**
 * mainFlow の編集位置を表す。
 * gap は「blocks[beforeBlockIndex] の直前」、
 * range は両端 inclusive で必ず operation 境界にスナップ。
 */
export type EditorCaret =
  | { kind: "none" }
  | { kind: "gap"; beforeBlockIndex: number }
  | { kind: "block"; blockId: string }
  | { kind: "range"; fromIndex: number; toIndex: number };
