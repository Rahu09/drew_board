"use client";

import { useEffect } from "react";

import {
  CanvasMode,
  CanvasState,
  Layer,
  LayerType,
  Point,
} from "@/types/canvas";
import { MAX_LAYERS, type BoardActions } from "@/lib/board-store/types";

import { notifyLayerLimit } from "./layer-limit";
import { changeFontSize } from "./font-size";

/** How far copies land from the originals (canvas units). */
const COPY_OFFSET = 20;

/**
 * Layers copied with Ctrl+C. Kept in memory for this tab, so it also works
 * between boards opened one after the other.
 */
let clipboard: { layers: Layer[]; pastes: number } = { layers: [], pastes: 0 };

/** Tool shortcuts (no modifier keys). */
const TOOLS: Record<string, CanvasState> = {
  v: { mode: CanvasMode.None },
  t: { mode: CanvasMode.Inserting, layerType: LayerType.Text },
  n: { mode: CanvasMode.Inserting, layerType: LayerType.Note },
  r: { mode: CanvasMode.Inserting, layerType: LayerType.Rectangle },
  o: { mode: CanvasMode.Inserting, layerType: LayerType.Ellipse },
  a: { mode: CanvasMode.Inserting, layerType: LayerType.Arrow },
  d: { mode: CanvasMode.Inserting, layerType: LayerType.Diamond },
  l: { mode: CanvasMode.Inserting, layerType: LayerType.Line },
  f: { mode: CanvasMode.Inserting, layerType: LayerType.Frame },
  g: { mode: CanvasMode.Inserting, layerType: LayerType.Table },
  b: { mode: CanvasMode.Bucket },
  p: { mode: CanvasMode.Pencil },
  h: { mode: CanvasMode.Hand },
  e: { mode: CanvasMode.Eraser, erasing: null },
  k: { mode: CanvasMode.Laser },
};

/** Menu actions with a shortcut. */
export type MenuShortcut = "palette" | "help" | "save" | "open" | "export";

/** Typing in a field, a text layer or a dialog: leave the keys alone. */
export const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [role=dialog], [role=menu]") !==
      null
  );
};

const copyOf = (layer: Layer, offset: Point): Layer => ({
  ...structuredClone(layer),
  x: layer.x + offset.x,
  y: layer.y + offset.y,
});

/**
 * Adds copies of the layers, moved by `offset`, as one undo step and
 * selects them. All or nothing: when they don't fit under MAX_LAYERS,
 * nothing is added.
 */
export const insertLayerCopies = (
  actions: BoardActions,
  layers: readonly Layer[],
  offset: Point
) => {
  if (layers.length === 0) return;

  if (actions.getSnapshot().layerIds.length + layers.length > MAX_LAYERS) {
    notifyLayerLimit();
    return;
  }

  actions.pauseHistory();
  const ids = layers
    .map((layer) => actions.insertLayer(copyOf(layer, offset)))
    .filter((id): id is string => id !== null);
  actions.setSelection(ids, { addToHistory: true });
  actions.resumeHistory();
};

/**
 * Pastes the layers copied with Mod+C or Mod+X, each paste a little further
 * along. Returns false when nothing was copied.
 */
export const pasteCopiedLayers = (actions: BoardActions) => {
  if (clipboard.layers.length === 0) return false;

  clipboard.pastes += 1;
  const step = COPY_OFFSET * clipboard.pastes;
  insertLayerCopies(actions, clipboard.layers, { x: step, y: step });
  return true;
};

/** Mod+D: copies of the selected layers, a little along, selected. */
export const duplicateSelection = (actions: BoardActions) =>
  insertLayerCopies(actions, selectedLayers(actions), {
    x: COPY_OFFSET,
    y: COPY_OFFSET,
  });

/** The selected layers, in drawing order. */
export const selectedLayers = (actions: BoardActions) => {
  const selection = new Set(actions.getSelection());
  const { layers, layerIds } = actions.getSnapshot();

  return layerIds
    .filter((id) => selection.has(id))
    .map((id) => layers[id])
    .filter((layer): layer is Layer => layer !== undefined);
};

interface CanvasShortcutsOptions {
  actions: BoardActions;
  /** Only the view keys (zoom, fit) work. */
  readOnly: boolean;
  /** Whether C starts a comment (boards with comments). */
  hasComments: boolean;
  /** I: pick an image to upload. */
  pickImage: () => void;
  setCanvasState: (state: CanvasState) => void;
  /** Leaves pen or insert mode: drops a half-drawn stroke. */
  cancelTool: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;
  /** Mod+F: the sidebar's search. */
  openSearch: () => void;
  /** Mod+/, ?, Mod+S, Mod+O, Mod+Shift+E. */
  onMenuShortcut: (shortcut: MenuShortcut) => void;
}

