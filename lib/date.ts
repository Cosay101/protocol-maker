// 日付まわりの小ユーティリティ。ISO 8601 を保存形式の標準とする。

/** 現在時刻を ISO 8601 文字列で返す。 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 一覧画面向けの整形。年が同じなら月日だけ、違う年なら年も付ける。
 * 失敗した場合は入力文字列をそのまま返す。
 */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hhmm}`;
  }
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hhmm}`;
}
