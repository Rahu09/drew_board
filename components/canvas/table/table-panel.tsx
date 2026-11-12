"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Italic,
} from "lucide-react";

import type { NumberFormat, TableLayer } from "@/types/canvas";
import type { BoardActions } from "@/lib/board-store/types";

import { Choice, ColorRow, Section, Swatch } from "../panel-controls";
import { refName } from "./formula";
import {
  allHave,
  cellKey,
  clearValues,
  deleteCols,
  deleteRows,
  fill,
  insertCols,
  insertRows,
  rangeOf,
  sortRows,
  styleRange,
  toCsv,
  wholeTable,
  type CellRange,
  type TablePatch,
} from "./model";
import { selectedRange, useTableSelection } from "./selection";

const TEXT_COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
const FILL_COLORS = ["#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99", "#e9ecef"];

const FORMATS: { value: NumberFormat | undefined; label: string; title: string }[] = [
  { value: undefined, label: "Auto", title: "Automatic" },
  { value: "num", label: "1.00", title: "Number, 2 decimals" },
  { value: "int", label: "1,000", title: "Whole number" },
  { value: "cur", label: "$", title: "Currency" },
  { value: "pct", label: "%", title: "Percent" },
];

const TextButton = ({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className="h-7 rounded-md bg-neutral-100 px-2 text-xs text-neutral-800 transition hover:bg-neutral-200 disabled:opacity-40"
  >
    {children}
  </button>
);

const downloadCsv = (layer: TableLayer) => {
  // The byte order mark makes Excel read it as UTF-8.
  const blob = new Blob(["﻿", toCsv(layer)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "table.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

interface TableSectionsProps {
  id: string;
  layer: TableLayer;
  actions: BoardActions;
}

/**
 * The table's part of the style panel: rows and columns, text style, number
 * format, colors and data tools. They work on the selected cells (or the
 * whole table when no cell is selected).
 */
export const TableSections = ({ id, layer, actions }: TableSectionsProps) => {
  const selection = useTableSelection();
  const lastRow = layer.rows.length - 1;
  const lastCol = layer.cols.length - 1;
  const clampCell = (cell: { r: number; c: number }) => ({
    r: Math.max(0, Math.min(lastRow, cell.r)),
    c: Math.max(0, Math.min(lastCol, cell.c)),
  });
  const picked = selectedRange(selection, id);
  const range: CellRange = picked
    ? rangeOf(clampCell({ r: picked.r1, c: picked.c1 }), clampCell({ r: picked.r2, c: picked.c2 }))
    : wholeTable(layer);
  const first = layer.cells[cellKey(range.r1, range.c1)];
  const rowCount = range.r2 - range.r1 + 1;
  const colCount = range.c2 - range.c1 + 1;

  const write = (patch: Partial<TablePatch> | { header: boolean }) =>
    actions.updateLayer(id, patch);

  const select = (anchor: { r: number; c: number }, active: { r: number; c: number }) =>
    useTableSelection.getState().select(id, anchor, active);

  const label = picked
    ? `${refName(range.r1, range.c1)}${
        rowCount * colCount > 1 ? `:${refName(range.r2, range.c2)}` : ""
      }`
    : "Whole table";

  const toggle = (field: "b" | "i") =>
    write(styleRange(layer, range, { [field]: allHave(layer, range, field) ? undefined : 1 }));

  const insertRowsAt = (at: number) => {
    write(insertRows(layer, at, rowCount));
    select({ r: at, c: lastCol }, { r: at, c: 0 });
  };
  const insertColsAt = (at: number) => {
    write(insertCols(layer, at, colCount));
    select({ r: lastRow, c: at }, { r: 0, c: at });
  };

  return (
    <>
      <Section title={`Cells: ${label}`}>
        <TextButton onClick={() => insertRowsAt(range.r1)} title="Insert rows above">
          + Row above
        </TextButton>
        <TextButton onClick={() => insertRowsAt(range.r2 + 1)} title="Insert rows below">
          + Row below
        </TextButton>
        <TextButton onClick={() => insertColsAt(range.c1)} title="Insert columns to the left">
          + Col left
        </TextButton>
        <TextButton onClick={() => insertColsAt(range.c2 + 1)} title="Insert columns to the right">
          + Col right
        </TextButton>
        <TextButton
          onClick={() => write(deleteRows(layer, range.r1, range.r2))}
          disabled={rowCount >= layer.rows.length}
          title="Delete the selected rows"
        >
          − Row{rowCount > 1 ? "s" : ""}
        </TextButton>
        <TextButton
          onClick={() => write(deleteCols(layer, range.c1, range.c2))}
          disabled={colCount >= layer.cols.length}
          title="Delete the selected columns"
        >
          − Col{colCount > 1 ? "s" : ""}
        </TextButton>
      </Section>

      <Section title="Cell text">
        <Choice label="Bold (Ctrl+B)" active={allHave(layer, range, "b")} onClick={() => toggle("b")}>
          <Bold className="h-4 w-4" />
        </Choice>
        <Choice label="Italic (Ctrl+I)" active={allHave(layer, range, "i")} onClick={() => toggle("i")}>
          <Italic className="h-4 w-4" />
        </Choice>
        {(
          [
            ["left", "Align left", AlignLeft],
            ["center", "Align center", AlignCenter],
            ["right", "Align right", AlignRight],
          ] as const
        ).map(([align, name, Icon]) => (
          <Choice
            key={align}
            label={name}
            active={first?.a === align}
            onClick={() =>
              write(styleRange(layer, range, { a: first?.a === align ? undefined : align }))
            }
          >
            <Icon className="h-4 w-4" />
          </Choice>
        ))}
      </Section>

      <Section title="Number format">
        {FORMATS.map((format) => (
          <Choice
            key={format.label}
            label={format.title}
            active={first?.n === format.value}
            onClick={() => write(styleRange(layer, range, { n: format.value }))}
          >
            <span className="text-[11px] font-medium">{format.label}</span>
          </Choice>
        ))}
      </Section>

      <Section title="Cell text color">
        <Swatch
          color="#1e1e1e"
          label="Default"
          active={!first?.c}
          onClick={() => write(styleRange(layer, range, { c: undefined }))}
        />
        <ColorRow
          colors={TEXT_COLORS}
          value={first?.c ?? null}
          onPick={(css) => write(styleRange(layer, range, { c: css }))}
          label="Cell text color"
        />
      </Section>

      <Section title="Cell fill">
        <Swatch
          color={null}
          label="No fill"
          active={!first?.g}
          onClick={() => write(styleRange(layer, range, { g: undefined }))}
        />
        <ColorRow
          colors={FILL_COLORS}
          value={first?.g ?? null}
          onPick={(css) => write(styleRange(layer, range, { g: css }))}
          label="Cell fill"
        />
      </Section>

      <Section title="Data">
        <TextButton
          onClick={() => write(sortRows(layer, range.c1, true, layer.header ? 1 : 0, lastRow))}
          disabled={lastRow < (layer.header ? 2 : 1)}
          title={`Sort the rows by column ${refName(0, range.c1).replace(/\d+/, "")}, A to Z`}
        >
          Sort A→Z
        </TextButton>
        <TextButton
          onClick={() => write(sortRows(layer, range.c1, false, layer.header ? 1 : 0, lastRow))}
          disabled={lastRow < (layer.header ? 2 : 1)}
          title="Sort the rows by this column, Z to A"
        >
          Sort Z→A
        </TextButton>
        <TextButton
          onClick={() => write(fill(layer, range, "down"))}
          disabled={rowCount < 2}
          title="Copy the top row of the selection down"
        >
          Fill down
        </TextButton>
        <TextButton
          onClick={() => write(fill(layer, range, "right"))}
          disabled={colCount < 2}
          title="Copy the left column of the selection right"
        >
          Fill right
        </TextButton>
        <TextButton onClick={() => write(clearValues(layer, range))} title="Empty the selected cells">
          Clear cells
        </TextButton>
        <TextButton
          onClick={() => write({ header: !layer.header })}
          title="Style the first row as a header"
        >
          Header row: {layer.header ? "on" : "off"}
        </TextButton>
        <TextButton onClick={() => downloadCsv(layer)} title="Download as a CSV file (opens in Excel)">
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" /> CSV
          </span>
        </TextButton>
      </Section>

      <p className="text-[11px] leading-snug text-neutral-500">
        Double-click a cell or just type. Start with = for a formula, e.g.
        =SUM(A1:A5). Paste from Excel or Sheets works too.
      </p>
    </>
  );
};
