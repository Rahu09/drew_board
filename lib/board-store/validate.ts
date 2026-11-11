import { LayerType, type Color, type Layer } from "@/types/canvas";

import { MAX_LAYERS, type BoardSnapshot } from "./types";

// Validates board content that comes from outside the app's own memory: the
// guest board in localStorage (which the user can edit) and the body of the
// "save guest board" request. Anything unexpected is dropped, never trusted.

const MAX_POINTS = 5_000;
const MAX_VALUE_LENGTH = 10_000;
const MAX_ID_LENGTH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseColor = (value: unknown): Color | null => {
  if (!isRecord(value)) return null;

  const { r, g, b } = value;
  const channels = [r, g, b];

  if (
    !channels.every(
      (c) => isFiniteNumber(c) && Number.isInteger(c) && c >= 0 && c <= 255
    )
  ) {
    return null;
  }

  return { r: r as number, g: g as number, b: b as number };
};

const parsePoints = (value: unknown): number[][] | null => {
  if (!Array.isArray(value) || value.length > MAX_POINTS) return null;

  const points: number[][] = [];

  for (const point of value) {
    if (
      !Array.isArray(point) ||
      point.length < 2 ||
      point.length > 3 ||
      !point.every(isFiniteNumber)
    ) {
      return null;
    }

    points.push(point);
  }

  return points;
};

export const parseLayer = (value: unknown): Layer | null => {
  if (!isRecord(value)) return null;

  const { type, x, y, width, height } = value;
  const fill = parseColor(value.fill);

  if (
    ![x, y, width, height].every(isFiniteNumber) ||
    (width as number) < 0 ||
    (height as number) < 0 ||
    !fill
  ) {
    return null;
  }

  const base = {
    x: x as number,
    y: y as number,
    width: width as number,
    height: height as number,
    fill,
  };

  const text =
    typeof value.value === "string" && value.value.length <= MAX_VALUE_LENGTH
      ? { value: value.value }
      : {};

  switch (type) {
    case LayerType.Rectangle:
    case LayerType.Ellipse:
    case LayerType.Text:
    case LayerType.Note:
      return { type, ...base, ...text };
    case LayerType.Path: {
      const points = parsePoints(value.points);
      return points ? { type, ...base, points } : null;
    }
    default:
      return null;
  }
};

/**
 * Returns a clean snapshot: valid layers only, ids that exist and are
 * unique, at most MAX_LAYERS. Null when the input isn't a board at all.
 */
export const parseSnapshot = (value: unknown): BoardSnapshot | null => {
  if (
    !isRecord(value) ||
    !isRecord(value.layers) ||
    !Array.isArray(value.layerIds)
  ) {
    return null;
  }

  const layers: Record<string, Layer> = {};
  const layerIds: string[] = [];

  for (const id of value.layerIds) {
    if (
      typeof id !== "string" ||
      !id ||
      id.length > MAX_ID_LENGTH ||
      id in layers ||
      !Object.hasOwn(value.layers, id)
    ) {
      continue;
    }

    const layer = parseLayer(value.layers[id]);

    if (layer) {
      layers[id] = layer;
      layerIds.push(id);
    }

    if (layerIds.length >= MAX_LAYERS) {
      break;
    }
  }

  return { layers, layerIds };
};
