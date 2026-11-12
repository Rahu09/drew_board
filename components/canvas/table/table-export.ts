import type { TableLayer } from "@/types/canvas";
import { colorToCss } from "@/lib/utils";

import { EXPORT_FONTS } from "../fonts";
import { createEvaluator } from "./formula";
import { defaultAlign, displayText } from "./format";
import { cellKey, offsets, rawAt } from "./model";

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const PADDING = 7;
const HEADER_FILL = "#f1f3f5";

/** A table as SVG for image export: backgrounds, grid and each cell's text. */
export const tableToSvg = (layer: TableLayer) => {
  const { x, y, width, height, cols, rows, cells } = layer;
  const color = colorToCss(layer.fill);
  const xs = offsets(cols);
  const ys = offsets(rows);
  const value = createEvaluator(cells, rows.length, cols.length);
  const font = escapeXml(EXPORT_FONTS[layer.fontFamily ?? "sans"]);
  const fontSize = layer.fontSize ?? 14;

  let out = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>`;

  if (layer.header) {
    out += `<rect x="${x}" y="${y}" width="${width}" height="${rows[0]}" fill="${HEADER_FILL}"/>`;
  }

  for (const [key, cell] of Object.entries(cells)) {
    if (!cell.g) continue;
    const [r, c] = key.split(",").map(Number);
    if (r >= rows.length || c >= cols.length) continue;
    out += `<rect x="${x + xs[c]}" y="${y + ys[r]}" width="${cols[c]}" height="${rows[r]}" fill="${escapeXml(cell.g)}"/>`;
  }

  const grid =
    ys.map((edge) => `M ${x} ${y + edge} H ${x + width}`).join(" ") +
    " " +
    xs.map((edge) => `M ${x + edge} ${y} V ${y + height}`).join(" ");
  out += `<path d="${grid}" stroke="${color}" stroke-opacity="0.3" fill="none"/>`;
  out += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${color}" stroke-opacity="0.8" stroke-width="1.5"/>`;

  rows.forEach((_, r) => {
    cols.forEach((__, c) => {
      const raw = rawAt(layer, r, c);
      if (!raw) return;

      const cell = cells[cellKey(r, c)];
      const computed = value(r, c);
      const align = cell?.a ?? defaultAlign(computed);
      const left = x + xs[c];
      const textX =
        align === "left"
          ? left + PADDING
          : align === "right"
            ? left + cols[c] - PADDING
            : left + cols[c] / 2;
      const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
      const bold = cell?.b || (layer.header && r === 0);

      // Clipped to its column, like on the board.
      out +=
        `<svg x="${left}" y="${y + ys[r]}" width="${cols[c]}" height="${rows[r]}" overflow="hidden">` +
        `<text x="${textX - left}" y="${rows[r] / 2}" text-anchor="${anchor}" dominant-baseline="central" ` +
        `font-family="${font}" font-size="${fontSize}" fill="${escapeXml(cell?.c ?? color)}"` +
        `${bold ? ' font-weight="700"' : ""}${cell?.i ? ' font-style="italic"' : ""}>` +
        `${escapeXml(displayText(raw, computed, cell))}</text></svg>`;
    });
  });

  return out;
};
