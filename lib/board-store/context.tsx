"use client";

import { createContext, useContext } from "react";

import type { BoardStore } from "./types";

export const BoardStoreContext = createContext<BoardStore | null>(null);

/** The board the canvas is editing; see LiveblocksBoardStoreProvider and
 *  LocalBoardStoreProvider. */
export const useBoardStore = (): BoardStore => {
  const store = useContext(BoardStoreContext);

  if (!store) {
    throw new Error("useBoardStore must be used inside a board store provider");
  }

  return store;
};
