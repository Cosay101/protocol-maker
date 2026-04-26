// 検索・置換 UI の状態を保持するストア。
// - query: 検索を実行済みの文字列（コンポーネントが参照してハイライトを描画する）
// - matchCount: 最後に検索した件数
import { create } from "zustand";

interface SearchState {
  isOpen: boolean;
  query: string;      // 確定済み検索文字列（空 = ハイライトなし）
  matchCount: number; // 最後の検索ヒット件数
  replaceText: string;

  setIsOpen: (v: boolean) => void;
  setQuery: (q: string) => void;
  setMatchCount: (n: number) => void;
  setReplaceText: (t: string) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: "",
  matchCount: 0,
  replaceText: "",

  setIsOpen: (isOpen) => set({ isOpen }),
  setQuery: (query) => set({ query }),
  setMatchCount: (matchCount) => set({ matchCount }),
  setReplaceText: (replaceText) => set({ replaceText }),
}));
