// 起動画面のダミーデータ。metaStore が空のときのフォールバックとしても使える。
// Tauri fs 永続化が実装されたら削除予定。
import type { ArchiveEntry } from "@/types/ptcl";

export const dummyArchive: ArchiveEntry[] = [
  {
    id: "p_sample_cell_fixation",
    path: "C:\\Users\\user\\Documents\\protocols\\fixation.ptcl",
    title: "HeLa 細胞 固定プロトコル (サンプル)",
    updatedAt: "2026-04-15T14:30:00+09:00",
    lastOpenedAt: "2026-04-16T10:12:00+09:00",
    pinned: true,
    exists: true,
  },
  {
    id: "p_01HXABC_MINIPREP",
    path: "/Users/user/Documents/protocols/miniprep.ptcl",
    title: "Miniprep プロトコル",
    updatedAt: "2026-04-12T11:00:00+09:00",
    lastOpenedAt: "2026-04-14T09:00:00+09:00",
    pinned: false,
    exists: true,
  },
  {
    id: "p_01HXDEF_WESTERN",
    path: "D:\\old\\western-blot.ptcl",
    title: "Western Blot (旧)",
    updatedAt: "2026-03-01T08:00:00+09:00",
    lastOpenedAt: "2026-03-10T10:00:00+09:00",
    pinned: false,
    exists: false,
  },
  {
    id: "p_01HXGHI_UNTITLED",
    path: "/Users/user/Desktop/untitled.ptcl",
    // title が null → UI はファイル名フォールバック
    title: null,
    updatedAt: "2026-04-01T17:00:00+09:00",
    lastOpenedAt: "2026-04-01T17:10:00+09:00",
    pinned: false,
    exists: true,
  },
];
