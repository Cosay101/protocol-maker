"use client";
// 図・画像ライブラリパレット
// - アップロード済み画像のサムネイル一覧
// - クリックで挿入、ホバーで削除ボタン表示
// - 下部に「画像をアップロード」ボタン（複数ファイル対応）
import { useRef, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useImageLibraryStore, type LibraryImage } from "@/stores/imageLibraryStore";

type Props = {
  /** トリガーボタンの位置（fixed 配置の基準） */
  anchorRect: DOMRect;
  /** 画像サムネイルをクリックしたときのコールバック */
  onInsert: (img: LibraryImage) => void;
  /** パレットを閉じるコールバック */
  onClose: () => void;
};

export function ImagePalette({ anchorRect, onInsert, onClose }: Props) {
  const images    = useImageLibraryStore((s) => s.images);
  const addImage  = useImageLibraryStore((s) => s.addImage);
  const removeImage = useImageLibraryStore((s) => s.removeImage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // パネル外クリックで閉じる
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // 次フレームで登録（今のクリックで即閉じないように）
    const id = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", onPointerDown);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  // ファイル選択 → FileReader で data URL に変換してライブラリへ
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setUploadError(null);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          if (!src) return;
          try {
            addImage(file.name, src);
          } catch (err) {
            // IndexedDB ストレージでも容量超過や権限エラーが起きた場合
            const msg =
              err instanceof DOMException
                ? `保存に失敗しました: ${err.message}`
                : "画像の保存に失敗しました。";
            setUploadError(msg);
            console.error("[ImagePalette] addImage error:", err);
          }
        };
        reader.onerror = () => {
          setUploadError(`「${file.name}」の読み込みに失敗しました。`);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    },
    [addImage],
  );

  // パネル幅 (w-72 = 288px) が画面右端をはみ出さないよう left を補正
  const PANEL_W = 288;
  const clampedLeft = Math.min(
    anchorRect.left,
    Math.max(8, (typeof window !== "undefined" ? window.innerWidth : 1280) - PANEL_W - 8),
  );

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: anchorRect.bottom + 4,
        left: clampedLeft,
        zIndex: 9999,
      }}
      className="w-72 rounded-xl border border-neutral-200 bg-white shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-600">図・画像ライブラリ</span>
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* 画像グリッド */}
      <div className="max-h-60 overflow-y-auto p-2">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-4xl opacity-20">🖼</span>
            <p className="mt-2 text-xs text-neutral-400">画像がまだありません</p>
            <p className="text-[10px] text-neutral-300">下のボタンからアップロード</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative cursor-pointer overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 hover:border-blue-400 hover:shadow-sm"
                style={{ aspectRatio: "1" }}
                onClick={() => { onInsert(img); onClose(); }}
                title={img.name}
              >
                {/* サムネイル */}
                <img
                  src={img.src}
                  alt={img.name}
                  className="h-full w-full object-contain p-1.5"
                />
                {/* ファイル名 (ホバー時) */}
                <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[8px] text-white truncate opacity-0 transition-opacity group-hover:opacity-100">
                  {img.name}
                </div>
                {/* 削除ボタン */}
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-neutral-500/80 text-[8px] text-white hover:bg-red-500 group-hover:flex"
                  onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                  title="ライブラリから削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* アップロードボタン */}
      <div className="border-t border-neutral-100 p-2.5">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2.5 text-xs text-neutral-500 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-sm">＋</span>
          <span>画像・図ファイルをアップロード</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="mt-1.5 text-center text-[9px] text-neutral-300">
          PNG / JPG / SVG / GIF / WebP 対応
        </p>
        {uploadError && (
          <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-center text-[10px] text-red-500">
            {uploadError}
          </p>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
