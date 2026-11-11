"use client";

import { useMemo, useRef, useState } from "react";
import { Search, type LucideIcon } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { shortcutLabel } from "@/lib/shortcuts";

export type Command = {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  /** Also matched by the search, not shown. */
  keywords?: string;
  run: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
}

const matches = (command: Command, query: string) => {
  const text = `${command.label} ${command.group} ${command.keywords ?? ""}`
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
};

/** Mod+/: every action of the board, searchable, run with Enter. */
export const CommandPalette = ({
  open,
  onOpenChange,
  commands,
}: CommandPaletteProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl gap-0 p-0 overflow-hidden top-[15%] translate-y-0 [&>button:last-child]:hidden">
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      {/* Remounted on each open, so it starts empty. */}
      {open && (
        <PaletteBody
          commands={commands}
          onRun={(command) => {
            onOpenChange(false);
            // After the dialog has closed and given focus back.
            requestAnimationFrame(() => command.run());
          }}
        />
      )}
    </DialogContent>
  </Dialog>
);

const PaletteBody = ({
  commands,
  onRun,
}: {
  commands: Command[];
  onRun: (command: Command) => void;
}) => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(
    () => commands.filter((command) => matches(command, query)),
    [commands, query]
  );
  const current = Math.min(active, Math.max(results.length - 1, 0));

  const moveTo = (index: number) => {
    setActive(index);
    list.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  return (
    <>
      <div className="flex items-center gap-x-2 border-b px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          placeholder="Search menus, actions and tools"
          aria-label="Search commands"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              moveTo(Math.min(current + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              moveTo(Math.max(current - 1, 0));
            } else if (e.key === "Enter" && results[current]) {
              e.preventDefault();
              onRun(results[current]);
            }
          }}
          className="h-12 flex-1 bg-transparent text-sm outline-hidden"
        />
      </div>
      <ul ref={list} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
        {results.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No matching commands
          </li>
        )}
        {results.map((command, index) => {
          const Icon = command.icon;
          const groupStart =
            index === 0 || results[index - 1].group !== command.group;

          return (
            <li key={command.id} role="presentation">
              {groupStart && (
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                  {command.group}
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={index === current}
                data-index={index}
                onMouseMove={() => setActive(index)}
                onClick={() => onRun(command)}
                className={cn(
                  "flex w-full items-center gap-x-3 rounded-md px-3 py-2 text-left text-sm",
                  index === current && "bg-indigo-50 text-indigo-900"
                )}
              >
                {Icon ? (
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                ) : (
                  <span className="w-4" />
                )}
                <span className="flex-1 truncate">{command.label}</span>
                {command.shortcut && (
                  <span className="text-xs text-muted-foreground">
                    {shortcutLabel(command.shortcut)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};
