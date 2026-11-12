import {
  LayerType,
  type Color,
  type Layer,
  type Point,
} from "@/types/canvas";
import type { BoardSnapshot } from "@/lib/board-store/types";

import { layerContainsPoint } from "./hit-test";
import { cellAt, rangeOf, styleRange } from "./table/model";

const hexToColor = (hex: string): Color => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

/**
 * What filling `layer` at `point` with `hex` changes (null `hex` empties
 * it), or null when the layer can't be filled.
 */
export const fillPatch = (
  layer: Layer,
  point: Point,
  hex: string | null
): Partial<Layer> | null => {
  switch (layer.type) {
    case LayerType.Rectangle:
    case LayerType.Ellipse:
    case LayerType.Diamond:
      return {
        fillStyle: "none",
        backgroundColor: hex ? hexToColor(hex) : null,
      };
    case LayerType.Note:
      return hex ? { fill: hexToColor(hex), fillStyle: "solid" } : { fillStyle: "none" };
    case LayerType.Table: {
      const cell = cellAt(layer, point);
      if (!cell) return null;

      return styleRange(layer, rangeOf(cell, cell), { g: hex ?? undefined });
    }
    default:
      return null;
  }
};

/** The layer the bucket fills at `point`: the topmost one it can fill. */
export const fillTargetAt = (
  snapshot: BoardSnapshot,
  point: Point,
  hex: string | null
) => {
  for (let i = snapshot.layerIds.length - 1; i >= 0; i--) {
    const id = snapshot.layerIds[i];
    const layer = snapshot.layers[id];
    if (!layer || !layerContainsPoint(layer, point)) continue;

    const patch = fillPatch(layer, point, hex);
    if (patch) return { id, patch };
  }

  return null;
};
