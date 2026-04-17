"use client";
// 操作ブロック間の挿入位置を示す細い水平ライン。
// ホバーで青くなり、クリックでキャレットを設定する。
type Props = {
  index: number;      // beforeBlockIndex
  active: boolean;    // このギャップが選択中か
  onClick: () => void;
};

export function InsertGap({ active, onClick }: Props) {
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={[
        "group relative flex h-4 w-full cursor-pointer items-center justify-center select-none",
      ].join(" ")}
      title="ここに挿入"
    >
      {/* 水平ライン（ホバー or active で可視化） */}
      <div
        className={[
          "h-[2px] w-full rounded-full transition-colors",
          active
            ? "bg-blue-400"
            : "bg-transparent group-hover:bg-blue-200",
        ].join(" ")}
      />
      {/* active 時の中央 + ボタン */}
      {active && (
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-blue-400 px-1.5 text-[10px] font-bold leading-4 text-white">
          +
        </span>
      )}
    </div>
  );
}
