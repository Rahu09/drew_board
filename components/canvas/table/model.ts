import {
  LayerType,
  type Color,
  type Point,
  type TableCell,
  type TableLayer,
  type XYWH,
} from "@/types/canvas";

import { createEvaluator, isFormulaError, shiftFormula, type Value } from "./formula";
import { displayText } from "./format";

// The data of a table layer and every change that can be made to it. All
// changes are pure: they return the fields of the layer to update
// (`TablePatch`), so a change is a single undo step.

export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 32;
export const MIN_COL_WIDTH = 28;
export const MIN_ROW_HEIGHT = 20;
export const MAX_COLS = 52;
export const MAX_ROWS = 200;
/** Longest text in a cell. */
export const MAX_CELL_LENGTH = 2000;

export type TablePatch = Pick<TableLayer, "cols" | "rows" | "cells" | "width" | "height">;
type CellsPatch = Pick<TablePatch, "cells">;

export type CellRef = { r: number; c: number };
export type CellRange = { r1: number; c1: number; r2: number; c2: number };

export const cellKey = (r: number, c: number) => `${r},${c}`;

export const rangeOf = (a: CellRef, b: CellRef): CellRange => ({
  r1: Math.min(a.r, b.r),
  c1: Math.min(a.c, b.c),
  r2: Math.max(a.r, b.r),
  c2: Math.max(a.c, b.c),
});

export const wholeTable = (layer: TableLayer): CellRange => ({
  r1: 0,
  c1: 0,
  r2: layer.rows.length - 1,
  c2: layer.cols.length - 1,
});

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Where each column or row starts (one extra entry: the far edge). */
export const offsets = (sizes: number[]) => {
  const out = [0];
  for (const size of sizes) out.push(out[out.length - 1] + size);
  return out;
};

export const sizeOf = (cols: number[], rows: number[]) => ({
  width: sum(cols),
  height: sum(rows),
});

/** A new table with the given cells, `fill` its grid and text color. */
export const createTableLayer = (box: XYWH, fill: Color): TableLayer => {
  const cols = Math.max(1, Math.min(MAX_COLS, Math.round(box.width / DEFAULT_COL_WIDTH)));
  const rows = Math.max(1, Math.min(MAX_ROWS, Math.round(box.height / DEFAULT_ROW_HEIGHT)));
  const colWidths = Array<number>(cols).fill(DEFAULT_COL_WIDTH);
  const rowHeights = Array<number>(rows).fill(DEFAULT_ROW_HEIGHT);

  return {
    type: LayerType.Table,
    x: box.x,
    y: box.y,
    ...sizeOf(colWidths, rowHeights),
    fill,
    cols: colWidths,
    rows: rowHeights,
    cells: {},
    header: true,
    fontFamily: "sans",
    fontSize: 14,
  };
};

/** The cell under a canvas point, or null outside the table. */
export const cellAt = (layer: TableLayer, point: Point): CellRef | null => {
  const x = point.x - layer.x;
  const y = point.y - layer.y;
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) return null;

  const find = (sizes: number[], at: number) => {
    let edge = 0;
    for (let i = 0; i < sizes.length; i++) {
      edge += sizes[i];
      if (at < edge) return i;
    }
    return sizes.length - 1;
  };

  return { c: find(layer.cols, x), r: find(layer.rows, y) };
};

/** A cell without unset or empty fields, or null when nothing is left. */
const tidy = (cell: TableCell): TableCell | null => {
  const out: TableCell = {};

  if (cell.v) out.v = cell.v;
  if (cell.b) out.b = 1;
  if (cell.i) out.i = 1;
  if (cell.a) out.a = cell.a;
  if (cell.c) out.c = cell.c;
  if (cell.g) out.g = cell.g;
  if (cell.n) out.n = cell.n;

  return Object.keys(out).length ? out : null;
};

/** The cells with (r, c) changed; a cell left empty is dropped. */
const withCell = (
  cells: Record<string, TableCell>,
  r: number,
  c: number,
  change: (cell: TableCell) => TableCell
) => {
  const key = cellKey(r, c);
  const next = tidy(change({ ...cells[key] }));
  const out = { ...cells };

  if (next) out[key] = next;
  else delete out[key];

  return out;
};

export const rawAt = (layer: Pick<TableLayer, "cells">, r: number, c: number) =>
  layer.cells[cellKey(r, c)]?.v ?? "";

export const setCellValue = (
  layer: TableLayer,
  r: number,
  c: number,
  value: string
): CellsPatch => ({
  cells: withCell(layer.cells, r, c, (cell) => ({
    ...cell,
    v: value.slice(0, MAX_CELL_LENGTH),
  })),
});

