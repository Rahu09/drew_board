"use client";

import Link from "next/link";
import {
  Command as CommandIcon,
  House,
  FolderOpen,
  HelpCircle,
  ImageDown,
  Menu,
  Monitor,
  Moon,
  Save,
  Search,
  Sun,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/hints";
import { cn } from "@/lib/utils";
import { shortcutLabel } from "@/lib/shortcuts";

import { useBoardTheme, type BoardTheme } from "./theme";
import type { ToolbarHome } from "./toolbar";

/** Canvas colors offered in the menu (Excalidraw's). */
export const BACKGROUNDS = [
  "#ffffff",
  "#f8f9fa",
  "#f5faff",
  "#fffce8",
  "#fdf8f6",
] as const;

const THEMES: { value: BoardTheme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export interface MainMenuProps {
  /** A way home at the top (phones, where the toolbar has no logo). */
  home?: ToolbarHome;
  /** Phones: a gray square button on its own. */
  standalone?: boolean;
  onOpenFile?: () => void;
  onSave: () => void;
  onExport: () => void;
  /** "Live collaboration…" (live boards). */
  onShare?: () => void;
  onPalette: () => void;
  onFind: () => void;
  onHelp: () => void;
  /** Clears the board (the canvas asks first). */
  onReset?: () => void;
  /** Board items (rename, links, delete…), after the common ones. */
  children?: React.ReactNode;
  background: string | null;
  onBackground?: (color: string | null) => void;
}

let afterClose: (() => void) | null = null;

/**
 * Runs `action` once the menu has closed and would otherwise move the
 * focus back to its button (e.g. to focus a field the action shows).
 */
export const runAfterMenuClose = (action: () => void) => {
  afterClose = action;
};

/** A menu row: icon, label and shortcut. */
export const MenuRow = ({
  icon: Icon,
  label,
  shortcut,
  onSelect,
  className,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onSelect: () => void;
  className?: string;
}) => (
  <DropdownMenuItem
    onSelect={onSelect}
    className={cn("h-9 cursor-pointer gap-x-3 px-2.5", className)}
  >
    <Icon className="h-4 w-4" strokeWidth={1.75} />
    <span className="flex-1">{label}</span>
    {shortcut && (
      <span className="text-xs text-muted-foreground">
        {shortcutLabel(shortcut)}
      </span>
    )}
  </DropdownMenuItem>
);

/** The board menu, opened from the button at the top left. */
export const MainMenu = ({
  home,
  standalone,
  onOpenFile,
  onSave,
  onExport,
  onShare,
  onPalette,
  onFind,
  onHelp,
  onReset,
  children,
  background,
  onBackground,
}: MainMenuProps) => {
  const { theme, setTheme } = useBoardTheme();
  const current = background ?? BACKGROUNDS[0];

  return (
    <DropdownMenu>
      <Hint label="Menu" side="bottom" sideOffset={10}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu"
            className={cn(
              "shrink-0 rounded-lg flex items-center justify-center text-neutral-800 data-[state=open]:bg-indigo-100",
              standalone
                ? "h-10 w-10 bg-[#ececf4] hover:bg-[#d9d9ef]"
                : "h-9 w-9 hover:bg-neutral-100"
            )}
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent
        align="start"
        sideOffset={10}
        onCloseAutoFocus={(e) => {
          if (!afterClose) return;
          const action = afterClose;
          afterClose = null;
          e.preventDefault();
          action();
        }}
        className="w-64 max-h-[calc(100vh-5rem)] overflow-y-auto p-2"
      >
        {home && (
          <>
            <DropdownMenuItem asChild className="h-9 cursor-pointer gap-x-3 px-2.5">
              <Link href={home.href}>
                <House className="h-4 w-4" strokeWidth={1.75} />
                {home.label}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2" />
          </>
        )}
        {onOpenFile && (
          <MenuRow
            icon={FolderOpen}
            label="Open"
            shortcut="Mod+O"
            onSelect={onOpenFile}
          />
        )}
        <MenuRow icon={Save} label="Save to…" shortcut="Mod+S" onSelect={onSave} />
        <MenuRow
          icon={ImageDown}
          label="Export image…"
          shortcut="Mod+Shift+E"
          onSelect={onExport}
        />
        {onShare && (
          <MenuRow
            icon={Users}
            label="Live collaboration…"
            onSelect={onShare}
          />
        )}
        <MenuRow
          icon={CommandIcon}
          label="Command palette"
          shortcut="Mod+/"
          onSelect={onPalette}
          className="font-semibold text-indigo-600 focus:text-indigo-700"
        />
        <MenuRow
          icon={Search}
          label="Find on canvas"
          shortcut="Mod+F"
          onSelect={onFind}
        />
        <MenuRow icon={HelpCircle} label="Help" shortcut="?" onSelect={onHelp} />
        {onReset && (
          <MenuRow icon={Trash2} label="Reset the canvas" onSelect={onReset} />
        )}

        {children && (
          <>
            <DropdownMenuSeparator className="my-2" />
            {children}
          </>
        )}

        <DropdownMenuSeparator className="my-2" />
        <div className="flex items-center justify-between px-2.5 py-1.5 text-sm">
          Theme
          <div
            role="radiogroup"
            aria-label="Theme"
            className="flex rounded-lg border border-neutral-200 p-0.5"
          >
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                aria-label={label}
                title={label}
                onClick={() => setTheme(value)}
                className={cn(
                  "h-7 w-8 rounded-md flex items-center justify-center",
                  theme === value
                    ? "bg-indigo-500 text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>

        {onBackground && (
          <div className="px-2.5 py-1.5">
            <p className="mb-2 text-sm">Canvas background</p>
            <div className="flex items-center gap-x-1.5">
              {BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Background ${color}`}
                  aria-pressed={current === color}
                  onClick={() =>
                    onBackground(color === BACKGROUNDS[0] ? null : color)
                  }
                  className={cn(
                    "h-7 w-7 rounded-md border border-neutral-300",
                    current === color && "ring-2 ring-indigo-500 ring-offset-1"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <div className="mx-0.5 h-6 w-px bg-neutral-200" />
              <label
                title="Custom color"
                className={cn(
                  "relative h-7 w-7 cursor-pointer overflow-hidden rounded-md border border-neutral-300",
                  !BACKGROUNDS.some((c) => c === current) &&
                    "ring-2 ring-indigo-500 ring-offset-1"
                )}
                style={{ backgroundColor: current }}
              >
                <span className="sr-only">Custom background color</span>
                <input
                  type="color"
                  value={current}
                  onChange={(e) => onBackground(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
