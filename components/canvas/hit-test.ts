import { LayerType, isLinearLayer, type Layer, type Point } from "@/types/canvas";
import { arrowEndpoints } from "@/lib/canvas-geometry";
import type { BoardSnapshot } from "@/lib/board-store/types";

// Geometry for the tools that pick layers by area: the bucket (which layer
// is under a click) and the lasso (which layers are inside a loop).

/** Whether a point is inside a loop of points (the loop is closed). */
export const pointInPolygon = (point: Point, polygon: readonly Point[]) => {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];

    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }

  return inside;
};

/** Whether a point is on the layer's shape (not just its box). */
export const layerContainsPoint = (layer: Layer, point: Point) => {
  const { x, y, width, height } = layer;
  const dx = point.x - (x + width / 2);
  const dy = point.y - (y + height / 2);

  switch (layer.type) {
    case LayerType.Ellipse:
      return (
        width > 0 &&
        height > 0 &&
        (dx / (width / 2)) ** 2 + (dy / (height / 2)) ** 2 <= 1
      );
    case LayerType.Diamond:
      return (
        width > 0 &&
        height > 0 &&
        Math.abs(dx) / (width / 2) + Math.abs(dy) / (height / 2) <= 1
      );
    default:
      return (
        point.x >= x &&
        point.x <= x + width &&
        point.y >= y &&
        point.y <= y + height
      );
  }
};

/** Points that stand for a layer: if one is in the lasso, it is picked. */
const samplePoints = (layer: Layer): Point[] => {
  if (isLinearLayer(layer)) {
    const [start, end] = arrowEndpoints(layer);
    return [start, end, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }];
  }

  const { x, y, width, height } = layer;
  const midX = x + width / 2;
  const midY = y + height / 2;

  return [
    { x: midX, y: midY },
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
    { x: midX, y },
    { x: midX, y: y + height },
    { x, y: midY },
    { x: x + width, y: midY },
  ];
};

/** The layers (in drawing order) that have a part inside the loop. */
export const layersInLasso = (
  snapshot: BoardSnapshot,
  polygon: readonly Point[]
) => {
  if (polygon.length < 3) return [];

  return snapshot.layerIds.filter((id) => {
    const layer = snapshot.layers[id];

    return (
      !!layer && samplePoints(layer).some((point) => pointInPolygon(point, polygon))
    );
  });
};

/**
 * The selection plus whatever lies inside the selected frames, so moving a
 * frame takes its contents along. Frames inside frames count too.
 */
export const withFrameContents = (
  snapshot: BoardSnapshot,
  ids: readonly string[]
) => {
  const out = new Set(ids);
  const queue = ids.filter((id) => snapshot.layers[id]?.type === LayerType.Frame);

  while (queue.length > 0) {
    const frame = snapshot.layers[queue.pop()!];
    if (!frame) continue;

    for (const id of snapshot.layerIds) {
      const layer = snapshot.layers[id];

      if (
        out.has(id) ||
        !layer ||
        layer.x < frame.x ||
        layer.y < frame.y ||
        layer.x + layer.width > frame.x + frame.width ||
        layer.y + layer.height > frame.y + frame.height
      ) {
        continue;
      }

      out.add(id);
      if (layer.type === LayerType.Frame) queue.push(id);
    }
  }

  return [...out];
};
