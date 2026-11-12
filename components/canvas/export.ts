import getStroke from "perfect-freehand";

import { FontFamily, Layer, LayerType, TextAlign } from "@/types/canvas";
import { arrowPathData } from "@/lib/canvas-geometry";
import { boundingBox } from "@/lib/board-store/bounds";
import type { BoardSnapshot } from "@/lib/board-store/types";
import { colorToCss, getSvgPathFromStroke } from "@/lib/utils";

import { layerText } from "./plain-text-editable";
import {
  NOTE_DATE_FONT_SIZE,
  NOTE_DATE_SPACE,
  formatNoteDate,
  noteLayerFontSize,
  textLayerFontSize,
} from "./text-metrics";
import { EXPORT_FONTS, layerTextAlign } from "./fonts";
import { noteTextColor } from "./note";
import { cleanShapePath, cornerRadius, linearPaths, seedFromId, shapePaths } from "./rough-shape";
import { hostOf } from "./embed-url";
import { tableToSvg } from "./table/table-export";
import { shapeSpec } from "./shape-style";

// Exports rebuild the board as a standalone SVG from the layer data (the
// live canvas uses HTML inside SVG for text, which image exports can't
// draw). PNG is that SVG drawn onto a canvas at 2x.

const PADDING = 32;
// The date is in the page font on the board too.
const DATE_FONT = EXPORT_FONTS.sans;

export type ExportFormat = "png" | "svg";

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Splits text into lines that roughly fit `width` (no font metrics here). */
const wrapText = (text: string, width: number, fontSize: number) => {
  const maxChars = Math.max(1, Math.floor((width - 8) / (fontSize * 0.5)));
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    let line = "";

    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;

      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    lines.push(line);
  }

  return lines;
};

type TextOptions = {
  fontSize: number;
  color: string;
  fontFamily: FontFamily | undefined;
  textAlign: TextAlign | undefined;
};

const ANCHORS: Record<TextAlign, string> = {
  left: "start",
  center: "middle",
  right: "end",
};

const textBlock = (
  layer: { x: number; y: number; width: number; height: number },
  text: string,
  { fontSize, color, fontFamily, textAlign }: TextOptions
) => {
  const lines = wrapText(text, layer.width, fontSize);
  const lineHeight = fontSize * 1.25;
  const top =
    layer.y + layer.height / 2 - (lines.length * lineHeight) / 2 + fontSize;
  const align = layerTextAlign(textAlign);
  const x =
    align === "left"
      ? layer.x + 8
      : align === "right"
        ? layer.x + layer.width - 8
        : layer.x + layer.width / 2;

  const spans = lines
    .map(
      (line, i) =>
        `<tspan x="${x}" y="${top + i * lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const font = escapeXml(EXPORT_FONTS[fontFamily ?? "hand"]);
  return `<text text-anchor="${ANCHORS[align]}" font-family="${font}" font-size="${fontSize}" fill="${color}">${spans}</text>`;
};

/** Fetches an image as a data URL so the export is self-contained. */
const toDataUrl = async (src: string) => {
  try {
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) return null;

    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/** Paths from rough-shape, the same as on the board. */
const pathsToSvg = (paths: ReturnType<typeof shapePaths>) =>
  paths
    .map(
      (path) =>
        `<path d="${path.d}" fill="${path.fill}" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join("");

const layerToSvg = async (id: string, layer: Layer): Promise<string> => {
  const body = await layerBody(id, layer);
  const { opacity } = layer;

  return opacity !== undefined && opacity < 100 && body
    ? `<g opacity="${Math.max(opacity, 0) / 100}">${body}</g>`
    : body;
};

const layerBody = async (id: string, layer: Layer): Promise<string> => {
  const color = colorToCss(layer.fill);
  const { x, y, width, height } = layer;

  switch (layer.type) {
    case LayerType.Rectangle:
    case LayerType.Ellipse:
    case LayerType.Diamond:
      return pathsToSvg(shapePaths(shapeSpec(id, layer)));
    case LayerType.Frame: {
      const outline = cleanShapePath({
        kind: "rectangle",
        x,
        y,
        width,
        height,
        roughness: 0,
        edges: "round",
        stroke: color,
        strokeWidth: 2,
        background: null,
        seed: 1,
      });
      const name = escapeXml(layer.value || "Frame");
      return (
        `<path d="${outline}" fill="none" stroke="${color}" stroke-width="2"/>` +
        `<text x="${x}" y="${y - 8}" font-family="${escapeXml(EXPORT_FONTS.sans)}" font-size="15" fill="${color}">${name}</text>`
      );
    }
    case LayerType.Embed: {
      // A page can't be drawn into an image: show where it points.
      const label = layer.src ? hostOf(layer.src) : "Web embed";
      return (
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#f8f9fa" stroke="#ced4da" stroke-width="2"/>` +
        `<text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(EXPORT_FONTS.sans)}" font-size="16" fill="#495057">${escapeXml(label)}</text>`
      );
    }
    case LayerType.Table:
      return tableToSvg(layer);
    case LayerType.Path: {
      const d = getSvgPathFromStroke(
        getStroke(layer.points, {
          size: 16,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        })
      );
      return `<path transform="translate(${x} ${y})" d="${d}" fill="${color}"/>`;
    }
    case LayerType.Arrow:
    case LayerType.Line:
      return linearPaths(
        arrowPathData(layer),
        layer.roughness ?? 0,
        color,
        2,
        seedFromId(id)
      )
        .map(
          (path) =>
            `<path d="${path.d}" fill="none" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join("");
    case LayerType.Note: {
      const isOutline = layer.fillStyle === "none";
      const roughness = layer.roughness ?? 0;
      const radius = layer.edges === "round" ? cornerRadius(width, height) : 0;
      const box =
        roughness > 0
          ? pathsToSvg(
              shapePaths({
                kind: "rectangle",
                x,
                y,
                width,
                height,
                roughness,
                edges: layer.edges,
                stroke: isOutline ? color : null,
                strokeWidth: 2,
                background: isOutline ? null : color,
                seed: seedFromId(id),
              })
            )
          : isOutline
            ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.max(radius, 4)}" fill="none" stroke="${color}" stroke-width="2"/>`
            : `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${color}"/>`;
      const textColor = noteTextColor(layer);

      const hasDate = layer.createdAt !== undefined;
      const date = hasDate
        ? `<text x="${x + width - 5}" y="${y + height - 4}" text-anchor="end" font-family="${escapeXml(DATE_FONT)}" font-size="${NOTE_DATE_FONT_SIZE}" fill="${textColor}" fill-opacity="0.6">${escapeXml(formatNoteDate(layer.createdAt!))}</text>`
        : "";
      // The text stays clear of the date, as on the board.
      const textArea = hasDate
        ? { x, y, width, height: Math.max(height - NOTE_DATE_SPACE, 0) }
        : layer;

      return (
        box +
        textBlock(textArea, layerText(layer.value) || "Text", {
          fontSize: noteLayerFontSize(layer),
          color: textColor,
          fontFamily: layer.fontFamily,
          textAlign: layer.textAlign,
        }) +
        date
      );
    }
    case LayerType.Text:
      return textBlock(layer, layerText(layer.value) || "Text", {
        fontSize: textLayerFontSize(layer),
        color,
        fontFamily: layer.fontFamily,
        textAlign: layer.textAlign,
      });
    case LayerType.Image: {
      // Left out when it can't be fetched: an external image would stop the
      // PNG from being drawn.
      const href = await toDataUrl(layer.src);
      return href
        ? `<image href="${escapeXml(href)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`
        : "";
    }
  }
};

export type ExportOptions = {
  /** Only these layers (default: all). */
  ids?: readonly string[];
  /** Draw the board's background color (default); off: see-through. */
  background?: boolean;
};

/**
 * The chosen layers as an SVG document, on the board's background color,
 * or null when there is nothing to export.
 */
export const boardToSvg = async (
  snapshot: BoardSnapshot,
  { ids, background = true }: ExportOptions = {}
) => {
  const chosen = new Set(ids?.length ? ids : snapshot.layerIds);
  const entries = snapshot.layerIds
    .filter((id) => chosen.has(id))
    .map((id) => [id, snapshot.layers[id]] as const)
    .filter((entry): entry is readonly [string, Layer] => entry[1] !== undefined);
  const layers = entries.map(([, layer]) => layer);

  const bounds = boundingBox(layers);
  if (!bounds) return null;

  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);
  const body = (
    await Promise.all(entries.map(([id, layer]) => layerToSvg(id, layer)))
  ).join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="${bounds.x - PADDING} ${bounds.y - PADDING} ${width} ${height}">` +
    (background
      ? `<rect x="${bounds.x - PADDING}" y="${bounds.y - PADDING}" width="${width}" height="${height}" fill="${snapshot.background ?? "#ffffff"}"/>`
      : "") +
    body +
    `</svg>`;

  return { svg, width, height };
};

