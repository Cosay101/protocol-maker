// SVG → PNG 変換スクリプト（sharp を使用）
import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const svgPath = resolve(root, "src-tauri/icons/icon-source.svg");
const outPath = resolve(root, "src-tauri/icons/icon.png");

const svgBuf = readFileSync(svgPath);

await sharp(svgBuf, { density: 300 })
  .resize(1024, 1024)
  .png()
  .toFile(outPath);

console.log("✅ icon.png (1024×1024) を生成しました:", outPath);
