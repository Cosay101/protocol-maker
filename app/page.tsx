"use client";

// Home 画面（Office 風スタート画面の最小版）
// 2カラム: 左に縦メニュー / 右にアーカイブ一覧
// まずは dummyData を表示するのみ。metaStore 読み込みは次ステップで実装。
import { useMemo, useState } from "react";
import Link from "next/link";
import { dummyArchive } from "@/components/home/dummyData";
import { formatRelativeDate } from "@/lib/date";
import type { ArchiveEntry } from "@/types/ptcl";

const APP_VERSION = "0.1.0-beta.1";

type NavKey = "new" | "open" | "settings" | "about";

type NavItem = { key: NavKey; label: string };

const NAV_ITEMS: NavItem[] = [
  { key: "new", label: "新規作成" },
  { key: "open", label: "ファイルを開く" },
  { key: "settings", label: "設定" },
  { key: "about", label: "情報" },
];

export default function HomePage() {
  const [active, setActive] = useState<NavKey>("new");

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-50 text-neutral-900">
      <TopBanner />
      <div className="flex min-h-0 flex-1">
        <LeftNav active={active} onChange={setActive} />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {active === "new" && <NewActionView />}
          {active === "open" && <OpenActionView />}
          {active === "settings" && <SettingsView />}
          {active === "about" && <AboutView />}
        </main>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Top banner (beta + version)
// ------------------------------------------------------------------
function TopBanner() {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tracking-tight">
          Protocol Maker
        </span>
        <span className="text-xs text-neutral-500">(beta)</span>
      </div>
      <span className="text-xs text-neutral-400">v{APP_VERSION}</span>
    </header>
  );
}

// ------------------------------------------------------------------
// Left nav
// ------------------------------------------------------------------
function LeftNav(props: {
  active: NavKey;
  onChange: (k: NavKey) => void;
}) {
  return (
    <nav className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-neutral-200 bg-neutral-50 p-3">
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === props.active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => props.onChange(item.key)}
            className={
              "w-full rounded px-3 py-2 text-left text-sm transition-colors " +
              (isActive
                ? "bg-neutral-900 text-white"
                : "text-neutral-700 hover:bg-neutral-200")
            }
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

// ------------------------------------------------------------------
// New action (新規作成 + アーカイブ一覧)
// ------------------------------------------------------------------
function NewActionView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h1 className="text-lg font-semibold">新規作成</h1>
        <p className="mt-1 text-xs text-neutral-500">
          空のプロトコルを作成します。
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/edit?new=1"
            className="inline-flex items-center justify-center rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            空のプロトコルを作成
          </Link>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-sm font-semibold">最近使ったファイル</h2>
        </div>
        <ArchiveList entries={dummyArchive} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Open action placeholder
// ------------------------------------------------------------------
function OpenActionView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h1 className="text-lg font-semibold">ファイルを開く</h1>
        <p className="mt-1 text-xs text-neutral-500">
          ローカルの .ptcl ファイルを選んで開きます。
        </p>
        <button
          type="button"
          disabled
          className="mt-4 inline-flex cursor-not-allowed items-center justify-center rounded border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-400 shadow-sm"
          title="次のステップで実装予定"
        >
          ファイルを選択... (未実装)
        </button>
      </div>
      <ArchiveList entries={dummyArchive} />
    </div>
  );
}

// ------------------------------------------------------------------
// Settings placeholder
// ------------------------------------------------------------------
function SettingsView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-5">
      <h1 className="text-lg font-semibold">設定</h1>
      <p className="mt-1 text-xs text-neutral-500">
        テンプレート管理やアプリ設定を行います（次のステップで実装予定）。
      </p>
    </div>
  );
}

// ------------------------------------------------------------------
// About
// ------------------------------------------------------------------
function AboutView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-5">
      <h1 className="text-lg font-semibold">情報</h1>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="w-24 text-neutral-500">アプリ名</dt>
          <dd className="text-neutral-800">Protocol Maker</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 text-neutral-500">バージョン</dt>
          <dd className="text-neutral-800">{APP_VERSION}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 text-neutral-500">ステータス</dt>
          <dd className="text-neutral-800">beta</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 text-neutral-500">用途</dt>
          <dd className="text-neutral-800">
            研究室内配布用 実験プロトコル フローチャート エディタ
          </dd>
        </div>
      </dl>
      <p className="mt-6 max-w-2xl text-xs text-neutral-500">
        このアプリは beta 版です。ご意見・不具合は研究室内の連絡先までお知らせください。
      </p>
    </div>
  );
}

// ------------------------------------------------------------------
// Archive list (ピン留め上→通常 の順)
// ------------------------------------------------------------------
function ArchiveList(props: { entries: ArchiveEntry[] }) {
  const sorted = useMemo(() => {
    const pinned = props.entries.filter((e) => e.pinned);
    const others = props.entries.filter((e) => !e.pinned);
    const byUpdated = (a: ArchiveEntry, b: ArchiveEntry) =>
      b.updatedAt.localeCompare(a.updatedAt);
    return [...pinned.sort(byUpdated), ...others.sort(byUpdated)];
  }, [props.entries]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-neutral-400">
        ここに最近使ったファイルが並びます。
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="w-10 px-3 py-2 font-normal"></th>
            <th className="px-3 py-2 font-normal">タイトル</th>
            <th className="w-40 px-3 py-2 font-normal">最終更新</th>
            <th className="w-10 px-3 py-2 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <ArchiveRow key={entry.id} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArchiveRow(props: { entry: ArchiveEntry }) {
  const { entry } = props;
  const displayTitle = entry.title ?? fileNameFromPath(entry.path);
  const cls = entry.exists
    ? "hover:bg-neutral-50"
    : "bg-neutral-50/60 text-neutral-400";
  return (
    <tr className={"border-t border-neutral-100 " + cls}>
      <td className="px-3 py-2 align-middle">
        {entry.pinned ? (
          <span
            aria-label="ピン留め"
            title="ピン留め"
            className="inline-block text-[11px] text-amber-600"
          >
            ●
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center gap-2">
          <span
            className={
              entry.exists
                ? "truncate font-medium text-neutral-800"
                : "truncate font-medium"
            }
          >
            {displayTitle}
          </span>
          {!entry.exists && (
            <span
              title="ローカルに見つかりません"
              className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700"
            >
              見つかりません
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-neutral-400">
          {entry.path}
        </div>
      </td>
      <td className="px-3 py-2 align-middle text-xs text-neutral-500">
        {formatRelativeDate(entry.updatedAt)}
      </td>
      <td className="px-3 py-2 align-middle text-right text-neutral-400">⋯</td>
    </tr>
  );
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function fileNameFromPath(path: string): string {
  const last = path.replaceAll("\\", "/").split("/").filter(Boolean).pop();
  if (!last) return path;
  return last.endsWith(".ptcl") ? last.slice(0, -".ptcl".length) : last;
}
