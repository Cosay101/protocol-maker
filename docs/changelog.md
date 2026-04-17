# Changelog

このプロジェクトの変更履歴。[Keep a Changelog](https://keepachangelog.com/) 形式に準拠。  
バージョニングは [Semantic Versioning](https://semver.org/) に従う。

---

## [Unreleased]

### 予定（beta 1 完成後に着手）

- mainFlow ブロック挿入・削除・normalize ロジックの実装
- side-in / side-out のレンダリング実装
- 自由配置テキストボックスのドラッグ・リサイズ・編集
- 定型文テンプレートの管理 UI（追加・編集・削除・挿入）
- Tauri FS 経由の .ptcl 保存・読み込み
- recents / pinned の永続化（$APPDATA 書き込み）
- Undo / Redo

---

## [0.1.0-beta.1] - 未リリース

### Added

- プロジェクト初期化（Next.js 16 + Tauri 2 + Zustand + Tailwind 4）
- `.ptcl` スキーマ v1.0 定義（`lib/ptcl/schema.ts`）
  - PtclDocumentSchema, MainFlowSchema, AttachmentSchema, FreeElementSchema
  - local metadata schemas（RecentsSchema, PinnedSchema, TemplatesSchema, UiStateSchema）
- 型定義 `types/ptcl.ts`（Zod から z.infer で推論）
- Tauri FS / Dialog 薄ラッパ（`lib/tauri/fs.ts`, `lib/tauri/dialog.ts`）
- ID 生成ユーティリティ（`lib/id.ts`）、日付ユーティリティ（`lib/date.ts`）
- .ptcl の生成・パース・読み書き関数（`lib/ptcl/io.ts`）
- schemaVersion migrate エントリポイント（`lib/ptcl/migrate.ts`）
- Zustand ストア骨格（`stores/documentStore.ts`, `metaStore.ts`, `templateStore.ts`, `uiStore.ts`）
- Home 画面（2カラム、アーカイブ一覧、ダミーデータ表示）
- Edit 画面の骨格（上部メニュー・紙面・ページヘッダー）
- サンプル `.ptcl` 2 本（`samples/sample-minimal.ptcl`, `samples/sample-cell-fixation.ptcl`）
- `docs/architecture.md`, `docs/ptcl-schema.md`, `docs/changelog.md`, `docs/roadmap.md` 初版
- `README.md` beta 1 向け初版

### Technical

- `productName`: Protocol Maker
- `identifier`: jp.lab.protocolmaker
- `version`: 0.1.0-beta.1
- `.ptcl` schemaVersion: 1.0

---

<!-- バージョンリンク（GitHub 使用時に有効化） -->
<!-- [Unreleased]: https://github.com/yourorg/protocol-maker/compare/v0.1.0-beta.1...HEAD -->
<!-- [0.1.0-beta.1]: https://github.com/yourorg/protocol-maker/releases/tag/v0.1.0-beta.1 -->
