"use client";

// Home 画面 — Word バックステージ風レイアウト
// 左サイドバー: 新規作成 / ファイルを開く / 名前を付けて保存 / 上書き保存 / エクスポート ─ 設定 / 情報
import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDocumentStore } from "@/stores/documentStore";
import { openPtclDialog, savePtclDialog } from "@/lib/tauri/dialog";
import { loadDocument, saveDocument, parseDocument } from "@/lib/ptcl/io";
import { isTauri } from "@/lib/tauri/fs";

const APP_VERSION = "0.1.0-beta.1";

type Panel = "new" | "open" | "saveAs" | "save" | "export" | "settings" | "about";

// ============================================================
// ルート — useSearchParams は Suspense 境界が必要
// ============================================================
export default function HomePage() {
  return (
    <Suspense fallback={<FilePage defaultPanel="new" />}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const setDocument = useDocumentStore((s) => s.setDocument);
  const defaultPanel: Panel =
    params.get("tab") === "file" ? "open" : "new";

  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    onInstall: () => void;
  } | null>(null);
  const [updateState, setUpdateState] = useState<"idle" | "downloading" | "done">("idle");

  // .ptcl ファイルをダブルクリックして起動した場合、自動でロードして編集画面へ
  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const path = await invoke<string | null>("get_startup_file");
        if (!path) return;
        const content = await invoke<string>("read_startup_ptcl", { path });
        const doc = parseDocument(content);
        setDocument(doc, path);
        router.push("/edit");
      } catch {
        // 起動引数なし or 読み込み失敗 → 通常のホーム画面を表示
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アップデート確認（tauri.conf.json に updater 設定がある場合のみ動作）
  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!update) return;
        setUpdateInfo({
          version: update.version,
          onInstall: async () => {
            setUpdateState("downloading");
            await update.downloadAndInstall();
            setUpdateState("done");
            // インストール完了後にアプリを再起動
            const { relaunch } = await import("@tauri-apps/plugin-process");
            await relaunch();
          },
        });
      } catch {
        // updater 未設定 or ネットワークエラー → 無視
      }
    })();
  }, []);

  return (
    <>
      {/* アップデートバナー */}
      {updateInfo && updateState === "idle" && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-blue-200 bg-white px-4 py-3 shadow-lg">
          <span className="text-sm text-neutral-700">
            新しいバージョン <strong>v{updateInfo.version}</strong> があります
          </span>
          <button
            type="button"
            onClick={updateInfo.onInstall}
            className="rounded bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600"
          >
            今すぐ更新
          </button>
        </div>
      )}
      {updateState === "downloading" && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-blue-200 bg-white px-4 py-3 shadow-lg text-sm text-neutral-600">
          ダウンロード中…
        </div>
      )}
      <FilePage defaultPanel={defaultPanel} />
    </>
  );
}

// ============================================================
// ファイルページ（Word バックステージ風・全画面）
// ============================================================
const SIDE_TOP: { key: Panel; label: string }[] = [
  { key: "new",    label: "新規作成" },
  { key: "open",   label: "ファイルを開く" },
  { key: "saveAs", label: "名前を付けて保存" },
  { key: "save",   label: "上書き保存" },
  { key: "export", label: "エクスポート" },
];
const SIDE_BOTTOM: { key: Panel; label: string }[] = [
  { key: "settings", label: "設定" },
  { key: "about",    label: "情報" },
];

