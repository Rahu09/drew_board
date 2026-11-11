"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useRename } from "@/store/use-rename";
import { useRenameBoard } from "@/hooks/use-board-mutations";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_TITLE_LENGTH = 60;

interface InlineTitleInputProps {
  id: string;
  title: string;
  className?: string;
}

/**
 * The board title as a text field, while it is being renamed in place:
 * Enter or leaving the field saves, Escape cancels.
 */
export const InlineTitleInput = ({
  id,
  title,
  className,
}: InlineTitleInputProps) => {
  const [value, setValue] = useState(title);
  const stop = useRename((state) => state.stop);
  const rename = useRenameBoard();
  // Escape: the field may still blur as it goes away; don't save then.
  const cancelled = useRef(false);

  const save = () => {
    stop();
    const next = value.trim();
    if (cancelled.current || !next || next === title) return;

    rename({ id: id as Id<"boards">, title: next }).catch(() =>
      toast.error("Failed to rename board")
    );
  };

  return (
    <input
      aria-label="Board name"
      autoFocus
      maxLength={MAX_TITLE_LENGTH}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={save}
      onKeyDown={(e) => {
        // Keep board shortcuts (Delete, V, …) out of it.
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          stop();
        }
      }}
      className={cn(
        "min-w-0 rounded-md border border-indigo-400 bg-background px-1.5 outline-none ring-2 ring-indigo-200",
        className
      )}
    />
  );
};
