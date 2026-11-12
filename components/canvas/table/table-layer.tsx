"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Move } from "lucide-react";

import { TableLayer } from "@/types/canvas";
import { colorToCss } from "@/lib/utils";
import { useBoardStore } from "@/lib/board-store/context";

import { layerFontFamily } from "../fonts";
import { useCameraScale } from "../camera-context";
import { useCanvasReadOnly } from "../read-only-context";
import { createEvaluator, colName } from "./formula";
import { defaultAlign, displayText } from "./format";
import { useTableInteraction } from "./interaction-context";
import {
  allHave,
  cellAt,
  cellKey,
  clearValues,
  offsets,
  parseDelimited,
  pasteGrid,
  rangeOf,
  rangeToTsv,
  rawAt,
  resizeCol,
  resizeRow,
  setCellValue,
  styleRange,
  updateRange,
  type CellRef,
  type TablePatch,
} from "./model";
import { useTableSelection } from "./selection";

interface TableProps {
  id: string;
  layer: TableLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

/** Height of the column letters and width of the row numbers. */
export const HEADER_HEIGHT = 22;
export const HEADER_WIDTH = 38;

const ACCENT = "#6366f1";
const HEADER_FILL = "#f1f3f5";
const HEADER_FILL_ACTIVE = "#dbe4ff";
const HEADER_LINE = "#ced4da";
const TABLE_HEADER_ROW_FILL = "#f1f3f5";
const CELL_PADDING = 7;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Follows the pointer until it is released. The release is swallowed: the
 * canvas takes a release with nothing being dragged as a click on empty
 * space and would deselect the table.
 */
const trackPointer = (
  onMove?: (ev: PointerEvent) => void,
  onEnd?: () => void
) => {
  const end = (ev: PointerEvent) => {
    ev.stopPropagation();
    if (onMove) window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", end, true);
    onEnd?.();
  };

  if (onMove) window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", end, true);
  window.addEventListener("pointercancel", end, true);
};

/**
 * A spreadsheet-like table. Clicking it selects it (so it can be moved,
 * copied or deleted like any layer); once it is the only selected layer,
 * clicks select cells, and the keyboard works like a spreadsheet: arrows,
 * Tab and Enter to move, typing or F2 to edit, Delete to clear, Ctrl+C / X
 * / V to copy, cut and paste (also with Excel or Google Sheets).
 */
export const Table = ({
  id,
  layer,
  onPointerDown,
  selectionColor,
}: TableProps) => {
  const { x, y, width, height, cols, rows, cells, fill } = layer;
  const store = useBoardStore();
  const { actions } = store;
  const readOnly = useCanvasReadOnly();
  const interactive = useTableInteraction() && !readOnly;
  const scale = useCameraScale();
  const selection = store.useSelection();
  const isSole = selection.length === 1 && selection[0] === id;

  const selectedId = useTableSelection((s) => s.layerId);
  const anchor = useTableSelection((s) => s.anchor);
  const active = useTableSelection((s) => s.active);
  const hasCells = isSole && selectedId === id;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef(layer);

  useEffect(() => {
    layerRef.current = layer;
  });

  // No longer the only selected layer: its cells are no longer selected.
  useEffect(() => {
    if (!isSole && useTableSelection.getState().layerId === id) {
      useTableSelection.getState().clear();
    }
  }, [isSole, id]);

  const xs = useMemo(() => offsets(cols), [cols]);
  const ys = useMemo(() => offsets(rows), [rows]);
  const valueAt = useMemo(
    () => createEvaluator(cells, rows.length, cols.length),
    [cells, rows.length, cols.length]
  );

  // Cells may have been deleted under the selection.
  const lastRow = rows.length - 1;
  const lastCol = cols.length - 1;
  const cur: CellRef = {
    r: clamp(active.r, 0, lastRow),
    c: clamp(active.c, 0, lastCol),
  };
  const range = hasCells
    ? rangeOf(
        { r: clamp(anchor.r, 0, lastRow), c: clamp(anchor.c, 0, lastCol) },
        cur
      )
    : null;

  // What a copy of the selection puts on the clipboard: kept selected in
  // the (invisible) text box, so the browser's own copy and cut take it.
  const rangeKey = range ? `${range.r1},${range.c1},${range.r2},${range.c2}` : "";
  const tsv = useMemo(() => {
    if (!rangeKey) return "";
    const [r1, c1, r2, c2] = rangeKey.split(",").map(Number);
    return rangeToTsv({ cells }, { r1, c1, r2, c2 });
  }, [cells, rangeKey]);

  useEffect(() => {
    if (!editing && rangeKey) inputRef.current?.select();
  }, [editing, rangeKey, tsv]);

  // The text box is only there once a cell is selected: take the keyboard.
  useEffect(() => {
    if (hasCells) inputRef.current?.focus({ preventScroll: true });
  }, [hasCells]);

  useEffect(() => {
    if (editing) {
      const input = inputRef.current;
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }, [editing]);

  const select = (anchorCell: CellRef, activeCell: CellRef) =>
    useTableSelection.getState().select(id, anchorCell, activeCell);

  const write = (patch: Partial<TablePatch>) => actions.updateLayer(id, patch);

  const moveActive = (dr: number, dc: number, extend: boolean) => {
    const state = useTableSelection.getState();
    const next = {
      r: clamp(cur.r + dr, 0, lastRow),
      c: clamp(cur.c + dc, 0, lastCol),
    };
    select(extend && state.layerId === id ? state.anchor : next, next);
  };

  const startEdit = (initial?: string) => {
    setDraft(initial ?? rawAt(layer, cur.r, cur.c));
    setEditing(true);
  };

  const finishEdit = (save: boolean) => {
    if (!editing) return;
    setEditing(false);

    if (save && draft !== rawAt(layer, cur.r, cur.c)) {
      write(setCellValue(layer, cur.r, cur.c, draft));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;

    if (editing) {
      if (e.key === "Enter" && !e.altKey) {
        e.preventDefault();
        finishEdit(true);
        moveActive(e.shiftKey ? -1 : 1, 0, false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        finishEdit(true);
        moveActive(0, e.shiftKey ? -1 : 1, false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishEdit(false);
      }
      e.stopPropagation();
      return;
    }

    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };

    if (e.key in arrows) {
      e.preventDefault();
      moveActive(...arrows[e.key], e.shiftKey);
    } else if (e.key === "Tab") {
      e.preventDefault();
      moveActive(0, e.shiftKey ? -1 : 1, false);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      useTableSelection.getState().clear();
      inputRef.current?.blur();
    } else if ((e.key === "Delete" || e.key === "Backspace") && range) {
      e.preventDefault();
      write(clearValues(layer, range));
    } else if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      select({ r: lastRow, c: lastCol }, { r: 0, c: 0 });
    } else if (mod && (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "i") && range) {
      e.preventDefault();
      const field = e.key.toLowerCase() === "b" ? "b" : "i";
      write(styleRange(layer, range, { [field]: allHave(layer, range, field) ? undefined : 1 }));
    } else if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) actions.redo();
      else actions.undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      actions.redo();
    } else if (!mod && !e.altKey && e.key.length === 1) {
      // Typing replaces the cell: the character lands in the emptied box.
      startEdit("");
    } else if (!mod) {
      // Keys the canvas has shortcuts for must not fire while on a cell.
      e.stopPropagation();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (editing || !range) return;
    e.preventDefault();

    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const grid = parseDelimited(text);

    // One value into a selected block fills the whole block.
    if (grid.length === 1 && grid[0].length === 1) {
      write(updateRange(layer, range, (cell) => ({ ...cell, v: grid[0][0] })));
      return;
    }

    write(pasteGrid(layer, { r: range.r1, c: range.c1 }, grid));
    select(
      { r: range.r1, c: range.c1 },
      {
        r: range.r1 + grid.length - 1,
        c: range.c1 + Math.max(...grid.map((row) => row.length)) - 1,
      }
    );
  };

  const onCut = () => {
    // The browser copies the selected text; the cells are emptied after.
    if (!editing && range) write(clearValues(layer, range));
  };

  /** The canvas point under a pointer, through the table's own transform. */
  const canvasPoint = (
    element: SVGGraphicsElement,
    clientX: number,
    clientY: number
  ) => {
    const inverse = element.getScreenCTM()?.inverse();
    if (!inverse) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(inverse);
    return { x: point.x, y: point.y };
  };

  const onCellsPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;

    if (!(isSole && interactive)) {
      onPointerDown(e, id);
      return;
    }

    const element = e.currentTarget;
    const point = canvasPoint(element, e.clientX, e.clientY);
    const hit = point && cellAt(layer, point);
    if (!hit) return;

    e.stopPropagation();
    // Keeps the focus on the text box (a mouse down would move it away).
    e.preventDefault();
    finishEdit(true);

    const state = useTableSelection.getState();
    const alreadyThere =
      state.layerId === id &&
      state.active.r === hit.r &&
      state.active.c === hit.c &&
      state.anchor.r === hit.r &&
      state.anchor.c === hit.c;

    select(e.shiftKey && state.layerId === id ? state.anchor : hit, hit);
    inputRef.current?.focus({ preventScroll: true });

    // A second tap on the same cell edits it (there is no double click on
    // a phone).
    if (alreadyThere && e.pointerType === "touch") {
      trackPointer();
      startEdit(rawAt(layer, hit.r, hit.c));
      return;
    }

    const move = (ev: PointerEvent) => {
      const current = layerRef.current;
      const p = canvasPoint(element, ev.clientX, ev.clientY);
      if (!p) return;

      const over = cellAt(current, {
        x: clamp(p.x, current.x, current.x + current.width - 1),
        y: clamp(p.y, current.y, current.y + current.height - 1),
      });
      const now = useTableSelection.getState();
      if (over && (over.r !== now.active.r || over.c !== now.active.c)) {
        select(now.anchor, over);
      }
    };

    trackPointer(move);
  };

  const selectColumn = (e: React.PointerEvent, c: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    finishEdit(true);

    const state = useTableSelection.getState();
    const from = e.shiftKey && state.layerId === id ? state.anchor.c : c;
    select({ r: lastRow, c: from }, { r: 0, c });
    inputRef.current?.focus({ preventScroll: true });
    trackPointer();
  };

  const selectRow = (e: React.PointerEvent, r: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    finishEdit(true);

    const state = useTableSelection.getState();
    const from = e.shiftKey && state.layerId === id ? state.anchor.r : r;
    select({ r: from, c: lastCol }, { r, c: 0 });
    inputRef.current?.focus({ preventScroll: true });
    trackPointer();
  };

  const startResize = (
    e: React.PointerEvent<SVGRectElement>,
    axis: "col" | "row",
    index: number
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const base = layer;
    const startPos = axis === "col" ? e.clientX : e.clientY;
    const startSize = axis === "col" ? base.cols[index] : base.rows[index];
    actions.pauseHistory();

    const move = (ev: PointerEvent) => {
      const delta = ((axis === "col" ? ev.clientX : ev.clientY) - startPos) / scale;
      write(
        axis === "col"
          ? resizeCol(base, index, startSize + delta)
          : resizeRow(base, index, startSize + delta)
      );
    };

    trackPointer(move, () => actions.resumeHistory());
  };

  // ---- Drawing

  const color = colorToCss(fill);
  const font = layerFontFamily(layer.fontFamily ?? "sans");
  const fontSize = layer.fontSize ?? 14;
  const clipId = `tbl-${id}`;

  const gridPath =
    ys.map((edge) => `M ${x} ${y + edge} H ${x + width}`).join(" ") +
    " " +
    xs.map((edge) => `M ${x + edge} ${y} V ${y + height}`).join(" ");

  const cellEntries = Object.entries(cells).flatMap(([key, cell]) => {
    const [r, c] = key.split(",").map(Number);
    return r < rows.length && c < cols.length ? [{ r, c, cell }] : [];
  });

  const showHeaders = isSole && !readOnly;
  const activeBox = {
    x: x + xs[cur.c],
    y: y + ys[cur.r],
    width: cols[cur.c],
    height: rows[cur.r],
  };

  return (
    <g>
      <clipPath id={`${clipId}-clip`}>
        {cols.map((w, c) => (
          <rect key={c} x={x + xs[c]} y={y} width={w} height={height} />
        ))}
      </clipPath>

      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="white"
        pointerEvents="all"
        onPointerDown={onCellsPointerDown}
        onDoubleClick={() => {
          if (isSole && interactive && hasCells) startEdit();
        }}
      />

      <g pointerEvents="none">
        {layer.header && (
          <rect x={x} y={y} width={width} height={rows[0]} fill={TABLE_HEADER_ROW_FILL} />
        )}
        {cellEntries.map(({ r, c, cell }) =>
          cell.g ? (
            <rect
              key={`g${r},${c}`}
              x={x + xs[c]}
              y={y + ys[r]}
              width={cols[c]}
              height={rows[r]}
              fill={cell.g}
            />
          ) : null
        )}
        <path d={gridPath} stroke={color} strokeOpacity={0.3} strokeWidth={1} fill="none" />
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke={color}
          strokeOpacity={0.8}
          strokeWidth={1.5}
        />
        <g style={{ clipPath: `url(#${clipId}-clip)` }} fontFamily={font} fontSize={fontSize}>
          {cellEntries.map(({ r, c, cell }) => {
            const raw = cell.v ?? "";
            if (!raw) return null;

            const value = valueAt(r, c);
            const text = displayText(raw, value, cell);
            const align = cell.a ?? defaultAlign(value);
            const left = x + xs[c];
            const textX =
              align === "left"
                ? left + CELL_PADDING
                : align === "right"
                  ? left + cols[c] - CELL_PADDING
                  : left + cols[c] / 2;

            return (
              <text
                key={`t${r},${c}`}
                x={textX}
                y={y + ys[r] + rows[r] / 2}
                textAnchor={align === "left" ? "start" : align === "right" ? "end" : "middle"}
                dominantBaseline="central"
                fill={cell.c ?? color}
                fontWeight={cell.b || (layer.header && r === 0) ? 700 : 400}
                fontStyle={cell.i ? "italic" : "normal"}
              >
                {text}
              </text>
            );
          })}
        </g>
      </g>

      {selectionColor && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill="none"
          stroke={selectionColor}
          strokeWidth={1}
          pointerEvents="none"
        />
      )}

      {range && (
        <g pointerEvents="none">
          <rect
            x={x + xs[range.c1]}
            y={y + ys[range.r1]}
            width={xs[range.c2 + 1] - xs[range.c1]}
            height={ys[range.r2 + 1] - ys[range.r1]}
            fill={ACCENT}
            fillOpacity={0.1}
            stroke={ACCENT}
            strokeWidth={1}
          />
          <rect
            x={activeBox.x}
            y={activeBox.y}
            width={activeBox.width}
            height={activeBox.height}
            fill={editing ? "white" : "none"}
            stroke={ACCENT}
            strokeWidth={2}
          />
        </g>
      )}

      {showHeaders && (
        <g fontFamily="Inter, system-ui, sans-serif" fontSize={12}>
          {cols.map((w, c) => {
            const on = !!range && c >= range.c1 && c <= range.c2;
            return (
              <g key={`h${c}`}>
                <rect
                  x={x + xs[c]}
                  y={y - HEADER_HEIGHT}
                  width={w}
                  height={HEADER_HEIGHT}
                  fill={on ? HEADER_FILL_ACTIVE : HEADER_FILL}
                  stroke={HEADER_LINE}
                  style={{ cursor: interactive ? "pointer" : undefined }}
                  onPointerDown={(e) => interactive && selectColumn(e, c)}
                />
                <text
                  x={x + xs[c] + w / 2}
                  y={y - HEADER_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#495057"
                  pointerEvents="none"
                >
                  {colName(c)}
                </text>
                <rect
                  x={x + xs[c + 1] - 3}
                  y={y - HEADER_HEIGHT}
                  width={6}
                  height={HEADER_HEIGHT}
                  fill="transparent"
                  style={{ cursor: "col-resize" }}
                  onPointerDown={(e) => interactive && startResize(e, "col", c)}
                />
              </g>
            );
          })}
          {rows.map((h, r) => {
            const on = !!range && r >= range.r1 && r <= range.r2;
            return (
              <g key={`r${r}`}>
                <rect
                  x={x - HEADER_WIDTH}
                  y={y + ys[r]}
                  width={HEADER_WIDTH}
                  height={h}
                  fill={on ? HEADER_FILL_ACTIVE : HEADER_FILL}
                  stroke={HEADER_LINE}
                  style={{ cursor: interactive ? "pointer" : undefined }}
                  onPointerDown={(e) => interactive && selectRow(e, r)}
                />
                <text
                  x={x - HEADER_WIDTH / 2}
                  y={y + ys[r] + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#495057"
                  pointerEvents="none"
                >
                  {r + 1}
                </text>
                <rect
                  x={x - HEADER_WIDTH}
                  y={y + ys[r + 1] - 3}
                  width={HEADER_WIDTH}
                  height={6}
                  fill="transparent"
                  style={{ cursor: "row-resize" }}
                  onPointerDown={(e) => interactive && startResize(e, "row", r)}
                />
              </g>
            );
          })}
          {/* The corner moves the whole table. */}
          <rect
            x={x - HEADER_WIDTH}
            y={y - HEADER_HEIGHT}
            width={HEADER_WIDTH}
            height={HEADER_HEIGHT}
            fill={HEADER_FILL}
            stroke={HEADER_LINE}
            style={{ cursor: "move" }}
            onPointerDown={(e) => onPointerDown(e, id)}
          />
          <Move
            x={x - HEADER_WIDTH / 2 - 7}
            y={y - HEADER_HEIGHT / 2 - 7}
            width={14}
            height={14}
            color="#495057"
            pointerEvents="none"
          />
        </g>
      )}

      {hasCells && interactive && (
        <foreignObject
          x={activeBox.x}
          y={activeBox.y}
          width={activeBox.width}
          height={activeBox.height}
        >
          <textarea
            ref={inputRef}
            value={editing ? draft : tsv}
            onChange={(e) => {
              const text = e.target.value.replace(/\n/g, "");

              if (editing) {
                setDraft(text);
              } else if (text) {
                // Text that came in without a key press of its own (a phone
                // keyboard, an input method): it replaces the cell.
                setDraft(text);
                setEditing(true);
              }
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onCut={onCut}
            onBlur={() => finishEdit(true)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Cell ${colName(cur.c)}${cur.r + 1}`}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            wrap="off"
            rows={1}
            className="selection:bg-transparent"
            style={{
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              resize: "none",
              overflow: "hidden",
              border: "none",
              outline: "none",
              padding: `0 ${CELL_PADDING}px`,
              margin: 0,
              lineHeight: `${activeBox.height}px`,
              fontFamily: font,
              fontSize,
              whiteSpace: "pre",
              background: "transparent",
              color: editing ? (cells[cellKey(cur.r, cur.c)]?.c ?? color) : "transparent",
              caretColor: editing ? undefined : "transparent",
              textAlign: cells[cellKey(cur.r, cur.c)]?.a ?? "left",
              fontWeight: cells[cellKey(cur.r, cur.c)]?.b ? 700 : 400,
              fontStyle: cells[cellKey(cur.r, cur.c)]?.i ? "italic" : "normal",
            }}
          />
        </foreignObject>
      )}
    </g>
  );
};
