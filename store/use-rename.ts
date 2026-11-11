import { create } from "zustand";

/**
 * Which board's title is being edited in place (on its dashboard card or
 * in the board's top bar). One at a time.
 */
interface RenameState {
  editingId: string | null;
  start: (id: string) => void;
  stop: () => void;
}

export const useRename = create<RenameState>((set) => ({
  editingId: null,
  start: (editingId) => set({ editingId }),
  stop: () => set({ editingId: null }),
}));