export const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const svgToPng = async (svg: string, width: number, height: number) => {
  const scale = 2;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas");

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG failed"))),
        "image/png"
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** The board (or part of it) as a PNG or SVG file, or null when empty. */
export const boardToBlob = async (
  snapshot: BoardSnapshot,
  format: ExportFormat,
  options?: ExportOptions
) => {
  const result = await boardToSvg(snapshot, options);
  if (!result) return null;

  return format === "svg"
    ? new Blob([result.svg], { type: "image/svg+xml" })
    : await svgToPng(result.svg, result.width, result.height);
};

/**
 * Downloads the board (or part of it) as PNG or SVG. Returns false when
 * there is nothing to export.
 */
export const exportBoard = async (
  snapshot: BoardSnapshot,
  format: ExportFormat,
  name: string,
  options?: ExportOptions
) => {
  const blob = await boardToBlob(snapshot, format, options);
  if (!blob) return false;

  download(blob, `${name}.${format}`);
  return true;
};

/** Thumbnails are this many pixels square (see convex/thumbnails.ts). */
const THUMBNAIL_SIZE = 400;

/**
 * A small square picture of the whole board for the dashboard, centred on
 * the board's background: WebP where the browser can make it, else PNG.
 * Null when the board is empty.
 */
export const boardToThumbnail = async (snapshot: BoardSnapshot) => {
  const result = await boardToSvg(snapshot);
  if (!result) return null;

  const url = URL.createObjectURL(
    new Blob([result.svg], { type: "image/svg+xml" })
  );

  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const size = THUMBNAIL_SIZE;
    // Fit the drawing, but don't blow a lone small shape up too far.
    const scale = Math.min(size / result.width, size / result.height, 2);
    const width = result.width * scale;
    const height = result.height * scale;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas");

    context.fillStyle = snapshot.background ?? "#ffffff";
    context.fillRect(0, 0, size, size);
    context.drawImage(
      image,
      (size - width) / 2,
      (size - height) / 2,
      width,
      height
    );

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Thumbnail failed")),
        "image/webp",
        0.85
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
};
