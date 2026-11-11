import { create } from "zustand";

/** The Share dialog of the open board (Share button, or the menu). */
export const useShareDialog = create<{
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}>((set) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
}));
