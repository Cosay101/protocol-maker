// ユーザー定型文テンプレートのストア。
// MVP の雛形：在庫を保持するだけ。tauri fs 永続化は次のステップ。
import { create } from "zustand";
import type { Template } from "@/types/ptcl";

export type TemplateState = {
  templates: Template[];

  // ---- actions ----
  setTemplates: (templates: Template[]) => void;
  addTemplate: (template: Template) => void;
  updateTemplate: (id: string, patch: Partial<Template>) => void;
  removeTemplate: (id: string) => void;
  togglePin: (id: string) => void;
};

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],

  setTemplates: (templates) => set({ templates }),
  addTemplate: (template) =>
    set((s) => ({ templates: [...s.templates, template] })),
  updateTemplate: (id, patch) =>
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  removeTemplate: (id) =>
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
  togglePin: (id) =>
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, pinned: !t.pinned } : t,
      ),
    })),
}));
