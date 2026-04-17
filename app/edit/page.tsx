"use client";
// Edit 画面。mainFlow 編集・PageHeader 入力・キーボードショートカットを統合する。
import { useEffect, useCallback } from "react";
import Link from "next/link";
import { useDocumentStore } from "@/stores/documentStore";
import { useUiStore } from "@/stores/uiStore";
import { MainFlow } from "@/components/edit/MainFlow";

const APP_VERSION = "0.1.0-beta.1";

export default function EditPage() {
  const createNew = useDocumentStore((s) => s.createNew);
  const doc = useDocumentStore((s) => s.doc);
  const isDirty = useDocumentStore((s) => s.isDirty);

  // 初回マウント時にドキュメントを初期化
  useEffect(() => {
    if (!doc) createNew();
  }, [doc, createNew]);

  if (!doc) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-neutral-400">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100 text-neutral-900">
      <TopMenu isDirty={isDirty} />
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="mx-auto my-8 flex flex-col gap-6" style={{ width: 794 }}>
          <PageCanvas />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Top menu — Office メニューバー相当（高さ 48px）
// ------------------------------------------------------------------
function TopMenu({ isDirty }: { isDirty: boolean }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <nav className="flex items-center gap-0.5">
        <Link
          href="/"
          className="flex items-center gap-1 rounded px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          <span className="text-xs">←</span>
          <span>ホーム</span>
        </Link>
        <div className="mx-1 h-5 w-px bg-neutral-200" />
        {(["ファイル", "編集", "挿入", "書式"] as const).map((label) => (
          <button
            key={label}
            type="button"
            className="rounded px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 disabled:cursor-default disabled:text-neutral-300"
            disabled
            title="次のステップで実装予定"
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        {isDirty && <span className="text-amber-500">● 未保存</span>}
        <span>v{APP_VERSION} (beta)</span>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------
// 紙面（A4 縦: 794×1123px @96dpi）
// ------------------------------------------------------------------
function PageCanvas() {
  const doc = useDocumentStore((s) => s.doc!);
  const insertOperation = useDocumentStore((s) => s.insertOperation);
  const updateOperationText = useDocumentStore((s) => s.updateOperationText);
  const deleteBlock = useDocumentStore((s) => s.deleteBlock);
  const caret = useUiStore((s) => s.caret);
  const setCaret = useUiStore((s) => s.setCaret);

  // ------ キーボードショートカット ------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // テキストエリアや input の中では親のハンドラを発火しない
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.isContentEditable
      )
        return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (caret.kind === "block") {
          e.preventDefault();
          deleteBlock(caret.blockId);
          setCaret({ kind: "none" });
        }
      }
      if (e.key === "Escape") {
        setCaret({ kind: "none" });
      }
      // gap 選択中に Enter → 空の operation を挿入
      if (e.key === "Enter" && caret.kind === "gap") {
        e.preventDefault();
        const newId = insertOperation(caret.beforeBlockIndex);
        setCaret({ kind: "block", blockId: newId });
      }
    },
    [caret, deleteBlock, insertOperation, setCaret],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ------ gap クリック → gap caret ------
  function handleGapClick(beforeBlockIndex: number) {
    setCaret({ kind: "gap", beforeBlockIndex });
  }

  // ------ gap caret 状態で紙面背景クリック → gap に operation を挿入 ------
  // gap 選択中に外をクリックしたら解除
  function handleCanvasClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    // ブロックや gap 自体のクリックでなければ選択解除
    if (target === e.currentTarget) {
      setCaret({ kind: "none" });
    }
  }

  return (
    <div
      className="relative bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
      style={{ width: 794, minHeight: 1123 }}
      onClick={handleCanvasClick}
    >
      <div className="flex w-full flex-col px-16 py-12">
        <PageHeader />
        {/* mainFlow 領域 */}
        <div className="mt-6 flex-1">
          <MainFlow
            mainFlow={doc.mainFlow}
            caret={caret}
            onGapClick={handleGapClick}
            onBlockSelect={(id) => setCaret({ kind: "block", blockId: id })}
            onOperationTextChange={updateOperationText}
            onOperationDelete={(id) => {
              deleteBlock(id);
              setCaret({ kind: "none" });
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// ページヘッダー（タイトル / 作成者 / 作成日 — 編集可能）
// ------------------------------------------------------------------
function PageHeader() {
  const meta = useDocumentStore((s) => s.doc?.meta);
  const setMeta = useDocumentStore((s) => s.setMeta);

  if (!meta) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 pb-4">
      <HeaderRow
        label="タイトル"
        value={meta.title}
        placeholder="無題のプロトコル"
        onChange={(v) => setMeta({ title: v })}
        large
      />
      <HeaderRow
        label="作成者"
        value={meta.author}
        placeholder="例: 山田 太郎"
        onChange={(v) => setMeta({ author: v })}
      />
      <HeaderRow
        label="作成日"
        value={meta.createdAt.slice(0, 10)}
        placeholder="YYYY-MM-DD"
        onChange={(v) => setMeta({ createdAt: v })}
      />
    </div>
  );
}

function HeaderRow({
  label,
  value,
  placeholder,
  onChange,
  large = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  large?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-neutral-400">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "flex-1 border-b border-transparent bg-transparent px-1 py-0.5 outline-none",
          "text-neutral-800 placeholder-neutral-300",
          "hover:border-neutral-200 focus:border-blue-300",
          large ? "text-base font-semibold" : "text-sm",
        ].join(" ")}
      />
    </div>
  );
}