/** Applies `change` to every cell of the range. */
export const updateRange = (
  layer: TableLayer,
  range: CellRange,
  change: (cell: TableCell) => TableCell
): CellsPatch => {
  let cells = layer.cells;

  for (let r = range.r1; r <= range.r2; r++) {
    for (let c = range.c1; c <= range.c2; c++) {
      cells = withCell(cells, r, c, change);
    }
  }

  return { cells };
};

export const clearValues = (layer: TableLayer, range: CellRange) =>
  updateRange(layer, range, (cell) => ({ ...cell, v: undefined }));

/** Style fields that can be changed on a range. */
export type CellStyle = Partial<Pick<TableCell, "b" | "i" | "a" | "c" | "g" | "n">>;

export const styleRange = (
  layer: TableLayer,
  range: CellRange,
  style: CellStyle
): CellsPatch =>
  updateRange(layer, range, (cell) => ({ ...cell, ...style }));

/** Whether every cell of the range has the flag set. */
export const allHave = (
  layer: TableLayer,
  range: CellRange,
  field: "b" | "i"
) => {
  for (let r = range.r1; r <= range.r2; r++) {
    for (let c = range.c1; c <= range.c2; c++) {
      if (!layer.cells[cellKey(r, c)]?.[field]) return false;
    }
  }
  return true;
};

// ---- Rows and columns

const shiftKeys = (
  cells: Record<string, TableCell>,
  axis: "row" | "col",
  at: number,
  delta: number,
  removed: number
) => {
  const out: Record<string, TableCell> = {};

  for (const [key, cell] of Object.entries(cells)) {
    const [r, c] = key.split(",").map(Number);
    const index = axis === "row" ? r : c;

    // The deleted span goes away; everything after it moves.
    if (removed > 0 && index >= at && index < at + removed) continue;

    const moved = index >= at + Math.max(removed, 0) ? index + delta : index;
    const nextKey = axis === "row" ? cellKey(moved, c) : cellKey(r, moved);
    const next = cell.v?.startsWith("=")
      ? { ...cell, v: shiftFormula(cell.v, axis, at, delta, removed) }
      : cell;

    out[nextKey] = next;
  }

  return out;
};

const finish = (
  layer: TableLayer,
  cols: number[],
  rows: number[],
  cells: Record<string, TableCell>
): TablePatch => ({ cols, rows, cells, ...sizeOf(cols, rows) });

/** Adds `count` rows before row `at` (rows.length: at the end). */
export const insertRows = (layer: TableLayer, at: number, count = 1): TablePatch => {
  const room = Math.max(0, Math.min(count, MAX_ROWS - layer.rows.length));
  const rows = [...layer.rows];
  rows.splice(at, 0, ...Array<number>(room).fill(DEFAULT_ROW_HEIGHT));

  return finish(layer, layer.cols, rows, shiftKeys(layer.cells, "row", at, room, 0));
};

export const insertCols = (layer: TableLayer, at: number, count = 1): TablePatch => {
  const room = Math.max(0, Math.min(count, MAX_COLS - layer.cols.length));
  const cols = [...layer.cols];
  cols.splice(at, 0, ...Array<number>(room).fill(DEFAULT_COL_WIDTH));

  return finish(layer, cols, layer.rows, shiftKeys(layer.cells, "col", at, room, 0));
};

/** Removes rows from..to (inclusive); a table keeps at least one row. */
export const deleteRows = (layer: TableLayer, from: number, to: number): TablePatch => {
  const count = Math.min(to - from + 1, layer.rows.length - 1);
  if (count <= 0) return finish(layer, layer.cols, layer.rows, layer.cells);

  const rows = [...layer.rows];
  rows.splice(from, count);

  return finish(layer, layer.cols, rows, shiftKeys(layer.cells, "row", from, -count, count));
};

export const deleteCols = (layer: TableLayer, from: number, to: number): TablePatch => {
  const count = Math.min(to - from + 1, layer.cols.length - 1);
  if (count <= 0) return finish(layer, layer.cols, layer.rows, layer.cells);

  const cols = [...layer.cols];
  cols.splice(from, count);

  return finish(layer, cols, layer.rows, shiftKeys(layer.cells, "col", from, -count, count));
};

export const resizeCol = (layer: TableLayer, index: number, width: number): TablePatch => {
  const cols = [...layer.cols];
  cols[index] = Math.max(MIN_COL_WIDTH, Math.round(width));
  return finish(layer, cols, layer.rows, layer.cells);
};

export const resizeRow = (layer: TableLayer, index: number, height: number): TablePatch => {
  const rows = [...layer.rows];
  rows[index] = Math.max(MIN_ROW_HEIGHT, Math.round(height));
  return finish(layer, layer.cols, rows, layer.cells);
};

/** Makes room for a grid pasted at (r, c): adds rows and columns as needed. */
const grown = (layer: TableLayer, rowsNeeded: number, colsNeeded: number) => {
  const rows = [...layer.rows];
  const cols = [...layer.cols];

  while (rows.length < Math.min(rowsNeeded, MAX_ROWS)) rows.push(DEFAULT_ROW_HEIGHT);
  while (cols.length < Math.min(colsNeeded, MAX_COLS)) cols.push(DEFAULT_COL_WIDTH);

  return { rows, cols };
};

