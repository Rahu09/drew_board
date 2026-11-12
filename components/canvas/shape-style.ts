import { colorToCss } from "@/lib/utils";
import {
  LayerType,
  type DiamondLayer,
  type EllipseLayer,
  type RectangleLayer,
} from "@/types/canvas";

import type { ShapeSpec } from "./rough-shape";
import { seedFromId } from "./rough-shape";

/** Width of the invisible band around outlines that picks them up. */
export const HIT_STROKE_WIDTH = 14;
export const OUTLINE_WIDTH = 2;

/**
 * How a rectangle or ellipse is drawn.
 *
 * fillStyle "none": `fill` is the outline and `backgroundColor` the inside
 * (none or null: see-through). Otherwise (older layers) the whole shape is
 * `fill`, with no outline. Without a roughness the lines are clean, and a
 * rectangle without edges has sharp corners.
 */
export const shapeSpec = (
  id: string,
  layer: RectangleLayer | EllipseLayer | DiamondLayer
): ShapeSpec => {
  const color = layer.fill ? colorToCss(layer.fill) : "#000";
  const isOutline = layer.fillStyle === "none";

  return {
    kind:
      layer.type === LayerType.Rectangle
        ? "rectangle"
        : layer.type === LayerType.Diamond
          ? "diamond"
          : "ellipse",
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    roughness: layer.roughness ?? 0,
    edges:
      layer.type === LayerType.Rectangle || layer.type === LayerType.Diamond
        ? layer.edges
        : undefined,
    stroke: isOutline ? color : null,
    strokeWidth: OUTLINE_WIDTH,
    background: isOutline
      ? layer.backgroundColor
        ? colorToCss(layer.backgroundColor)
        : null
      : color,
    seed: seedFromId(id),
  };
};
