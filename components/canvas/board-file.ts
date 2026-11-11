import { parseSnapshot } from "@/lib/board-store/validate";
import type { BoardSnapshot } from "@/lib/board-store/types";

import { download } from "./export";

// "Save to…" and "Open" in the board menu: the board as a file on the
// user's computer, like Excalidraw's .excalidraw files.

const FILE_TYPE = "board";
const FILE_VERSION = 1;
/** Same as the guest board upload limit (app/api/guest-board/route.ts). */
const MAX_FILE_BYTES = 2_000_000;

export const BOARD_FILE_ACCEPT = ".board,.json,application/json";

/** Downloads the board as `<name>.board` (JSON). */
export const saveBoardFile = (snapshot: BoardSnapshot, name: string) => {
  const file = {
    type: FILE_TYPE,
    version: FILE_VERSION,
    layerIds: snapshot.layerIds,
    layers: snapshot.layers,
    ...(snapshot.background ? { background: snapshot.background } : {}),
  };

  download(
    new Blob([JSON.stringify(file)], { type: "application/json" }),
    `${name}.board`
  );
};

/**
 * Reads a file saved with "Save to…". Throws with a message for the user
 * when it isn't one.
 */
export const readBoardFile = async (file: File): Promise<BoardSnapshot> => {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That file is too big for a board");
  }

  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a board");
  }

  const snapshot = parseSnapshot(data);
  if (!snapshot) throw new Error("That file isn't a board");

  return snapshot;
};
