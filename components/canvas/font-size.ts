import { Layer, LayerType, NoteLayer, TextLayer } from "@/types/canvas";
import type { BoardActions } from "@/lib/board-store/types";

import {
  noteLayerFontSize,
  stepFontSize,
  textLayerFontSize,
} from "./text-metrics";

export const hasFontSize = (
  layer: Layer | null | undefined
): layer is TextLayer | NoteLayer =>
  layer?.type === LayerType.Text || layer?.type === LayerType.Note;

/** The font size of a text layer or note. */
export const layerFontSize = (layer: TextLayer | NoteLayer) =>
  layer.type === LayerType.Text
    ? textLayerFontSize(layer)
    : noteLayerFontSize(layer);

/**
 * Makes the text of the selected text layers and notes one step larger
 * (1) or smaller (-1), all to the same size: the next step from the first
 * one's. Boxes grow to fit (see Text and Note). Returns false when nothing
 * selected has text.
 */
export const changeFontSize = (actions: BoardActions, direction: 1 | -1) => {
  const { layers } = actions.getSnapshot();
  const ids = actions.getSelection().filter((id) => hasFontSize(layers[id]));
  const first = layers[ids[0]];

  if (!hasFontSize(first)) return false;

  const fontSize = stepFontSize(layerFontSize(first), direction);

  actions.pauseHistory();
  for (const id of ids) {
    actions.updateLayer(id, { fontSize });
  }
  actions.resumeHistory();

  return true;
};
