"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Loader } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BoardSnapshot } from "@/lib/board-store/types";

import {
  boardToBlob,
  boardToSvg,
  exportBoard,
  type ExportFormat,
  type ExportOptions,
} from "./export";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The board as it is now (read when the dialog opens). */
  getSnapshot: () => BoardSnapshot;
  /** Selected layers; with some, "Only selected" is offered. */
  selection: readonly string[];
  /** File name, without the extension. */
  name: string;
}

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-x-4 text-sm">
    {label}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-indigo-500" : "bg-neutral-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  </label>
);

/** "Export image…": a preview, a few options, and PNG / SVG / copy. */
export const ExportDialog = ({
  open,
  onOpenChange,
  getSnapshot,
  selection,
  name,
}: ExportDialogProps) => {
  const [onlySelected, setOnlySelected] = useState(true);
  const [background, setBackground] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasSelection = selection.length > 0;

  const options: ExportOptions = {
    ids: hasSelection && onlySelected ? selection : undefined,
    background,
  };
  const idsKey = options.ids?.join() ?? "";

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void boardToSvg(getSnapshot(), {
      ids: idsKey ? idsKey.split(",") : undefined,
      background,
    }).then((result) => {
      if (cancelled) return;
      setPreview(
        result
          ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`
          : null
      );
    });

    return () => {
      cancelled = true;
    };
  }, [open, getSnapshot, idsKey, background]);

  const save = async (format: ExportFormat) => {
    setBusy(true);
    try {
      const exported = await exportBoard(getSnapshot(), format, name, options);
      if (!exported) toast.info("Nothing to export yet");
    } catch {
      toast.error("Couldn't export the board");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setBusy(true);
    try {
      const blob = await boardToBlob(getSnapshot(), "png", options);
      if (!blob) {
        toast.info("Nothing to export yet");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success("Copied as PNG");
    } catch {
      toast.error("Couldn't copy the image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
        <div className="grid sm:grid-cols-[1fr_240px]">
          <div
            className="flex h-64 sm:h-80 items-center justify-center p-6"
            style={{
              backgroundColor: "#f8f9fa",
              backgroundImage: background
                ? undefined
                : "repeating-conic-gradient(#e9ecef 0% 25%, transparent 0% 50%)",
              backgroundSize: "16px 16px",
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Preview of the export"
                className="max-h-full max-w-full object-contain shadow-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing to export yet
              </p>
            )}
          </div>
          <div className="flex flex-col gap-y-4 p-6">
            <div>
              <DialogTitle className="text-lg">Export image</DialogTitle>
              <DialogDescription className="mt-1">
                Download the board as a picture, or copy it.
              </DialogDescription>
            </div>
            {hasSelection && (
              <Toggle
                label="Only selected"
                checked={onlySelected}
                onChange={setOnlySelected}
              />
            )}
            <Toggle
              label="Background"
              checked={background}
              onChange={setBackground}
            />
            <div className="mt-auto flex flex-col gap-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="bg-indigo-500 hover:bg-indigo-600"
                  disabled={busy || !preview}
                  onClick={() => void save("png")}
                >
                  <Download />
                  PNG
                </Button>
                <Button
                  className="bg-indigo-500 hover:bg-indigo-600"
                  disabled={busy || !preview}
                  onClick={() => void save("svg")}
                >
                  <Download />
                  SVG
                </Button>
              </div>
              <Button
                variant="outline"
                disabled={busy || !preview}
                onClick={() => void copy()}
              >
                {busy ? <Loader className="animate-spin" /> : <Copy />}
                Copy to clipboard
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
