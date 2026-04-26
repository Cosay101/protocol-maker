"use client";
// 改列マーカー。列の末尾に表示され、ここで次の列へ分割されることを示す。
type Props = {
  onDelete: () => void;
};

export function ColumnBreakBlock({ onDelete }: Props) {
  return (
    <div className="group relative flex items-center gap-2 py-1 select-none">
      {/* ライン */}
      <div className="h-px flex-1 bg-blue-200" />
      {/* 削除ボタン（ホバー時のみ表示） */}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded px-1 text-xs text-blue-200 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
        aria-label="改列を削除"
      >
        ✕
      </button>
      <div className="h-px flex-1 bg-blue-200" />
    </div>
  );
}
