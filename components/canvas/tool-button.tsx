"use client";

import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hints";
import { withShortcut } from "@/lib/shortcuts";

interface ToolButtonProps {
  label: string;
  /**
   * Shown in the tooltip, e.g. "R" or "Mod+Z" (see lib/shortcuts.ts); a
   * single key is also shown small in the button's corner.
   */
  shortcut?: string;
  icon: LucideIcon;
  onClick: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
  /** Tooltip side; default below. */
  side?: "top" | "bottom";
  /** "lg": the bigger touch targets of the phone toolbar. */
  size?: "md" | "lg";
}

/** A compact square button of the toolbar or the undo bar. */
export const ToolButton = ({
  label,
  shortcut,
  icon: Icon,
  onClick,
  isActive,
  isDisabled,
  side = "bottom",
  size = "md",
}: ToolButtonProps) => {
  return (
    <Hint label={withShortcut(label, shortcut)} side={side} sideOffset={8}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={onClick}
        aria-label={label}
        aria-pressed={isActive}
        className={cn(
          "relative rounded-lg flex items-center justify-center text-neutral-800 transition-colors disabled:opacity-40 disabled:pointer-events-none",
          // Phones: as wide as fits, so the whole row fits any phone.
          size === "lg" ? "h-11 min-w-0 flex-1 max-w-11" : "h-9 w-9 shrink-0",
          isActive
            ? "bg-indigo-100 text-indigo-900"
            : "hover:bg-neutral-100"
        )}
      >
        <Icon
          className={size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]"}
          strokeWidth={1.75}
        />
        {shortcut && shortcut.length === 1 && (
          <span
            aria-hidden
            className="absolute bottom-0.5 right-1 text-[9px] leading-none text-neutral-400"
          >
            {shortcut}
          </span>
        )}
      </button>
    </Hint>
  );
};
