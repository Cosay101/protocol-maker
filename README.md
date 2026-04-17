# Protocol Maker (beta)

研究室内配布を目的とした、実験プロトコルのフローチャートを気軽に作れるシンプルなデスクトップアプリです。  
Windows / macOS 両対応。

> **Status: beta (v0.1.0-beta.1)**  
> 機能は限定的です。研究室内検証版として配布しています。  
> 不具合・ご要望は研究室の連絡先までお知らせください。

---

## 目的

- 実験プロトコルを「紙面上に上から下へ流れるフローチャート」として素早く書ける
- Word・PowerPoint の代替を目指すのではなく、**実験プロトコル専用の軽いエディタ**
- ローカル保存（`.ptcl` 形式）で完結し、研究室内で配布しやすい

---

## 対応環境

| OS | バージョン | アーキテクチャ |
|---|---|---|
| Windows | 10 / 11 | x64 |
| macOS | 12 Monterey 以降 | Apple Silicon (arm64) / Intel (x64) |

---

## インストール

### Windows

1. 共有フォルダから `Protocol-Maker_x.x.x-beta.x_x64_en-US.msi` をダウンロード
2. ダブルクリックして実行
3. **SmartScreen の警告が出た場合**：「詳細情報」→「実行」をクリック
4. 画面の指示に従いインストール

### macOS

1. 共有フォルダから、使用している Mac に合う `.dmg` を選んでダウンロード
   - Apple シリコン (M1/M2/M3/M4) → `aarch64.dmg`
   - Intel Mac → `x64.dmg`
   - 判別方法：「Apple メニュー → このMacについて」
2. `.dmg` を開き、「Protocol Maker」を `Applications` フォルダへドラッグ
3. **初回のみ**：Finder で Protocol Maker を **右クリック → 開く → 開く**
   - 通常のダブルクリックでは「開発元が未確認」の警告が出る場合があります

---

## 起動方法

インストール後、アプリを起動するとスタート画面が表示されます。

- **新規作成**：空のプロトコルを作成して編集画面へ
- **最近使ったファイル**：以前開いた `.ptcl` ファイルを再度開く
- **ファイルを開く**：ローカルの `.ptcl` ファイルを直接選択

---

## 現在の機能（beta 1 時点）

- スタート画面（新規作成 / 最近使ったファイル / ピン留め）
- 編集画面の骨格（ページヘッダー・紙面表示）

> beta 1 はスキーマ・型定義・UI 骨格の確立を目的としています。  
> フローチャートの編集機能は beta 2 以降で順次実装予定です。

---

## ファイル形式

- 拡張子：`.ptcl`
- 中身：JSON（UTF-8）
- 詳細：[`docs/ptcl-schema.md`](docs/ptcl-schema.md)

### .ptcl を開く

Protocol Maker をインストール後、`.ptcl` ファイルをダブルクリックすると自動的にアプリで開きます  
（OS のファイル関連付けが機能します）。

---

## ローカルに保存されるデータ

アプリは以下の情報をローカルの OS 既定のアプリデータ領域に保存します。

| ファイル | 内容 |
|---|---|
| `recents.json` | 最近使ったファイルの一覧 |
| `pinned.json` | ピン留めしたファイルの ID 一覧 |
| `templates.json` | ユーザーが追加した定型文テンプレート |
| `ui-state.json` | ウィンドウ位置・最後に開いたファイルなど |

**保存場所：**

| OS | パス |
|---|---|
| Windows | `%APPDATA%\jp.lab.protocolmaker\` |
| macOS | `~/Library/Application Support/jp.lab.protocolmaker/` |

作成した `.ptcl` ファイル自体はここには保存されません。  
`.ptcl` は「名前を付けて保存」でユーザーが指定した場所に保存されます。

---

## よくあるトラブル

| 症状 | 対処 |
|---|---|
| Windows で「WindowsによってPCが保護されました」 | 「詳細情報」→「実行」 |
| macOS で「開発元が未確認」 | Finder で右クリック →「開く」→「開く」 |
| macOS で「壊れているため開けません」 | ターミナルで `xattr -d com.apple.quarantine /Applications/Protocol\ Maker.app` を実行 |
| `.ptcl` をダブルクリックしても開かない | 右クリック →「このアプリケーションで開く」→ Protocol Maker |
| 起動直後に落ちる | `%APPDATA%\jp.lab.protocolmaker\` (Win) または `~/Library/Application Support/jp.lab.protocolmaker/` (Mac) の `ui-state.json` を削除して再起動 |

---

## アンインストール

### Windows

「設定 → アプリ」から「Protocol Maker」を削除します。  
アプリデータ（`%APPDATA%\jp.lab.protocolmaker\`）は自動削除されません。  
完全に削除したい場合は手動でフォルダを削除してください。

### macOS

`/Applications/Protocol Maker.app` をゴミ箱に移動します。  
アプリデータ（`~/Library/Application Support/jp.lab.protocolmaker/`）は自動削除されません。  
完全に削除したい場合は手動でフォルダを削除してください。

---

## 開発環境のセットアップ

```bash
# 前提
# - Node.js 20+
# - Rust (stable) ← rustup で入れる
# - Windows: Microsoft C++ Build Tools
# - macOS: Xcode Command Line Tools

# 依存インストール
npm install

# Next.js 単体で開発確認（ブラウザで http://localhost:3000）
npm run dev

# Tauri デスクトップとして開発起動
npm run tauri:dev

# 配布用バンドル生成
npm run tauri:build
# → src-tauri/target/release/bundle/ に .msi / .dmg が出力される
```

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | 技術構成・ディレクトリ構成・編集モデル |
| [`docs/ptcl-schema.md`](docs/ptcl-schema.md) | `.ptcl` スキーマ仕様 v1.0 |
| [`docs/changelog.md`](docs/changelog.md) | 変更履歴 |
| [`docs/roadmap.md`](docs/roadmap.md) | 実装予定・優先順位 |

---

## サンプルファイル

`samples/` フォルダに 2 本のサンプル `.ptcl` が入っています。

| ファイル | 内容 |
|---|---|
| `sample-minimal.ptcl` | 2 ステップの最小サンプル（スキーマ確認用） |
| `sample-cell-fixation.ptcl` | HeLa 細胞固定プロトコル（side-in/out・自由配置を含む実用例） |

---

## 利用について

このアプリは研究室内配布用です。外部配布は想定していません。

---

*Protocol Maker (beta) — v0.1.0-beta.1*
