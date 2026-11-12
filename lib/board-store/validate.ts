import {
  LayerType,
  type Color,
  type FillStyle,
  type Layer,
  type NumberFormat,
  type TableCell,
} from "@/types/canvas";
import {
  MAX_CELL_LENGTH,
  MAX_COLS,
  MAX_ROWS,
  sizeOf,
} from "@/components/canvas/table/model";

import { MAX_LAYERS, type BoardSnapshot } from "./types";

// Validates board content that comes from outside the app's own memory: the
// guest board in localStorage (which the user can edit) and the body of the
// "save guest board" request. Anything unexpected is dropped, never trusted.

const MAX_POINTS = 5_000;
const MAX_VALUE_LENGTH = 10_000;
const MAX_ID_LENGTH = 64;
const MAX_SRC_LENGTH = 2_048;
const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 400;

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

const parseFillStyle = (value: unknown): { fillStyle?: FillStyle } =>
  value === "solid" || value === "none" ? { fillStyle: value } : {};

/** Keeps `value` under `key` only when it is one of `allowed`. */
const oneOf = <K extends string, T>(
  key: K,
  value: unknown,
  allowed: readonly T[]
) =>
  allowed.includes(value as T) ? ({ [key]: value as T } as { [P in K]?: T }) : {};

const ROUGHNESS = [0, 1, 2] as const;
const EDGES = ["sharp", "round"] as const;
const FONT_FAMILIES = ["hand", "sans", "mono"] as const;
const TEXT_ALIGNS = ["left", "center", "right"] as const;

const parseOpacity = (value: unknown): { opacity?: number } =>
  isFiniteNumber(value) && value >= 0 && value <= 100
    ? { opacity: value }
    : {};

/** A color, or null for see-through; anything else is left out. */
const parseBackground = (
  value: unknown
): { backgroundColor?: Color | null } => {
  if (value === null) return { backgroundColor: null };
  const color = parseColor(value);
  return color ? { backgroundColor: color } : {};
};

const parseTextStyle = (value: Record<string, unknown>) => ({
  ...oneOf("fontFamily", value.fontFamily, FONT_FAMILIES),
  ...oneOf("textAlign", value.textAlign, TEXT_ALIGNS),
});

/** Only https images (uploads are Convex storage URLs); never data: or js. */
const parseImageSrc = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > MAX_SRC_LENGTH) return null;

  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

const NUMBER_FORMATS = ["num", "int", "cur", "pct"] as const satisfies readonly NumberFormat[];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
/** Most cells with content a table may have. */
const MAX_TABLE_CELLS = 5_000;

const parseSizes = (value: unknown, max: number, min: number, limit: number) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) return null;

  return value.every((n) => isFiniteNumber(n) && n >= min && n <= limit)
    ? (value as number[])
    : null;
};

const parseTableCell = (value: unknown): TableCell | null => {
  if (!isRecord(value)) return null;

  const cell: TableCell = {};

  if (typeof value.v === "string" && value.v) cell.v = value.v.slice(0, MAX_CELL_LENGTH);
  if (value.b === 1) cell.b = 1;
  if (value.i === 1) cell.i = 1;
  if (TEXT_ALIGNS.includes(value.a as never)) cell.a = value.a as TableCell["a"];
  if (typeof value.c === "string" && HEX_COLOR.test(value.c)) cell.c = value.c.toLowerCase();
  if (typeof value.g === "string" && HEX_COLOR.test(value.g)) cell.g = value.g.toLowerCase();
  if (NUMBER_FORMATS.includes(value.n as never)) cell.n = value.n as NumberFormat;

  return Object.keys(cell).length ? cell : null;
};

