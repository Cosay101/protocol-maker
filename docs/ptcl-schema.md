# .ptcl スキーマ仕様 v1.0

実験プロトコルフローチャートの保存形式です。

---

## 概要

| 項目 | 値 |
|---|---|
| 拡張子 | `.ptcl` |
| 中身 | JSON |
| 文字コード | UTF-8 |
| 改行 | LF |
| 末尾改行 | あり |
| 1 ファイル | 1 ドキュメント |

---

## トップレベル構造

```jsonc
{
  "format": "ptcl",            // 識別子（固定）
  "schemaVersion": "1.0",      // スキーマバージョン（必須）
  "id": "p_...",               // ドキュメント不変 ID（nanoid）
  "meta": { ... },
  "page": { ... },
  "mainFlow": { ... },
  "freeElements": [ ... ]
}
```

### フィールド一覧

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `format` | `"ptcl"` | ✔ | ファイル識別子 |
| `schemaVersion` | `"1.0"` | ✔ | スキーマバージョン |
| `id` | string | ✔ | 不変ドキュメント ID。`p_` プレフィックス |
| `meta` | Meta | ✔ | タイトル・作成者・日時 |
| `page` | Page | ✔ | 紙面設定 |
| `mainFlow` | MainFlow | ✔ | 主フロー |
| `freeElements` | FreeElement[] | ✔ | 自由配置要素（空配列可） |

---

## Meta

```jsonc
{
  "title": "HeLa 細胞 固定プロトコル",
  "author": "山田 太郎",
  "createdAt": "2026-04-10T10:00:00+09:00",
  "updatedAt": "2026-04-15T14:30:00+09:00"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `title` | string | 一覧表示に優先利用。空文字可（ファイル名フォールバック） |
| `author` | string | |
| `createdAt` | ISO 8601 string | 作成時刻 |
| `updatedAt` | ISO 8601 string | 保存ごとにアプリが更新 |

---

## Page

```jsonc
{ "size": "A4", "orientation": "portrait" }
```

| フィールド | 型 | v1.0 制約 | 将来値 |
|---|---|---|---|
| `size` | string | `"A4"` のみ | `"A3"`, `"Letter"` など |
| `orientation` | string | `"portrait"` のみ | `"landscape"` |

---

## MainFlow

```jsonc
{
  "blocks": [ ... ],       // operation / arrow の交互配列
  "attachments": [ ... ]   // side-in / side-out（arrow に紐付く）
}
```

### MainFlowBlock（blocks 配列の要素）

#### OperationBlock

```jsonc
{ "id": "b_...", "type": "operation", "text": "氷上静置, 5min, 4℃" }
```

#### ArrowBlock

```jsonc
{ "id": "b_...", "type": "arrow" }
```

### 整合ルール（Invariants）

1. `blocks[0]` は必ず `operation`（先頭 arrow 禁止）
2. `blocks[blocks.length - 1]` は必ず `operation`（末尾 arrow 禁止）
3. 同型のブロックが連続してはならない（`op, op` や `arr, arr` 禁止）
4. 空配列は許容する（新規ドキュメント）

アプリは全ての mainFlow 変更後に `normalize()` を走らせてこの不変条件を保証する。

### Attachment（attachments 配列の要素）

#### SideInAttachment（左からの投入情報）

```jsonc
{
  "id": "att_...",
  "kind": "side-in",
  "anchorId": "b_02",      // 対象 ArrowBlock の id
  "text": "PBS, 1mL",      // ラベル本文（左矢印はレンダラが描く）
  "order": 0               // 同一 anchor 内での縦順（0 始まり）
}
```

#### SideOutAttachment（右への除去・吸引情報）

```jsonc
{
  "id": "att_...",
  "kind": "side-out",
  "anchorId": "b_04",
  "text": "上清除去",
  "order": 0
}
```

### attachment の整合ルール

- `anchorId` は `blocks` 内に存在する `type: "arrow"` の `id` を指す
- 対応する arrow が削除された場合、attachment も削除するかまたは隣の arrow に移譲する
- `order` は同一 anchor 内でユニークである必要はない（ソートで代用可）

---

## FreeElements

紙面上に自由に配置できる要素。`(x, y)` は紙面左上 `(0, 0)` 基準。

### TextFreeElement（v1.0 で唯一の種別）

```jsonc
{
  "id": "f_...",
  "type": "text",
  "x": 440,
  "y": 120,
  "w": 180,
  "h": 80,
  "text": "備考: PFAはドラフト内で扱う",
  "frame": false           // true にすると枠付きボックス（分岐ボックス代用）
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | `f_` プレフィックス |
| `type` | `"text"` | v1.0 は `text` のみ。将来 `image`, `branchGroup` を追加予定 |
| `x`, `y` | number (px) | 紙面左上原点からの絶対座標 |
| `w`, `h` | number (px) | 幅・高さ。最小 40px |
| `text` | string | 中身（HTML サブセット可。MVP ではプレーンテキスト） |
| `frame` | boolean | `true` で枠付き表示。MVP では分岐ボックスの代用 |

---

## 例：sample-cell-fixation.ptcl

```json
{
  "format": "ptcl",
  "schemaVersion": "1.0",
  "id": "p_sample_cell_fixation_001",
  "meta": {
    "title": "HeLa 細胞 固定プロトコル (サンプル)",
    "author": "研究室メンバー",
    "createdAt": "2026-04-10T10:00:00+09:00",
    "updatedAt": "2026-04-15T14:30:00+09:00"
  },
  "page": { "size": "A4", "orientation": "portrait" },
  "mainFlow": {
    "blocks": [
      { "id": "b_01", "type": "operation", "text": "培地を吸引" },
      { "id": "b_02", "type": "arrow" },
      { "id": "b_03", "type": "operation", "text": "PBSで1回洗浄" },
      { "id": "b_04", "type": "arrow" },
      { "id": "b_05", "type": "operation", "text": "室温静置, 15min" },
      { "id": "b_06", "type": "arrow" },
      { "id": "b_07", "type": "operation", "text": "PBSで3回洗浄" }
    ],
    "attachments": [
      { "id": "att_01", "kind": "side-in",  "anchorId": "b_02", "text": "PBS, 1mL",      "order": 0 },
      { "id": "att_02", "kind": "side-out", "anchorId": "b_04", "text": "上清除去",      "order": 0 },
      { "id": "att_03", "kind": "side-in",  "anchorId": "b_04", "text": "4% PFA, 500μL", "order": 1 }
    ]
  },
  "freeElements": [
    { "id": "f_01", "type": "text", "x": 440, "y": 120, "w": 180, "h": 80,
      "text": "備考: PFAはドラフト内で扱う", "frame": false }
  ]
}
```

---

## バージョン管理方針

- `schemaVersion` はドキュメントのデータ形式を表し、アプリのバージョンとは独立
- 後方互換の追加（新フィールドの optional 追加）は minor バージョンアップ (`1.1`)
- 破壊的変更はメジャーバージョンアップ (`2.0`)
- バージョンアップ時は `lib/ptcl/migrate.ts` に変換関数を追加する
- 未知の `schemaVersion` はアプリが `UnsupportedSchemaVersionError` を投げ、ユーザーに通知する

### 将来の拡張予定

| 型 | 概要 | 予定バージョン |
|---|---|---|
| `FreeElement.type: "image"` | 画像の自由配置 | 1.1 |
| `FreeElement.type: "branchGroup"` | 分岐フローまとまり | 1.2 |
| `MainFlowBlock.type: "page-break"` | ページ区切り | 1.1 |
| `page.size: "A3" \| "Letter"` | 用紙サイズ拡張 | 1.1 |
