import { create } from "zustand";

interface IShareLinkModal {
  isOpen: boolean;
  boardId: string;
  onOpen: (boardId: string) => void;
  onClose: () => void;
}

/** The "Read-only link" dialog of a board. */
export const useShareLinkModal = create<IShareLinkModal>((set) => ({
  isOpen: false,
  boardId: "",
  onOpen: (boardId) => set({ isOpen: true, boardId }),
  onClose: () => set({ isOpen: false, boardId: "" }),
}));
