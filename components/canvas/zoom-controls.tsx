"use client";

import {
  Copy,
  Minus,
  Palette,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { Hint } from "@/components/hints";
import { cn } from "@/lib/utils";
import { withShortcut } from "@/lib/shortcuts";
import { MAX_LAYERS } from "@/lib/board-store/types";

import { LAYER_COUNT_WARNING } from "./layer-limit";
import { MAX_SCALE, MIN_SCALE } from "./camera";

interface ZoomControlsProps {
  scale: number;
  layerCount: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** Undo and redo (not on read-only boards). */
  history?: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center rounded-lg bg-[#ececf4] p-0.5">
    {children}
  </div>
);

const PillButton = ({
  label,
  shortcut,
  icon: Icon,
  onClick,
  disabled,
  large,
  pressed,
}: {
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  /** Phones: bigger, easier to tap. */
  large?: boolean;
  pressed?: boolean;
}) => (
  <Hint
    label={shortcut ? withShortcut(label, shortcut) : label}
    side="top"
    sideOffset={8}
  >
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        large ? "h-9 w-10" : "h-8 w-9",
        pressed && "bg-indigo-100 text-indigo-900 hover:bg-indigo-100",
        "rounded-md flex items-center justify-center text-neutral-800 hover:bg-[#d9d9ef]",
        "disabled:text-neutral-400 disabled:hover:bg-transparent"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  </Hint>
);

/** "80 of 100 shapes", once a board gets near the limit. */
const LayerCount = ({ count }: { count: number }) => {
  if (count < LAYER_COUNT_WARNING) return null;
  const isFull = count >= MAX_LAYERS;

  return (
    <p
      role="status"
      className={
        isFull
          ? "rounded-md bg-red-50 text-red-700 border border-red-200 px-2 py-1 text-xs shadow-sm"
          : "rounded-md bg-white text-muted-foreground px-2 py-1 text-xs shadow-sm"
      }
    >
      {isFull
        ? `Board full: ${MAX_LAYERS} of ${MAX_LAYERS} shapes`
        : `${count} of ${MAX_LAYERS} shapes`}
    </p>
  );
};

/** Bottom left, like Excalidraw: zoom out / level / in, then undo / redo. */
export const ZoomControls = ({
  scale,
  layerCount,
  onZoomIn,
  onZoomOut,
  onReset,
  history,
}: ZoomControlsProps) => {
  return (
    <div className="absolute left-2 bottom-[62px] lg:bottom-2 z-10 flex flex-col items-start gap-y-2">
      <LayerCount count={layerCount} />
      <div className="flex items-center gap-x-2">
        <Pill>
          <PillButton
            label="Zoom out"
            shortcut="Mod+-"
            icon={Minus}
            onClick={onZoomOut}
            disabled={scale <= MIN_SCALE}
          />
          <Hint label={withShortcut("Reset zoom", "Mod+0")} side="top" sideOffset={8}>
            <button
              type="button"
              onClick={onReset}
              aria-label={`Zoom ${Math.round(scale * 100)}%, reset to 100%`}
              className="h-8 w-14 rounded-md text-xs tabular-nums text-neutral-800 hover:bg-[#d9d9ef]"
            >
              {Math.round(scale * 100)}%
            </button>
          </Hint>
          <PillButton
            label="Zoom in"
            shortcut="Mod+="
            icon={Plus}
            onClick={onZoomIn}
            disabled={scale >= MAX_SCALE}
          />
        </Pill>
        {history && (
          <Pill>
            <PillButton
              label="Undo"
              shortcut="Mod+Z"
              icon={Undo2}
              onClick={history.undo}
              disabled={!history.canUndo}
            />
            <PillButton
              label="Redo"
              shortcut="Mod+Shift+Z"
              icon={Redo2}
              onClick={history.redo}
              disabled={!history.canRedo}
            />
          </Pill>
        )}
      </div>
    </div>
  );
};

interface PhoneActionsProps {
  layerCount: number;
  history: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
  hasSelection: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Whether the style sheet is open (toggled by the palette button). */
  stylesOpen: boolean;
  onToggleStyles: () => void;
}

/**
 * Phones, above the bottom toolbar (like Excalidraw): the style sheet at
 * the left; undo, redo, duplicate and delete at the right. Pinch zooms.
 */
export const PhoneActions = ({
  layerCount,
  history,
  hasSelection,
  onDuplicate,
  onDelete,
  stylesOpen,
  onToggleStyles,
}: PhoneActionsProps) => (
  <div className="absolute left-2 right-2 bottom-[66px] z-10 flex flex-col gap-y-2 pointer-events-none">
    <LayerCount count={layerCount} />
    <div className="flex items-center justify-between gap-x-2 [&>*]:pointer-events-auto">
      {hasSelection ? (
        <Pill>
          <PillButton
            label="Style"
            icon={Palette}
            onClick={onToggleStyles}
            pressed={stylesOpen}
            large
          />
        </Pill>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-x-2">
        <Pill>
          <PillButton
            label="Undo"
            icon={Undo2}
            onClick={history.undo}
            disabled={!history.canUndo}
            large
          />
          <PillButton
            label="Redo"
            icon={Redo2}
            onClick={history.redo}
            disabled={!history.canRedo}
            large
          />
        </Pill>
        <Pill>
          <PillButton
            label="Duplicate"
            icon={Copy}
            onClick={onDuplicate}
            disabled={!hasSelection}
            large
          />
          <PillButton
            label="Delete"
            icon={Trash2}
            onClick={onDelete}
            disabled={!hasSelection}
            large
          />
        </Pill>
      </div>
    </div>
  </div>
);