/** The cells of a table; those outside its rows and columns are dropped. */
const parseTableCells = (value: unknown, rows: number, cols: number) => {
  const cells: Record<string, TableCell> = {};
  if (!isRecord(value)) return cells;

  let count = 0;

  for (const [key, raw] of Object.entries(value)) {
    const match = /^(\d{1,3}),(\d{1,3})$/.exec(key);
    if (!match || Number(match[1]) >= rows || Number(match[2]) >= cols) continue;

    const cell = parseTableCell(raw);
    if (!cell) continue;

    cells[key] = cell;
    if (++count >= MAX_TABLE_CELLS) break;
  }

  return cells;
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
    ...parseOpacity(value.opacity),
  };

  const text =
    typeof value.value === "string" && value.value.length <= MAX_VALUE_LENGTH
      ? { value: value.value }
      : {};

  const fontSize =
    isFiniteNumber(value.fontSize) &&
    value.fontSize >= MIN_FONT_SIZE &&
    value.fontSize <= MAX_FONT_SIZE
      ? { fontSize: value.fontSize }
      : {};

  switch (type) {
    case LayerType.Rectangle:
      return {
        type,
        ...base,
        ...parseFillStyle(value.fillStyle),
        ...parseBackground(value.backgroundColor),
        ...oneOf("roughness", value.roughness, ROUGHNESS),
        ...oneOf("edges", value.edges, EDGES),
        ...text,
      };
    case LayerType.Diamond:
      return {
        type,
        ...base,
        ...parseFillStyle(value.fillStyle),
        ...parseBackground(value.backgroundColor),
        ...oneOf("roughness", value.roughness, ROUGHNESS),
        ...oneOf("edges", value.edges, EDGES),
        ...text,
      };
    case LayerType.Ellipse:
      return {
        type,
        ...base,
        ...parseFillStyle(value.fillStyle),
        ...parseBackground(value.backgroundColor),
        ...oneOf("roughness", value.roughness, ROUGHNESS),
        ...text,
      };
    case LayerType.Note: {
      const textColor = parseColor(value.textColor);
      return {
        type,
        ...base,
        ...parseFillStyle(value.fillStyle),
        ...(textColor ? { textColor } : {}),
        ...oneOf("roughness", value.roughness, ROUGHNESS),
        ...oneOf("edges", value.edges, EDGES),
        ...parseTextStyle(value),
        ...fontSize,
        ...(isFiniteNumber(value.createdAt) && value.createdAt > 0
          ? { createdAt: value.createdAt }
          : {}),
        ...text,
      };
    }
    case LayerType.Text:
      return {
        type,
        ...base,
        ...parseTextStyle(value),
        ...fontSize,
        ...text,
      };
    case LayerType.Path: {
      const points = parsePoints(value.points);
      return points ? { type, ...base, points } : null;
    }
    case LayerType.Arrow:
    case LayerType.Line: {
      const points = parsePoints(value.points);
      return points?.length === 2
        ? { type, ...base, points, ...oneOf("roughness", value.roughness, ROUGHNESS) }
        : null;
    }
    case LayerType.Frame:
      return { type, ...base, ...text };
    case LayerType.Embed: {
      // Empty until a link is pasted; only https is ever kept.
      const src = parseImageSrc(value.src);
      return { type, ...base, ...(src ? { src } : {}) };
    }
    case LayerType.Table: {
      const cols = parseSizes(value.cols, MAX_COLS, 12, 2000);
      const rows = parseSizes(value.rows, MAX_ROWS, 12, 1000);
      if (!cols || !rows) return null;

      return {
        type,
        ...base,
        // The box is always what the columns and rows add up to.
        ...sizeOf(cols, rows),
        cols,
        rows,
        cells: parseTableCells(value.cells, rows.length, cols.length),
        ...(value.header === true ? { header: true } : {}),
        ...oneOf("fontFamily", value.fontFamily, FONT_FAMILIES),
        ...fontSize,
      };
    }
    case LayerType.Image: {
      const src = parseImageSrc(value.src);
      return src ? { type, ...base, src } : null;
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

  const background = parseCanvasColor(value.background);

  return background ? { layers, layerIds, background } : { layers, layerIds };
};

/** A canvas color: "#rrggbb" only. */
export const parseCanvasColor = (value: unknown): string | null =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : null;