/**
 * Board keyboard shortcuts. "Mod" is Ctrl, or ⌘ on a Mac.
 *
 * - V, T, N, R, D, O, A, L, P: select, text, note, rectangle, diamond,
 *   ellipse, arrow, line, pen
 * - G: table, F: frame, B: bucket fill
 * - I: add an image; C: comment (boards with comments)
 * - Delete / Backspace: delete the selection
 * - Mod+A select all, Mod+D duplicate, Mod+C / Mod+X copy, cut (paste is
 *   the browser's paste event, handled by the canvas, so images work too)
 * - Mod+] / Mod+[: bring forward, send backward (with Shift: to front, back)
 * - Mod+Shift+> / Mod+Shift+<: larger, smaller text (text and notes)
 * - Mod+Z undo, Mod+Shift+Z or Mod+Y redo
 * - Mod+= / Mod+- zoom, Mod+0 100%, Shift+1 fit to screen
 * - Mod+F: search the board's text (sidebar)
 * - Mod+/ command palette, ? shortcuts, Mod+S save to a file, Mod+O open
 *   one, Mod+Shift+E export an image
 * - H, E, K: hand, eraser, laser pointer
 * - Escape: stop editing text, leave the tool, clear the selection
 */
export const useCanvasShortcuts = ({
  actions,
  readOnly,
  hasComments,
  pickImage,
  setCanvasState,
  cancelTool,
  zoomIn,
  zoomOut,
  resetZoom,
  fitToScreen,
  openSearch,
  onMenuShortcut,
}: CanvasShortcutsOptions) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;

      if (e.key === "Escape") {
        if (target instanceof HTMLElement && target.isContentEditable) {
          target.blur();
          return;
        }
        if (isTypingTarget(target)) return;

        cancelTool();
        if (actions.getSelection().length > 0) {
          actions.setSelection([], { addToHistory: true });
        }
        return;
      }

      if (isTypingTarget(target) || e.isComposing) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && !e.altKey && !e.shiftKey && key === "f") {
        e.preventDefault();
        openSearch();
        return;
      }

      const menuShortcut: MenuShortcut | null =
        mod && !e.altKey && (e.key === "/" || e.code === "Slash")
          ? "palette"
          : mod && !e.altKey && !e.shiftKey && key === "s"
            ? "save"
            : mod && !e.altKey && !e.shiftKey && key === "o" && !readOnly
              ? "open"
              : mod && !e.altKey && e.shiftKey && key === "e"
                ? "export"
                : !mod && !e.altKey && e.key === "?"
                  ? "help"
                  : null;
      if (menuShortcut) {
        e.preventDefault();
        onMenuShortcut(menuShortcut);
        return;
      }

      if (readOnly) {
        if (mod && (key === "=" || key === "+")) zoomIn();
        else if (mod && key === "-") zoomOut();
        else if (mod && key === "0") resetZoom();
        else if (e.shiftKey && e.code === "Digit1") fitToScreen();
        else return;

        e.preventDefault();
        return;
      }

      if (mod && !e.altKey) {
        let handled = true;

        // Mod+Shift+> / Mod+Shift+<: by key position, whatever the layout.
        if (e.shiftKey && (e.code === "Period" || e.code === "Comma")) {
          changeFontSize(actions, e.code === "Period" ? 1 : -1);
        } else if (key === "z" && e.shiftKey) actions.redo();
        else if (key === "z") actions.undo();
        else if (key === "y") actions.redo();
        else if (key === "a") {
          actions.setSelection([...actions.getSnapshot().layerIds], {
            addToHistory: true,
          });
        } else if (key === "d") {
          duplicateSelection(actions);
        } else if (key === "c" || key === "x") {
          const layers = selectedLayers(actions);
          if (layers.length === 0) return;

          clipboard = { layers: structuredClone(layers), pastes: 0 };
          if (key === "x") actions.deleteLayers(actions.getSelection());
        } else if (e.code === "BracketRight" || e.code === "BracketLeft") {
          // Mod+] / Mod+[ one step; with Shift, all the way (by key position).
          const all = e.shiftKey;
          actions.moveLayers(
            actions.getSelection(),
            e.code === "BracketRight" ? (all ? "front" : "forward") : all ? "back" : "backward"
          );
        }
        else if (key === "=" || key === "+") zoomIn();
        else if (key === "-") zoomOut();
        else if (key === "0") resetZoom();
        else handled = false;

        if (handled) e.preventDefault();
        return;
      }

      if (e.altKey || mod) return;

      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        fitToScreen();
        return;
      }

      if (key === "delete" || key === "backspace") {
        const selection = actions.getSelection();

        if (selection.length > 0) {
          e.preventDefault();
          actions.deleteLayers(selection);
        }
        return;
      }

      if (e.shiftKey) return;

      if (key === "i") {
        e.preventDefault();
        pickImage();
        return;
      }

      if (key === "c" && hasComments) {
        e.preventDefault();
        cancelTool();
        setCanvasState({ mode: CanvasMode.Comment });
        return;
      }

      const tool = TOOLS[key];
      if (tool) {
        e.preventDefault();
        cancelTool();
        setCanvasState(tool);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    actions,
    readOnly,
    hasComments,
    pickImage,
    setCanvasState,
    cancelTool,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    openSearch,
    onMenuShortcut,
  ]);
};