// ---- Sorting and filling

const sortRank = (value: Value) =>
  value === ""
    ? 3
    : isFormulaError(value)
      ? 2
      : typeof value === "number"
        ? 0
        : 1;

/**
 * Sorts the rows in `from..to` by a column. Whole rows move (values and
 * styles); numbers come before text, blanks last. Formulas that point at
 * other rows are not adjusted.
 */
export const sortRows = (
  layer: TableLayer,
  column: number,
  ascending: boolean,
  from: number,
  to: number
): TablePatch => {
  const value = createEvaluator(layer.cells, layer.rows.length, layer.cols.length);
  const order = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  order.sort((a, b) => {
    const left = value(a, column);
    const right = value(b, column);
    const rank = sortRank(left) - sortRank(right);

    if (sortRank(left) === 3 || sortRank(right) === 3 || rank !== 0) return rank;

    const result =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).toLowerCase().localeCompare(String(right).toLowerCase());

    return (ascending ? result : -result) || a - b;
  });

  const cells: Record<string, TableCell> = {};

  for (const [key, cell] of Object.entries(layer.cells)) {
    const [r, c] = key.split(",").map(Number);
    if (r < from || r > to) cells[key] = cell;
    else {
      const target = from + order.indexOf(r);
      cells[cellKey(target, c)] = cell;
    }
  }

  return finish(layer, layer.cols, layer.rows, cells);
};

/** Copies the first row (or column) of the range over the others. */
export const fill = (
  layer: TableLayer,
  range: CellRange,
  direction: "down" | "right"
): CellsPatch => {
  let cells = layer.cells;

  for (let r = range.r1; r <= range.r2; r++) {
    for (let c = range.c1; c <= range.c2; c++) {
      if (direction === "down" ? r === range.r1 : c === range.c1) continue;

      const source = layer.cells[direction === "down" ? cellKey(range.r1, c) : cellKey(r, range.c1)];
      cells = withCell(cells, r, c, () => ({ ...source }));
    }
  }

  return { cells };
};

// ---- Text in and out

/** The range as tab-separated text (rows on lines): what the clipboard gets. */
export const rangeToTsv = (layer: Pick<TableLayer, "cells">, range: CellRange) => {
  const lines: string[] = [];

  for (let r = range.r1; r <= range.r2; r++) {
    const row: string[] = [];

    for (let c = range.c1; c <= range.c2; c++) {
      const raw = rawAt(layer, r, c);
      row.push(/[\t\n"]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw);
    }

    lines.push(row.join("\t"));
  }

  return lines.join("\n");
};

/** Rows of cells from tab-separated or comma-separated text (quotes ok). */
export const parseDelimited = (text: string): string[][] => {
  const source = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  const delimiter = source.includes("\t") ? "\t" : source.includes(",") && source.includes("\n") ? "," : "\t";
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      rows[rows.length - 1].push(cell);
      cell = "";
    } else if (char === "\n") {
      rows[rows.length - 1].push(cell);
      rows.push([]);
      cell = "";
    } else cell += char;
  }

  rows[rows.length - 1].push(cell);
  return rows;
};

/** Writes a grid of text with its top left at (r, c), growing the table. */
export const pasteGrid = (
  layer: TableLayer,
  at: CellRef,
  grid: string[][]
): TablePatch => {
  const width = Math.max(...grid.map((row) => row.length));
  const { rows, cols } = grown(layer, at.r + grid.length, at.c + width);
  let cells = layer.cells;

  grid.forEach((row, dr) => {
    row.forEach((value, dc) => {
      const r = at.r + dr;
      const c = at.c + dc;
      if (r >= rows.length || c >= cols.length) return;

      cells = withCell(cells, r, c, (cell) => ({
        ...cell,
        v: value.slice(0, MAX_CELL_LENGTH),
      }));
    });
  });

  return finish(layer, cols, rows, cells);
};

/** What each cell shows, as rows of text (for CSV and export). */
export const displayGrid = (layer: TableLayer) => {
  const value = createEvaluator(layer.cells, layer.rows.length, layer.cols.length);

  return layer.rows.map((_, r) =>
    layer.cols.map((__, c) =>
      displayText(rawAt(layer, r, c), value(r, c), layer.cells[cellKey(r, c)])
    )
  );
};

export const toCsv = (layer: TableLayer) =>
  displayGrid(layer)
    .map((row) =>
      row
        .map((text) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text))
        .join(",")
    )
    .join("\r\n");

/** Whether the table has any content (a new table is empty). */
export const isEmptyTable = (layer: TableLayer) =>
  Object.values(layer.cells).every((cell) => !cell.v);
