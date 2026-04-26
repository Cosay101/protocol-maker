"use client";
// 検索・置換パレット
//
// - 「検索」ボタン: 入力文字列でドキュメント全体を検索し件数を表示、
//                   各コンポーネントは searchStore.query を参照して黄色ハイライトを描画する。
// - 「すべて置換」ボタン: query を replaceText に一括置換する。
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchStore } from "@/stores/searchStore";
import { useDocumentStore } from "@/stores/documentStore";
import { countMatchesInDoc } from "@/lib/ptcl/search";

type Props = {
  onClose: () => void;
};

export function FindReplacePalette({ onClose }: Props) {
  const [inputQuery, setInputQuery]     = useState("");
  const [inputReplace, setInputReplace] = useState("");
  const [searched, setSearched]         = useState(false);
  const [replaceMsg, setReplaceMsg]     = useState<string | null>(null);

  const { setQuery, setMatchCount, matchCount } = useSearchStore();
  const replaceAll = useDocumentStore((s) => s.replaceAll);
  const doc        = useDocumentStore((s) => s.doc);

  const queryInputRef = useRef<HTMLInputElement>(null);

  // 開いたときに検索欄にフォーカス
  useEffect(() => {
    queryInputRef.current?.focus();
  }, []);

  // パレットを閉じたときにハイライトをクリア
  const handleClose = useCallback(() => {
    setQuery("");
    setMatchCount(0);
    onClose();
  }, [setQuery, setMatchCount, onClose]);

  // Escape キーで閉じる
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  function handleSearch() {
    const q = inputQuery.trim();
    if (!q || !doc) return;
    const n = countMatchesInDoc(doc, q);
    setQuery(q);
    setMatchCount(n);
    setSearched(true);
    setReplaceMsg(null);
  }

  function handleReplaceAll() {
    const q = inputQuery.trim();
    if (!q || !doc) return;

    // まず検索を確定してからカウント取得
    const n = countMatchesInDoc(doc, q);
    if (n === 0) {
      setQuery(q);
      setMatchCount(0);
      setSearched(true);
      setReplaceMsg("一致する文字列が見つかりませんでした");
      return;
    }

    replaceAll(q, inputReplace);
    // 置換後はハイライトをクリア
    setQuery("");
    setMatchCount(0);
    setSearched(false);
    setReplaceMsg(`${n} 件を置換しました`);
  }

  const panel = (
    <div
      style={{
        position: "fixed",
        top: 62,   // リボンの下
        right: 16,
        zIndex: 9999,
        width: 320,
      }}
      className="rounded-xl border border-neutral-200 bg-white shadow-2xl"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
        <span className="text-sm font-semibold text-neutral-700">検索・置換</span>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          onClick={handleClose}
        >
          ✕
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* 検索エリア */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-neutral-500">検索</label>
          <div className="flex gap-2">
            <input
              ref={queryInputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => { setInputQuery(e.target.value); setSearched(false); setReplaceMsg(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="検索する文字列…"
              className="flex-1 rounded border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="button"
              disabled={!inputQuery.trim()}
              onClick={handleSearch}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              検索
            </button>
          </div>
          {/* 件数表示 */}
          {searched && (
            <div className={[
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
              matchCount > 0
                ? "bg-yellow-50 text-yellow-700"
                : "bg-neutral-50 text-neutral-500",
            ].join(" ")}>
              {matchCount > 0 ? (
                <>
                  <span className="inline-block h-3 w-3 rounded-sm bg-yellow-300" />
                  <span><strong>{matchCount}</strong> 件見つかりました</span>
                </>
              ) : (
                <span>一致する文字列が見つかりませんでした</span>
              )}
            </div>
          )}
        </div>

        {/* 区切り */}
        <div className="h-px bg-neutral-100" />

        {/* 置換エリア */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-neutral-500">置換後の文字列</label>
          <input
            type="text"
            value={inputReplace}
            onChange={(e) => setInputReplace(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleReplaceAll(); }}
            placeholder="置換する文字列（空白で削除）"
            className="rounded border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          />
          <button
            type="button"
            disabled={!inputQuery.trim()}
            onClick={handleReplaceAll}
            className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            すべて置換
          </button>
          {/* 置換結果メッセージ */}
          {replaceMsg && (
            <div className="rounded px-2 py-1 text-xs bg-green-50 text-green-700">
              {replaceMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
