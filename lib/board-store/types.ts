import type { Color, Layer, Point, XYWH } from "@/types/canvas";

/** A board holds at most this many layers. */
export const MAX_LAYERS = 100;

export type PencilDraft = [x: number, y: number, pressure: number][];

/** The saved content of a board: what Liveblocks Storage holds. */
export type BoardSnapshot = {
  layers: Record<string, Layer>;
  /** Layer ids in drawing order (last is on top). */
  layerIds: string[];
};

/**
 * Everything the canvas changes. Implemented by Liveblocks (shared boards)
 * and by the browser's storage (guest boards). Every function is stable for
 * the lifetime of the store.
 */
export interface BoardActions {
  /**
   * Adds a layer on top. Returns its id, or null when the board already has
   * MAX_LAYERS layers.
   */
  insertLayer(layer: Layer, options?: { select?: boolean }): string | null;
  updateLayer(id: string, patch: Partial<Layer>): void;
  translateLayers(ids: readonly string[], offset: Point): void;
  setLayersFill(ids: readonly string[], fill: Color): void;
  /** Deletes the layers and clears the selection. */
  deleteLayers(ids: readonly string[]): void;
  bringToFront(ids: readonly string[]): void;
  sendToBack(ids: readonly string[]): void;

  /** Selection changes can be undone when `addToHistory` is set. */
  setSelection(ids: string[], options?: { addToHistory?: boolean }): void;
  getSelection(): readonly string[];
  /** The current content, read on demand (not reactive). */
  getSnapshot(): BoardSnapshot;

  /** Shared with other users on a live board; a no-op for guest boards. */
  setCursor(point: Point | null): void;
  setPencilDraft(draft: PencilDraft | null, color?: Color): void;
  getPencilDraft(): PencilDraft | null;

  undo(): void;
  redo(): void;
  /**
   * While paused, changes are grouped into a single history step (used for
   * drags, so one undo reverts the whole move).
   */
  pauseHistory(): void;
  resumeHistory(): void;
}

/**
 * Reactive reads are hooks, so each store can use its own subscription
 * mechanism (Liveblocks hooks, or a zustand store).
 */
export interface BoardStore {
  /** Layers other users have selected, mapped to that user's color. */
  useRemoteSelections(): Record<string, string>;
  useLayerIds(): readonly string[];
  useLayer(id: string): Layer | undefined;
  useSelection(): readonly string[];
  /** Bounding box of the selected layers, or null when nothing is selected. */
  useSelectionBounds(): XYWH | null;
  usePencilDraft(): PencilDraft | null;
  useLayerCount(): number;
  useCanUndo(): boolean;
  useCanRedo(): boolean;
  actions: BoardActions;
}
