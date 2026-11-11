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

/** Moves each given id one place up (toward the top), past one other layer. */
export const moveIdsForward = (
  order: readonly string[],
  ids: readonly string[]
) => {
  const selected = new Set(ids);
  const result = [...order];

  for (let i = result.length - 2; i >= 0; i--) {
    if (selected.has(result[i]) && !selected.has(result[i + 1])) {
      [result[i], result[i + 1]] = [result[i + 1], result[i]];
    }
  }

  return result;
};

/** Moves each given id one place down (toward the bottom), past one other layer. */
export const moveIdsBackward = (
  order: readonly string[],
  ids: readonly string[]
) => {
  const selected = new Set(ids);
  const result = [...order];

  for (let i = 1; i < result.length; i++) {
    if (selected.has(result[i]) && !selected.has(result[i - 1])) {
      [result[i], result[i - 1]] = [result[i - 1], result[i]];
    }
  }

  return result;
};

/** How the layers panel can move layers in the drawing order. */
export type LayerMove = "front" | "forward" | "backward" | "back";

export const moveIds = (
  order: readonly string[],
  ids: readonly string[],
  move: LayerMove
) =>
  move === "front"
    ? moveIdsToFront(order, ids)
    : move === "back"
      ? moveIdsToBack(order, ids)
      : move === "forward"
        ? moveIdsForward(order, ids)
        : moveIdsBackward(order, ids);
