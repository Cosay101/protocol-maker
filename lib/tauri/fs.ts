// Tauri FS プラグインの薄ラッパ。
// SSR / 通常のブラウザでは plugin が無いため throw する。呼び元は isTauri() でガードする。

/**
 * 実行環境が Tauri かを判定する。
 * Tauri は window に __TAURI_INTERNALS__ を注入するのでそれを見る。
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

async function loadPlugin() {
  if (!isTauri()) {
    throw new Error(
      "Tauri 環境でのみ利用できます。ブラウザ単体では動作しません。",
    );
  }
  return await import("@tauri-apps/plugin-fs");
}

/**
 * 絶対パスからテキストを読む。
 */
export async function readTextFile(path: string): Promise<string> {
  const fs = await loadPlugin();
  return await fs.readTextFile(path);
}

/**
 * 絶対パスへテキストを書く。
 */
export async function writeTextFile(
  path: string,
  content: string,
): Promise<void> {
  const fs = await loadPlugin();
  await fs.writeTextFile(path, content);
}

/**
 * パスの存在確認。
 */
export async function exists(path: string): Promise<boolean> {
  const fs = await loadPlugin();
  return await fs.exists(path);
}
