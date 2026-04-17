// .ptcl スキーマと local metadata の Zod 定義（単一の真実の源）
// 型は types/ptcl.ts から z.infer で再輸出する。
import { z } from "zod";

// ---------- ID ----------
const Id = z.string().min(1);

// ---------- Meta ----------
export const MetaSchema = z.object({
  title: z.string(),
  author: z.string(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(),
});

// ---------- Page ----------
// v1.0 は A4 / portrait 固定
export const PageSchema = z.object({
  size: z.literal("A4"),
  orientation: z.literal("portrait"),
});

// ---------- Main Flow Blocks ----------
export const OperationBlockSchema = z.object({
  id: Id,
  type: z.literal("operation"),
  text: z.string(),
});

export const ArrowBlockSchema = z.object({
  id: Id,
  type: z.literal("arrow"),
});

export const MainFlowBlockSchema = z.discriminatedUnion("type", [
  OperationBlockSchema,
  ArrowBlockSchema,
]);

// ---------- Attachments (side-in / side-out) ----------
export const SideInAttachmentSchema = z.object({
  id: Id,
  kind: z.literal("side-in"),
  anchorId: Id,
  text: z.string(),
  order: z.number().int().nonnegative(),
});

export const SideOutAttachmentSchema = z.object({
  id: Id,
  kind: z.literal("side-out"),
  anchorId: Id,
  text: z.string(),
  order: z.number().int().nonnegative(),
});

export const AttachmentSchema = z.discriminatedUnion("kind", [
  SideInAttachmentSchema,
  SideOutAttachmentSchema,
]);

// ---------- MainFlow ----------
// blocks は operation / arrow の交互配列（正規化はアプリ側が責任を持つ）
export const MainFlowSchema = z.object({
  blocks: z.array(MainFlowBlockSchema),
  attachments: z.array(AttachmentSchema),
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
});

export const FreeElementSchema = z.discriminatedUnion("type", [
  TextFreeElementSchema,
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
