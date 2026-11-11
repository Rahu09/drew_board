import type { XYWH } from "@/types/canvas";

/** The smallest box containing all the given boxes, or null for none. */
export const boundingBox = (layers: readonly XYWH[]): XYWH | null => {
  const first = layers[0];

  if (!first) {
    return null;
  }

  let left = first.x;
  let right = first.x + first.width;
  let top = first.y;
  let bottom = first.y + first.height;

  for (let i = 1; i < layers.length; i++) {
    const { x, y, width, height } = layers[i];

    left = Math.min(left, x);
    right = Math.max(right, x + width);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y + height);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
};

/** Moves the given ids to the end (top) of the order, keeping their order. */
export const moveIdsToFront = (order: readonly string[], ids: readonly string[]) => {
  const selected = new Set(ids);
  return [
    ...order.filter((id) => !selected.has(id)),
    ...order.filter((id) => selected.has(id)),
  ];
};

/** Moves the given ids to the start (bottom) of the order, keeping their order. */
export const moveIdsToBack = (order: readonly string[], ids: readonly string[]) => {
  const selected = new Set(ids);
  return [
    ...order.filter((id) => selected.has(id)),
    ...order.filter((id) => !selected.has(id)),
  ];
};