function FilePage({ defaultPanel }: { defaultPanel: Panel }) {
  const [panel, setPanel] = useState<Panel>(defaultPanel);
  return (
    <div className="flex h-screen w-screen text-neutral-900">
      {/* ---- ダークサイドバー ---- */}
      <div className="flex w-52 shrink-0 flex-col bg-neutral-800">
        {/* アプリ名 */}
        <div className="px-4 pb-3 pt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">Protocol Maker</span>
            <span className="text-[10px] text-neutral-500">v{APP_VERSION}</span>
          </div>
        </div>
        <div className="mx-3 mb-2 border-t border-neutral-700" />
        {SIDE_TOP.map((item) => (
          <SideBtn
            key={item.key}
            label={item.label}
            isActive={panel === item.key}
            onClick={() => setPanel(item.key)}
          />
        ))}
        {/* スペーサー */}
        <div className="flex-1" />
        <div className="mx-3 mb-2 border-t border-neutral-700" />
        {SIDE_BOTTOM.map((item) => (
          <SideBtn
            key={item.key}
            label={item.label}
            isActive={panel === item.key}
            onClick={() => setPanel(item.key)}
          />
        ))}
        <div className="pb-4" />
      </div>

      {/* ---- コンテンツエリア ---- */}
      <div className="flex min-w-0 flex-1 overflow-auto bg-white p-10">
        {panel === "new"      && <NewPanel />}
        {panel === "open"     && <OpenPanel />}
        {panel === "saveAs"   && <SaveAsPanel />}
        {panel === "save"     && <SavePanel />}
        {panel === "export"   && <ExportPanel />}
        {panel === "settings" && <SettingsPanel />}
        {panel === "about"    && <AboutPanel />}
      </div>
    </div>
  );
}

