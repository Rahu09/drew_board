import type { NumberFormat, TableCell } from "@/types/canvas";

import { isFormulaError, type Value } from "./formula";

const group = (value: number, fraction: [min: number, max: number]) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: fraction[0],
    maximumFractionDigits: fraction[1],
  });

/** A number shown with a format; without one, as it is (no long tails). */
export const formatNumber = (value: number, format?: NumberFormat) => {
  switch (format) {
    case "num":
      return group(value, [2, 2]);
    case "int":
      return group(value, [0, 0]);
    case "cur":
      return value < 0
        ? `-$${group(-value, [2, 2])}`
        : `$${group(value, [2, 2])}`;
    case "pct":
      return `${group(value * 100, [0, 2])}%`;
    default:
      return String(Number(value.toPrecision(12)));
  }
};

/** What a cell shows for its raw text and computed value. */
export const displayText = (raw: string, value: Value, cell?: TableCell) => {
  if (isFormulaError(value)) return value.error;

  const isFormula = raw.startsWith("=") && raw.length > 1;

  if (typeof value === "number") {
    // Typed numbers stay as typed unless a format is chosen.
    return !isFormula && !cell?.n ? raw : formatNumber(value, cell?.n);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  return value;
};

/** "left", "right" or "center" when the cell doesn't say. */
export const defaultAlign = (value: Value): "left" | "right" | "center" =>
  typeof value === "number"
    ? "right"
    : typeof value === "boolean" || isFormulaError(value)
      ? "center"
      : "left";
