// ビルド後にインストーラーを dist/ へコピーし、latest.json を生成するスクリプト
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// package.json からバージョンを取得
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;

// デバッグ・本番ビルドの両方を探す
const searchDirs = [
  path.join(root, "src-tauri", "target", "debug",   "bundle", "nsis"),
  path.join(root, "src-tauri", "target", "release", "bundle", "nsis"),
  path.join(root, "src-tauri", "target", "debug",   "bundle", "msi"),
  path.join(root, "src-tauri", "target", "release", "bundle", "msi"),
];

// インストーラーは protocol-maker の一つ上（= documents/projects/）に出力
const distDir = path.resolve(root, "..");
// dist/ フォルダも引き続き latest.json の置き場として使う
const localDistDir = path.join(root, "dist");
if (!fs.existsSync(localDistDir)) fs.mkdirSync(localDistDir);

let copied = 0;
let foundSig = null;
let foundExeName = null;

for (const dir of searchDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    const src = path.join(dir, file);
    // インストーラー本体をコピー
    if (file.endsWith(".exe") || file.endsWith(".msi")) {
      const dest = path.join(distDir, file);
      fs.copyFileSync(src, dest);
      console.log(`✓ コピー完了: dist/${file}`);
      foundExeName = file;
      copied++;
    }
    // 署名ファイル（.sig）もコピー
    if (file.endsWith(".sig")) {
      const dest = path.join(distDir, file);
      fs.copyFileSync(src, dest);
      foundSig = fs.readFileSync(src, "utf8").trim();
    }
  }
}

if (copied === 0) {
  console.log("インストーラーが見つかりませんでした。先にビルドを実行してください。");
  process.exit(1);
}

// latest.json を生成（アップデーターが参照するファイル）
// GITHUB_REPO 環境変数: "username/protocol-maker" 形式で設定
// 未設定の場合はプレースホルダーを埋め込む
const githubRepo = process.env.GITHUB_REPO ?? "";
const baseUrl = githubRepo
  ? `https://github.com/${githubRepo}/releases/download/v${version}`
  : (process.env.RELEASE_URL ?? "https://github.com/YOUR_NAME/protocol-maker/releases/download/v" + version);
const latestJson = {
  version,
  notes: process.env.RELEASE_NOTES ?? "バグ修正・機能改善",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: foundSig ?? "(署名なし: TAURI_SIGNING_PRIVATE_KEY を設定してビルドしてください)",
      url: `${baseUrl}/${foundExeName}`,
    },
  },
};

// latest.json は protocol-maker/dist/ に置く（updater エンドポイント用）
const latestPath = path.join(localDistDir, "latest.json");
fs.writeFileSync(latestPath, JSON.stringify(latestJson, null, 2) + "\n");
console.log(`✓ latest.json 生成: protocol-maker/dist/latest.json`);

console.log(`\n📦 インストーラーを出力しました (v${version})`);
console.log(`   インストーラー: ${distDir}`);
console.log(`   latest.json  : ${localDistDir}`);
console.log(`\n配布手順:`);
console.log(`   1. ${foundExeName} を Google Drive / GitHub Releases にアップロード`);
console.log(`   2. RELEASE_URL=https://... を設定して再度 npm run tauri:build`);
console.log(`   3. dist/latest.json もアップロード（自動アップデート用）`);
