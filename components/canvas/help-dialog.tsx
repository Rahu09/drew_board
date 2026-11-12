"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { shortcutLabel } from "@/lib/shortcuts";

/** Every keyboard shortcut of the board (see use-canvas-shortcuts.ts). */
const GROUPS: { title: string; items: [label: string, ...keys: string[]][] }[] =
  [
    {
      title: "Tools",
      items: [
        ["Select", "V"],
        ["Rectangle", "R"],
        ["Diamond", "D"],
        ["Ellipse", "O"],
        ["Arrow", "A"],
        ["Line", "L"],
        ["Table (spreadsheet)", "G"],
        ["Frame", "F"],
        ["Bucket fill", "B"],
        ["Pen", "P"],
        ["Text", "T"],
        ["Sticky note", "N"],
        ["Image", "I"],
        ["Comment", "C"],
        ["Hand (move the view)", "H"],
        ["Eraser", "E"],
        ["Laser pointer", "K"],
      ],
    },
    {
      title: "View",
      items: [
        ["Zoom in", "Mod+="],
        ["Zoom out", "Mod+-"],
        ["Reset zoom to 100%", "Mod+0"],
        ["Fit everything on screen", "Shift+1"],
        ["Move the view", "Scroll", "Middle drag"],
        ["Zoom with the wheel", "Mod+Scroll"],
        ["Find on canvas", "Mod+F"],
        ["Command palette", "Mod+/"],
        ["Keyboard shortcuts", "?"],
      ],
    },
    {
      title: "Editing",
      items: [
        ["Undo", "Mod+Z"],
        ["Redo", "Mod+Shift+Z", "Mod+Y"],
        ["Select all", "Mod+A"],
        ["Duplicate", "Mod+D"],
        ["Copy", "Mod+C"],
        ["Cut", "Mod+X"],
        ["Paste", "Mod+V"],
        ["Delete", "Delete"],
        ["Bring forward", "Mod+]"],
        ["Send backward", "Mod+["],
        ["Bring to front", "Mod+Shift+]"],
        ["Send to back", "Mod+Shift+["],
        ["Larger text", "Mod+Shift+>"],
        ["Smaller text", "Mod+Shift+<"],
        ["Square, circle, 45° arrow", "Shift+Drag"],
        ["Stop editing, deselect", "Escape"],
      ],
    },
  ];

const Key = ({ children }: { children: string }) => (
  <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-sans text-xs text-neutral-700">
    {children}
  </kbd>
);

/** "Help": the keyboard shortcuts. */
export const HelpDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
      <div>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription className="mt-1">
          Faster ways to draw and get around the board.
        </DialogDescription>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-sm font-semibold text-indigo-600">
              {group.title}
            </h3>
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {group.items.map(([label, ...keys]) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-x-3 px-3 py-2 text-sm"
                >
                  <span className="text-neutral-700">{label}</span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {keys.map((key) => (
                      <Key key={key}>{shortcutLabel(key)}</Key>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
