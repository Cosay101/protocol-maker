# Architecture

Protocol Maker の技術構成・ディレクトリ構成・編集モデルをまとめたドキュメントです。
実装が進むにつれて随時更新します。

---

## 技術スタック

| 層 | 採用技術 | 役割 |
|---|---|---|
| デスクトップシェル | Tauri 2 | ネイティブウィンドウ、FS、ダイアログ、配布バンドル |
| UI フレームワーク | Next.js 16 (App Router, `output: "export"`) | ルーティング（Home / Edit）と静的アセット生成 |
| 言語 | TypeScript (strict) | 型で .ptcl スキーマを固定する |
| ビュー | React 19 | コンポーネント（全ページ `"use client"` 前提） |
| 状態管理 | Zustand | ドキュメント / メタ / テンプレート / UI の分割ストア |
| スタイル | Tailwind 4 | ユーティリティクラスのみ使用 |
| 描画 | SVG + DOM (absolute 配置) | Canvas / WebGL は不使用 |
| スキーマ検証 | Zod | .ptcl 読み込み時のバリデーション |
| ID 生成 | nanoid | ドキュメント・ブロック・要素 ID |
| Tauri プラグイン | plugin-fs / plugin-dialog | FS 読み書き・ファイル選択ダイアログ |

---

## ディレクトリ構成

```
protocol-maker/
├── app/
│   ├── layout.tsx          グローバルレイアウト
│   ├── page.tsx            Home 画面（スタート画面）
│   ├── globals.css
│   └── edit/
│       └── page.tsx        Edit 画面（編集画面）
├── components/
│   ├── common/             共通 UI（Button, Modal など）
│   ├── home/               Home 専用コンポーネント + dummyData
│   └── edit/               Edit 専用コンポーネント
├── stores/
│   ├── documentStore.ts    開いている .ptcl ドキュメントの状態
│   ├── metaStore.ts        recents / pinned の状態
│   ├── templateStore.ts    ユーザー定型文テンプレートの状態
│   └── uiStore.ts          エディタの UI 状態（caret, フォーカスゾーンなど）
├── lib/
│   ├── ptcl/
│   │   ├── schema.ts       Zod スキーマ（単一の真実の源）
│   │   ├── io.ts           .ptcl の生成・パース・読み書き
│   │   └── migrate.ts      schemaVersion 間の変換
│   ├── tauri/
│   │   ├── fs.ts           plugin-fs の薄ラッパ
│   │   └── dialog.ts       plugin-dialog の薄ラッパ
│   ├── id.ts               nanoid ラッパ（プレフィックス付き）
│   └── date.ts             ISO 8601 / 表示用整形
├── types/
│   └── ptcl.ts             Zod から推論した型の再輸出
├── samples/
│   ├── sample-minimal.ptcl
│   └── sample-cell-fixation.ptcl
├── docs/                   設計メモ・仕様
└── src-tauri/              Rust シェル（Tauri）
```

---

## 編集モデル

このアプリの編集対象は 2 つのレイヤーに分かれる。

### 主フロー (mainFlow) — Word 的

- 上から下へ進む **順序つき配列**
- `blocks` は `operation` と `arrow` が **必ず交互**に並ぶ（invariant）
- ユーザーが operation を挿入・削除すると、アプリが `normalize()` を走らせて arrow の過不足を自動修正
- `attachments` は `arrow` に `anchorId` で紐付く side-in / side-out（左右の補助矢印）
- ユーザーは arrow を直接操作しない（UI 上で無効）

```
[ operation ] ← b_01
[ arrow     ] ← b_02  ←── att_01 (side-in: "PBS, 1mL")
[ operation ] ← b_03
[ arrow     ] ← b_04  ←── att_02 (side-out: "上清除去")
                       ←── att_03 (side-in: "4% PFA")
[ operation ] ← b_05
```

### 自由配置要素 (freeElements) — PowerPoint 的

- **絶対座標** `(x, y, w, h)` のコレクション
- 種別は MVP では `text` のみ（将来: `image`, `branchGroup`）
- 重なり可・紙面外も許容
- 3 状態モデル：idle → selected → editing

---

## データフロー

```
UI 操作
  ↓
Zustand store の action（documentStore / metaStore / templateStore / uiStore）
  ↓
documentStore は変更ごとに normalize() → isDirty = true
  ↓
Ctrl+S → io.saveDocument → lib/tauri/fs.writeTextFile → .ptcl ファイル
```

---

## local metadata の保存先

| OS | パス |
|---|---|
| Windows | `%APPDATA%\jp.lab.protocolmaker\` |
| macOS | `~/Library/Application Support/jp.lab.protocolmaker/` |

ファイル構成：
- `recents.json` — 最近使ったファイル（id / path / titleCache / updatedAt など）
- `pinned.json` — ピン留め ID 一覧
- `templates.json` — ユーザー定型文テンプレート
- `ui-state.json` — ウィンドウ位置・最後に開いたファイルなど

---

## 配布

- Tauri bundler で `msi`（Windows）と `dmg`（macOS）を生成
- beta 期間はコード署名なし
- 初回起動時に SmartScreen / Gatekeeper の警告が出る
  - Windows：「詳細情報」→「実行」
  - macOS：Finder で「右クリック → 開く → 開く」
- 自動アップデータは Post-MVP

---

## 実装指針

- **SSR/API routes は使わない**。App Router でも全ページ `"use client"` 前提
- **Tauri API は `isTauri()` でガード**。ブラウザ単体 (`npm run dev`) でも Home / Edit の UI は確認できる
- **schemaVersion は読み込み時に必ず検証**。未知バージョンは `UnsupportedSchemaVersionError` を投げる
- **normalize は全ての mainFlow 変更後に呼ぶ**。冪等性を保証する
