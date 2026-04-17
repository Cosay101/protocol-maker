"use client";

// Edit 画面の骨組み (beta 1 用プレースホルダ)。
// - 上部に簡易メニュー帯
// - 中央にドロップシャドウ付きの紙面
// - ページ先頭に タイトル / 作成者 / 作成日 のヘッダのみ
// mainFlow レンダリング・自由配置レイヤー・ショートカットは次のステップで実装する。
import Link from "next/link";

export default function EditPage() {
  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100 text-neutral-900">
      <TopMenu />
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="mx-auto my-8 flex w-[794px] max-w-full flex-col gap-6">
          <Page />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Top menu (dropdown のダミー。次ステップでドロップダウン化)
// ------------------------------------------------------------------
function TopMenu() {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 text-sm">
      <nav className="flex items-center gap-1 text-neutral-600">
        <Link
          href="/"
          className="rounded px-2 py-1 hover:bg-neutral-100"
          title="ホームへ戻る"
        >
          ← ホーム
        </Link>
        <MenuButton label="ファイル" />
        <MenuButton label="編集" />
        <MenuButton label="挿入" />
        <MenuButton label="書式" />
      </nav>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">未保存</span>
        <span className="text-xs text-neutral-400">(beta)</span>
      </div>
    </header>
  );
}

function MenuButton(props: { label: string }) {
  return (
    <button
      type="button"
      className="cursor-default rounded px-2 py-1 text-neutral-400"
      title="次のステップで実装予定"
      disabled
    >
      {props.label}
    </button>
  );
}

// ------------------------------------------------------------------
// 紙面 (A4 縦, 794x1123 @96dpi)
// ------------------------------------------------------------------
function Page() {
  return (
    <div
      className="relative bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
      style={{ width: 794, height: 1123 }}
    >
      <div className="flex h-full w-full flex-col px-16 py-12">
        <PageHeader />
        <div className="mt-8 flex-1">
          <EmptyFlowPlaceholder />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// 1 ページ目ヘッダー（タイトル / 作成者 / 作成日）
// ------------------------------------------------------------------
function PageHeader() {
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 pb-4 text-sm">
      <HeaderRow label="タイトル" placeholder="無題のプロトコル" />
      <HeaderRow label="作成者" placeholder="例: 山田 太郎" />
      <HeaderRow label="作成日" placeholder="YYYY-MM-DD" />
    </div>
  );
}

function HeaderRow(props: { label: string; placeholder: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-neutral-500">
        {props.label}
      </span>
      <input
        type="text"
        disabled
        placeholder={props.placeholder}
        className="flex-1 border-b border-transparent bg-transparent px-1 py-0.5 text-sm text-neutral-500 placeholder-neutral-300 outline-none"
        title="次のステップで編集可能になります"
      />
    </div>
  );
}

function EmptyFlowPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-neutral-300">
      ここにフローチャートが描画されます
    </div>
  );
}