function SideBtn({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full px-4 py-2.5 text-left text-sm transition-colors",
        isActive
          ? "bg-blue-600 text-white"
          : "text-neutral-300 hover:bg-neutral-700 hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ---- 新規作成 ----
function NewPanel() {
  return (
    <PanelShell title="新規作成" desc="空のプロトコルを新規作成します。">
      <Link
        href="/edit?new=1"
        className="inline-flex items-center justify-center rounded border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 active:bg-neutral-100"
      >
        + 空のプロトコルを作成
      </Link>
    </PanelShell>
  );
}

// ---- ファイルを開く ----
function OpenPanel() {
  const setDocument = useDocumentStore((s) => s.setDocument);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    if (!isTauri()) {
      setError("このアプリは Tauri 環境でのみ動作します。");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const path = await openPtclDialog();
      if (!path) return;
      const doc = await loadDocument(path);
      setDocument(doc, path);
      router.push("/edit");
    } catch {
      setError("ファイルの読み込みに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelShell title="ファイルを開く" desc=".ptcl ファイルをローカルから選んで開きます。">
      <ActionButton onClick={handleOpen} disabled={busy}>
        {busy ? "読み込み中…" : "ファイルを選択"}
      </ActionButton>
      {error && <ErrorMsg msg={error} />}
    </PanelShell>
  );
}

// ---- 名前を付けて保存 ----
function SaveAsPanel() {
  const doc      = useDocumentStore((s) => s.doc);
  const markSaved = useDocumentStore((s) => s.markSaved);
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError]   = useState<string | null>(null);

  async function handleSaveAs() {
    if (!doc) return;
    if (!isTauri()) { setError("Tauri 環境でのみ動作します。"); return; }
    try {
      setBusy(true);
      setStatus("idle");
      const defaultName = doc.meta.title.trim() || "untitled";
      const path = await savePtclDialog(defaultName);
      if (!path) return;
      const savePath = path.endsWith(".ptcl") ? path : `${path}.ptcl`;
      await saveDocument(savePath, doc);
      markSaved(savePath);
      setStatus("ok");
    } catch {
      setStatus("error");
      setError("保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelShell
      title="名前を付けて保存"
      desc="現在のドキュメントに名前を付けて .ptcl 形式でローカルに保存します。"
    >
      {!doc && (
        <p className="text-sm text-neutral-400">
          編集中のドキュメントがありません。先に「新規作成」から作成してください。
        </p>
      )}
      {doc && (
        <ActionButton onClick={handleSaveAs} disabled={busy}>
          {busy ? "保存中…" : "保存先を選択して保存"}
        </ActionButton>
      )}
      {status === "ok"    && <SuccessMsg msg="保存しました。" />}
      {status === "error" && <ErrorMsg   msg={error ?? "保存に失敗しました。"} />}
    </PanelShell>
  );
}

// ---- 上書き保存 ----
function SavePanel() {
  const doc       = useDocumentStore((s) => s.doc);
  const path      = useDocumentStore((s) => s.path);
  const markSaved = useDocumentStore((s) => s.markSaved);
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError]   = useState<string | null>(null);

  async function handleSave() {
    if (!doc || !path) return;
    if (!isTauri()) { setError("Tauri 環境でのみ動作します。"); return; }
    try {
      setBusy(true);
      setStatus("idle");
      await saveDocument(path, doc);
      markSaved(path);
      setStatus("ok");
    } catch {
      setStatus("error");
      setError("保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelShell
      title="上書き保存"
      desc="現在のファイルに上書き保存します。"
    >
      {!doc && (
        <p className="text-sm text-neutral-400">編集中のドキュメントがありません。</p>
      )}
      {doc && !path && (
        <p className="text-sm text-neutral-400">
          まだ保存先が設定されていません。「名前を付けて保存」を先に行ってください。
        </p>
      )}
      {doc && path && (
        <>
          <p className="mb-4 text-xs text-neutral-500 break-all">
            保存先：{path}
          </p>
          <ActionButton onClick={handleSave} disabled={busy}>
            {busy ? "保存中…" : "上書き保存"}
          </ActionButton>
        </>
      )}
      {status === "ok"    && <SuccessMsg msg="上書き保存しました。" />}
      {status === "error" && <ErrorMsg   msg={error ?? "保存に失敗しました。"} />}
    </PanelShell>
  );
}

// ---- エクスポート ----
function ExportPanel() {
  const setDocument = useDocumentStore((s) => s.setDocument);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!isTauri()) { setError("Tauri 環境でのみ動作します。"); return; }
    try {
      setBusy(true);
      setError(null);
      const path = await openPtclDialog();
      if (!path) return;
      const doc = await loadDocument(path);
      setDocument(doc, path);
      // 編集画面に遷移し、印刷ダイアログを自動起動（PDF として保存可能）
      router.push("/edit?print=1");
    } catch {
      setError("ファイルの読み込みに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelShell
      title="エクスポート"
      desc=".ptcl ファイルを PDF としてローカルに保存します。"
    >
      <ol className="mb-6 list-decimal pl-5 text-sm text-neutral-600 space-y-1">
        <li>下のボタンで書き出す .ptcl ファイルを選択します。</li>
        <li>印刷ダイアログが開いたら「PDF として保存」を選択します。</li>
      </ol>
      <ActionButton onClick={handleExport} disabled={busy}>
        {busy ? "読み込み中…" : "ファイルを選択して PDF 出力"}
      </ActionButton>
      {error && <ErrorMsg msg={error} />}
    </PanelShell>
  );
}

// ---- 設定 ----
function SettingsPanel() {
  return (
    <PanelShell title="設定" desc="アプリの設定を行います。">
      <p className="text-sm text-neutral-400">設定項目は今後追加予定です。</p>
    </PanelShell>
  );
}

// ---- 情報 ----
function AboutPanel() {
  return (
    <PanelShell title="情報" desc="">
      <dl className="space-y-3 text-sm">
        {[
          ["アプリ名",       "Protocol Maker"],
          ["バージョン",     `v${APP_VERSION}`],
          ["ステータス",     "beta"],
          ["用途",          "研究室内配布用 実験プロトコル フローチャートエディタ"],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-4">
            <dt className="w-24 shrink-0 text-neutral-400">{label}</dt>
            <dd className="text-neutral-800">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 max-w-lg text-xs text-neutral-400">
        このアプリは beta 版です。ご意見・不具合は研究室内の連絡先までお知らせください。
      </p>
    </PanelShell>
  );
}

// ============================================================
// 共通 UI パーツ
// ============================================================
function PanelShell({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-neutral-500">{desc}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded border px-5 py-2 text-sm font-medium shadow-sm transition-colors",
        disabled
          ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
          : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SuccessMsg({ msg }: { msg: string }) {
  return (
    <p className="mt-3 text-sm font-medium text-emerald-600">✓ {msg}</p>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="mt-3 text-sm text-red-500">{msg}</p>;
}
