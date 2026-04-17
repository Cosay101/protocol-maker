// Tauri Dialog プラグインの薄ラッパ。
// SSR / 通常のブラウザでは plugin が無いため throw する。呼び元は isTauri() でガードする。
import { isTauri } from "@/lib/tauri/fs";

async function loadPlugin() {
  if (!isTauri()) {
    throw new Error(
      "Tauri 環境でのみ利用できます。ブラウザ単体では動作しません。",
    );
  }
  return await import("@tauri-apps/plugin-dialog");
}

/**
 * .ptcl を開くダイアログ。キャンセル時は null。
 */
export async function openPtclDialog(): Promise<string | null> {
  const dialog = await loadPlugin();
  const result = await dialog.open({
    multiple: false,
    directory: false,
    filters: [{ name: "Protocol Maker", extensions: ["ptcl"] }],
  });
  return typeof result === "string" ? result : null;
}

/**
 * .ptcl を保存するダイアログ。キャンセル時は null。
 */
export async function savePtclDialog(
  defaultName?: string,
): Promise<string | null> {
  const dialog = await loadPlugin();
  const result = await dialog.save({
    defaultPath: defaultName,
    filters: [{ name: "Protocol Maker", extensions: ["ptcl"] }],
  });
  return result ?? null;
}
