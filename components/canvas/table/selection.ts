import { create } from "zustand";

import { rangeOf, type CellRange, type CellRef } from "./model";

// Which cells of which table are selected. Shared by the table on the
// canvas and the style panel next to it. Only one table has cells selected
// at a time.

interface TableSelectionState {
  layerId: string | null;
  /** Where the selection started; `active` is the cell the keyboard is on. */
  anchor: CellRef;
  active: CellRef;
  select: (layerId: string, anchor: CellRef, active: CellRef) => void;
  clear: () => void;
}

const ORIGIN: CellRef = { r: 0, c: 0 };

export const useTableSelection = create<TableSelectionState>((set) => ({
  layerId: null,
  anchor: ORIGIN,
  active: ORIGIN,
  select: (layerId, anchor, active) => set({ layerId, anchor, active }),
  clear: () => set({ layerId: null, anchor: ORIGIN, active: ORIGIN }),
}));

/** The selected cells of a table as a range, or null when it has none. */
export const selectedRange = (
  state: Pick<TableSelectionState, "layerId" | "anchor" | "active">,
  layerId: string
): CellRange | null =>
  state.layerId === layerId ? rangeOf(state.anchor, state.active) : null;
