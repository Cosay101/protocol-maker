// .ptcl スキーマと local metadata の Zod 定義（単一の真実の源）
// 型は types/ptcl.ts から z.infer で再輸出する。
import { z } from "zod";

// ---------- ID ----------
const Id = z.string().min(1);

// ---------- Meta ----------
export const MetaSchema = z.object({
  title: z.string(),
  titleRich: z.string().optional(),
  author: z.string(),
  authorRich: z.string().optional(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(),
});

// ---------- Page ----------
export const PageSchema = z.object({
  size: z.enum(["A3", "A4", "A5", "B4", "B5"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
});

// ---------- Main Flow Blocks ----------

/** ブロック個別のスタイル上書き。未設定フィールドはドキュメント全体設定を継承。 */
export const BlockStyleSchema = z.object({
  fontFamily: z.enum(["gothic", "mincho"]).optional(),
  fontSize: z.number().int().positive().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
});

export const OperationBlockSchema = z.object({
  id: Id,
  type: z.literal("operation"),
  text: z.string(),
  /** リッチテキスト (innerHTML)。文字単位でスタイルが付いている場合に保持。 */
  richText: z.string().optional(),
  style: BlockStyleSchema.optional(),
});

export const ArrowBlockSchema = z.object({
  id: Id,
  type: z.literal("arrow"),
});

export const SpacerBlockSchema = z.object({
  id: Id,
  type: z.literal("spacer"),
  /** 高さ（px）。ドラッグで変更。 */
  h: z.number().min(20).default(80),
});

export const BranchBlockSchema = z.object({
  id: Id,
  type: z.literal("branch"),
  /** 分岐条件テキスト */
  condition: z.string().default(""),
  /** Yes / 真 側のラベル */
  yesLabel: z.string().default("はい"),
  /** No / 偽 側のラベル */
  noLabel: z.string().default("いいえ"),
});

/** 改列マーカー。このブロックが現れた位置で強制的に次の列へ分割する。 */
export const ColumnBreakBlockSchema = z.object({
  id: Id,
  type: z.literal("columnBreak"),
});

export const MainFlowBlockSchema = z.discriminatedUnion("type", [
  OperationBlockSchema,
  ArrowBlockSchema,
  SpacerBlockSchema,
  BranchBlockSchema,
  ColumnBreakBlockSchema,
]);

// ---------- Attachments (side-in / side-out) ----------
export const SideInAttachmentSchema = z.object({
  id: Id,
  kind: z.literal("side-in"),
  anchorId: Id,
  text: z.string(),
  /** リッチテキスト (innerHTML)。文字単位でスタイルが付いている場合に保持。 */
  richText: z.string().optional(),
  /** ブロックレベルのフォントスタイル（リボンからの全体適用）。 */
  style: BlockStyleSchema.optional(),
  order: z.number().int().nonnegative(),
});

export const SideOutAttachmentSchema = z.object({
  id: Id,
  kind: z.literal("side-out"),
  anchorId: Id,
  text: z.string(),
  richText: z.string().optional(),
  style: BlockStyleSchema.optional(),
  order: z.number().int().nonnegative(),
});

export const LoopAttachmentSchema = z.object({
  id: Id,
  kind: z.literal("loop"),
  anchorId: Id,
  text: z.string(), // 任意ラベル（例: "×3", "5min"）
  richText: z.string().optional(),
  style: BlockStyleSchema.optional(),
  order: z.number().int().nonnegative(),
});

export const AttachmentSchema = z.discriminatedUnion("kind", [
  SideInAttachmentSchema,
  SideOutAttachmentSchema,
  LoopAttachmentSchema,
]);

// ---------- BranchFlow (平行分岐列) ----------
/** 分岐列内のブロック（operation / arrow / spacer のみ） */
export const BranchFlowBlockSchema = z.discriminatedUnion("type", [
  OperationBlockSchema,
  ArrowBlockSchema,
  SpacerBlockSchema,
]);

export const BranchFlowSchema = z.object({
  id: Id,
  /** 分岐元の矢印 ID（mainFlow.blocks 内の arrow ブロック） */
  sourceArrowId: Id,
  /** 合流先の矢印 ID（mainFlow.blocks 内の arrow ブロック）。null = 未合流 */
  mergeTargetArrowId: Id.nullable().default(null),
  blocks: z.array(BranchFlowBlockSchema).default([]),
  attachments: z.array(AttachmentSchema).default([]),
});

// ---------- MainFlow ----------
// blocks は operation / arrow の交互配列（正規化はアプリ側が責任を持つ）
export const MainFlowSchema = z.object({
  blocks: z.array(MainFlowBlockSchema),
  attachments: z.array(AttachmentSchema),
  /** 平行分岐列の一覧 */
  branchFlows: z.array(BranchFlowSchema).default([]),
});

// ---------- Free Elements ----------
// MVP は text のみ。将来 image / branchGroup を discriminatedUnion で足す。
export const TextFreeElementSchema = z.object({
  id: Id,
  type: z.literal("text"),
  x: z.number(),
  y: z.number(),
  w: z.number().min(40),
  h: z.number().min(40),
  text: z.string(),
  // MVP の分岐用ボックスは frame: true の TextBox として表現する
  frame: z.boolean().default(false),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
  // ブロックレベルのフォントスタイル（リボンからの全体適用）
  fontFamily: z.enum(["gothic", "mincho"]).optional(),
  fontSize: z.number().int().positive().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
});

export const ImageFreeElementSchema = z.object({
  id: Id,
  type: z.literal("image"),
  x: z.number(),
  y: z.number(),
  w: z.number().min(10),
  h: z.number().min(10),
  /** 回転角度（度）。正: 時計回り */
  rotation: z.number().default(0),
  /** 水平反転 */
  flipX: z.boolean().default(false),
  /** 垂直反転 */
  flipY: z.boolean().default(false),
  /** 画像 data URL */
  src: z.string(),
  /** 元ファイル名 */
  name: z.string(),
});

export const TableCellSchema = z.object({
  text: z.string().default(""),
  richText: z.string().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  fontFamily: z.enum(["gothic", "mincho"]).optional(),
  fontSize: z.number().int().positive().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
});

export const TableFreeElementSchema = z.object({
  id: Id,
  type: z.literal("table"),
  x: z.number(),
  y: z.number(),
  w: z.number().min(80),
  h: z.number().min(40),
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  /** セルデータ: キーは "row,col" (0始まり) */
  cells: z.record(TableCellSchema).default({}),
  /** 各列の相対幅（合計1、省略時は均等） */
  colWidths: z.array(z.number()).optional(),
  /** 各行の相対高さ（合計1、省略時は均等） */
  rowHeights: z.array(z.number()).optional(),
});

/** 自由矢印（ポリライン）。points[0] が始点、points[末尾] が終点（矢じり付き）。 */
export const ArrowFreeElementSchema = z.object({
  id: Id,
  type: z.literal("arrow"),
  /** 制御点の配列（最低 2 点）。始点・中間点・終点の順。 */
  points: z.array(z.object({ x: z.number(), y: z.number() })).min(2),
  /** 線の色（CSS カラー） */
  color: z.string().default("#374151"),
  /** 線幅（px） */
  strokeWidth: z.number().default(2),
});

export const FreeElementSchema = z.discriminatedUnion("type", [
  TextFreeElementSchema,
  ImageFreeElementSchema,
  TableFreeElementSchema,
  ArrowFreeElementSchema,
]);

// ---------- Document ----------
export const PtclDocumentSchema = z.object({
  format: z.literal("ptcl"),
  schemaVersion: z.literal("1.0"),
  id: Id,
  meta: MetaSchema,
  page: PageSchema,
  mainFlow: MainFlowSchema,
  freeElements: z.array(FreeElementSchema),
});

// ---------- Clipboard Fragments ----------
export const MainFlowFragmentSchema = z.object({
  format: z.literal("ptcl-fragment"),
  schemaVersion: z.literal("1.0"),
  kind: z.literal("mainFlow"),
  blocks: z.array(MainFlowBlockSchema),
  attachments: z.array(AttachmentSchema),
});

export const FreeElementsFragmentSchema = z.object({
  format: z.literal("ptcl-fragment"),
  schemaVersion: z.literal("1.0"),
  kind: z.literal("freeElements"),
  elements: z.array(FreeElementSchema),
});

// ==========================================================
// Local Metadata
// ==========================================================

// ---------- recents.json ----------
export const RecentItemSchema = z.object({
  id: Id,
  path: z.string(),
  titleCache: z.string().nullable(),
  updatedAt: z.string(),
  lastOpenedAt: z.string(),
  missing: z.boolean().default(false),
});

export const RecentsSchema = z.object({
  version: z.literal(1),
  items: z.array(RecentItemSchema),
  maxItems: z.number().int().positive().default(50),
});

// ---------- pinned.json ----------
export const PinnedSchema = z.object({
  version: z.literal(1),
  ids: z.array(Id),
});

// ---------- templates.json ----------
export const TemplateVariableSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  hint: z.string().optional(),
  defaultValue: z.string().optional(),
});

export const TemplateSchema = z.object({
  id: Id,
  label: z.string().min(1),
  text: z.string(),
  variables: z.array(TemplateVariableSchema),
  pinned: z.boolean().default(false),
  order: z.number().int().nonnegative(),
  builtin: z.boolean().optional(),
});

export const TemplatesSchema = z.object({
  version: z.literal(1),
  templates: z.array(TemplateSchema),
});

// ---------- ui-state.json ----------
export const UiStateSchema = z.object({
  version: z.literal(1),
  appVersion: z.string(),
  window: z.object({
    width: z.number(),
    height: z.number(),
    x: z.number().optional(),
    y: z.number().optional(),
    maximized: z.boolean().default(false),
  }),
  lastOpenedPath: z.string().nullable(),
  home: z.object({
    sortBy: z.enum(["updatedAt", "title", "lastOpenedAt"]).default("updatedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    showPinnedFirst: z.boolean().default(true),
  }),
  edit: z.object({
    zoom: z.number().default(1.0),
    showLeftPalette: z.boolean().default(true),
    showRightInspector: z.boolean().default(false),
  }),
});
