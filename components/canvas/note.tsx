import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { NoteLayer } from "@/types/canvas";
import { colorToCss, getContrastingTextColor } from "@/lib/utils";
import { useBoardStore } from "@/lib/board-store/context";

import { PlainTextEditable } from "./plain-text-editable";
import { useCanvasReadOnly } from "./read-only-context";
import {
  NOTE_DATE_FONT_SIZE,
  NOTE_DATE_SPACE,
  NOTE_SHRINK,
  formatNoteDate,
  noteLayerFontSize,
  overflowAt,
} from "./text-metrics";
import { layerFontFamily, layerTextAlign } from "./fonts";
import { cornerRadius, seedFromId, shapePaths } from "./rough-shape";

interface NoteProps {
  id: string;
  layer: NoteLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

/**
 * How the note shows all of its text: at its font size if that fits;
 * otherwise NOTE_SHRINK smaller, and if that still doesn't fit, the note
 * grows by `grow`.
 */
const fitNote = (editable: HTMLElement, fontSize: number) => {
  if (overflowAt(editable, fontSize) === 0) {
    return { shrunk: false, grow: 0 };
  }

  return {
    shrunk: true,
    grow: overflowAt(editable, Math.max(fontSize - NOTE_SHRINK, 6)),
  };
};

/** The note's text color: its own, or whichever of black and white reads best. */
export const noteTextColor = (layer: NoteLayer) => {
  const { fill } = layer;
  if (layer.textColor) return colorToCss(layer.textColor);
  if (layer.fillStyle === "none") return fill ? colorToCss(fill) : "#000";
  return fill ? getContrastingTextColor(fill) : "#000";
};

export const Note = ({
  layer,
  onPointerDown,
  id,
  selectionColor,
}: NoteProps) => {
  const { x, y, width, height, fill, value, createdAt } = layer;
  const { actions } = useBoardStore();
  const readOnly = useCanvasReadOnly();
  const ref = useRef<SVGForeignObjectElement>(null);
  // Whether the text is shown NOTE_SHRINK smaller to fit. Measured here on
  // every client, so it is never stored.
  const [shrunk, setShrunk] = useState(false);

  const baseSize = noteLayerFontSize(layer);
  const fontSize = shrunk ? Math.max(baseSize - NOTE_SHRINK, 6) : baseSize;

  const color = fill ? colorToCss(fill) : "#000";
  const isOutline = layer.fillStyle === "none";
  const textColor = noteTextColor(layer);
  const roughness = layer.roughness ?? 0;
  const round = layer.edges === "round";
  const radius = round ? cornerRadius(width, height) : 0;

  // Hand-drawn paper: drawn in SVG behind the text.
  const paper = useMemo(
    () =>
      roughness === 0
        ? null
        : shapePaths({
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
          }),
    [roughness, x, y, width, height, layer.edges, isOutline, color, id]
  );

  const editable = () =>
    ref.current?.querySelector<HTMLElement>("[contenteditable]") ?? null;

  // Refit after a resize, a font size change or someone else's edit. Only
  // the person who has the note selected writes the new height, so clients
  // don't all write it.
  useLayoutEffect(() => {
    const element = editable();
    if (!element) return;

    const fit = fitNote(element, baseSize);
    // Measured from the DOM, so it can only be set after rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShrunk(fit.shrunk);

    if (fit.grow > 0 && !readOnly && actions.getSelection().includes(id)) {
      actions.updateLayer(id, { height: height + fit.grow });
    }
  }, [
    actions,
    baseSize,
    height,
    id,
    readOnly,
    value,
    width,
    createdAt,
    layer.fontFamily,
  ]);

  // Everything but the text is plain SVG behind it. Safari and every
  // iPhone browser (WebKit) draw HTML inside <foreignObject> in the wrong
  // place, unscaled by zoom, once it has a filter, shadow, opacity or
  // position; so the HTML below stays plain.
  const clean = !paper && (
    <rect
      x={isOutline ? x + 1 : x}
      y={isOutline ? y + 1 : y}
      width={isOutline ? Math.max(width - 2, 0) : width}
      height={isOutline ? Math.max(height - 2, 0) : height}
      rx={isOutline ? Math.max(radius, 4) : radius}
      fill={isOutline ? "none" : color}
      stroke={isOutline ? color : "none"}
      strokeWidth={isOutline ? 2 : 0}
      className={isOutline ? undefined : "drop-shadow-md"}
      pointerEvents="none"
    />
  );

  const foreignObject = (
    <foreignObject
      ref={ref}
      data-layer-id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      onPointerDown={(e) => onPointerDown(e, id)}
    >
      <div className="h-full w-full flex flex-col">
        <PlainTextEditable
          value={value}
          fallback="Text"
          readOnly={readOnly}
          onChange={(text) => {
            // The text and the height it needs in one change, so a single
            // undo takes back both.
            const element = editable();
            const fit = element
              ? fitNote(element, baseSize)
              : { shrunk: false, grow: 0 };

            setShrunk(fit.shrunk);
            actions.updateLayer(
              id,
              fit.grow > 0
                ? { value: text, height: height + fit.grow }
                : { value: text }
            );
          }}
          // Fills the note above the date's strip. No bottom padding: text
          // running into end padding doesn't count as overflow, so the
          // note wouldn't grow (the spacer below does that job).
          className="flex-1 min-h-0"
          style={{
            fontSize,
            fontFamily: layerFontFamily(layer.fontFamily),
            textAlign: layerTextAlign(layer.textAlign),
            color: textColor,
            paddingInline: 8,
            paddingTop: 6,
          }}
        />
        {/* The date's own strip: the text can never reach it. */}
        <div
          aria-hidden={createdAt === undefined}
          className="shrink-0 flex items-end justify-end pointer-events-none select-none"
          style={{
            height: createdAt !== undefined ? NOTE_DATE_SPACE : 6,
            paddingRight: 5,
            paddingBottom: 3,
          }}
        >
          {createdAt !== undefined && (
            <time
              dateTime={new Date(createdAt).toISOString()}
              className="leading-none tabular-nums"
              style={{
                fontSize: NOTE_DATE_FONT_SIZE,
                // Faded with the color, not opacity (see above).
                color: `color-mix(in srgb, ${textColor} 60%, transparent)`,
              }}
            >
              {formatNoteDate(createdAt)}
            </time>
          )}
        </div>
      </div>
    </foreignObject>
  );

  // Someone else's selection.
  const outline = selectionColor && (
    <rect
      x={x - 1}
      y={y - 1}
      width={width + 2}
      height={height + 2}
      fill="none"
      stroke={selectionColor}
      strokeWidth={1}
      pointerEvents="none"
    />
  );

  if (!paper) {
    return (
      <g>
        {clean}
        {foreignObject}
        {outline}
      </g>
    );
  }

  return (
    <g>
      <g
        className={isOutline ? undefined : "drop-shadow-md"}
        pointerEvents="none"
      >
        {paper.map((path, index) => (
          <path
            key={index}
            d={path.d}
            fill={path.fill}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
      {foreignObject}
      {outline}
    </g>
  );
};
