"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Type,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hints";
import { Layer, LayerType } from "@/types/canvas";
import { useBoardStore } from "@/lib/board-store/context";

import { layerText } from "./plain-text-editable";
import { boardToSvg } from "./export";
import { MAX_LIBRARY_ITEMS, useLibrary, type LibraryItem } from "./library";

export type SidebarTab = "search" | "library" | "comments";

/** Width of the sidebar on wider screens (px). */
export const SIDEBAR_WIDTH = 320;

interface SidebarProps {
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
  onClose: () => void;
  /** Pinned: stays open while you work. Otherwise a click on the board closes it. */
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
  readOnly: boolean;
  /** Moves the view to a layer and marks it (search results). */
  showLayer: (id: string | null) => void;
  /** Adds copies of a library item in the middle of the view. */
  insertItem: (layers: readonly Layer[]) => void;
  /** The comments tab's list (live boards); no tab without it. */
  comments?: React.ReactNode;
}

const TABS: {
  id: SidebarTab;
  label: string;
  icon: typeof Search;
}[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "comments", label: "Comments", icon: MessageCircle },
];

/**
 * The panel at the right of the board: search its text, a personal
 * library of shapes to reuse, and its comments.
 */
export const Sidebar = ({
  tab,
  setTab,
  onClose,
  pinned,
  setPinned,
  readOnly,
  showLayer,
  insertItem,
  comments,
}: SidebarProps) => {
  const ref = useRef<HTMLElement>(null);
  const tabs = TABS.filter(
    (entry) =>
      (entry.id !== "library" || !readOnly) &&
      (entry.id !== "comments" || comments !== undefined)
  );

  // Unpinned, a click on the board closes it.
  useEffect(() => {
    if (pinned) return;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as Element).closest?.("svg[data-canvas]")) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinned, onClose]);

  return (
    <aside
      ref={ref}
      aria-label="Sidebar"
      className="absolute top-0 right-0 bottom-0 z-30 w-full sm:w-[320px] bg-white border-l border-neutral-200 shadow-xl flex flex-col"
    >
      <div className="flex items-center gap-x-1 border-b border-neutral-100 p-3">
        <div
          role="tablist"
          aria-label="Sidebar tabs"
          className="flex items-center gap-x-0.5 rounded-xl border border-neutral-200 p-1"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <Hint key={id} label={label} side="bottom" sideOffset={6}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-label={label}
                onClick={() => setTab(id)}
                className={cn(
                  "h-8 w-9 rounded-lg flex items-center justify-center transition-colors",
                  tab === id
                    ? "bg-indigo-500 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            </Hint>
          ))}
        </div>
        <div className="flex-1" />
        <Hint
          label={pinned ? "Unpin: close on a click on the board" : "Pin: keep open"}
          side="bottom"
          sideOffset={6}
        >
          <button
            type="button"
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
            aria-pressed={pinned}
            onClick={() => setPinned(!pinned)}
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center hover:bg-neutral-100",
              pinned ? "text-indigo-600" : "text-neutral-600"
            )}
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        </Hint>
        <Hint label="Close" side="bottom" sideOffset={6}>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </Hint>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === "search" && <SearchTab showLayer={showLayer} />}
        {tab === "library" && !readOnly && <LibraryTab insertItem={insertItem} />}
        {tab === "comments" && comments}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------- Search

type Match = {
  id: string;
  type: LayerType.Text | LayerType.Note;
  text: string;
  start: number;
  end: number;
};

const MAX_MATCHES = 200;

/** Every place the query appears in the board's text layers and notes. */
const findMatches = (
  layers: Record<string, Layer>,
  layerIds: readonly string[],
  query: string
): Match[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const matches: Match[] = [];
  for (const id of layerIds) {
    const layer = layers[id];
    if (layer?.type !== LayerType.Text && layer?.type !== LayerType.Note) {
      continue;
    }

    const text = layerText(layer.value);
    const haystack = text.toLowerCase();
    let from = haystack.indexOf(needle);
    while (from !== -1 && matches.length < MAX_MATCHES) {
      matches.push({
        id,
        type: layer.type,
        text,
        start: from,
        end: from + needle.length,
      });
      from = haystack.indexOf(needle, from + needle.length);
    }
  }

  return matches;
};

/** The match with some text around it, on one line. */
const Snippet = ({ match }: { match: Match }) => {
  const flat = (text: string) => text.replace(/\s+/g, " ");
  const before = flat(match.text.slice(Math.max(0, match.start - 24), match.start));
  const after = flat(match.text.slice(match.end, match.end + 60));

  return (
    <span className="block truncate">
      {match.start > 24 && "…"}
      {before}
      <strong className="font-semibold text-neutral-900">
        {flat(match.text.slice(match.start, match.end))}
      </strong>
      {after}
    </span>
  );
};

const SearchTab = ({ showLayer }: { showLayer: (id: string | null) => void }) => {
  const store = useBoardStore();
  // Re-runs the search as layers come and go.
  const layerIds = store.useLayerIds();
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => findMatches(store.actions.getSnapshot().layers, layerIds, query),
    [store.actions, layerIds, query]
  );
  const index = matches.length ? Math.min(current, matches.length - 1) : -1;
  const active = index >= 0 ? matches[index] : null;

  // Focus the box on the next frame (the click that opened it would
  // otherwise take focus back).
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  // Show the current result on the board; nothing marked once closed.
  useEffect(() => {
    showLayer(active?.id ?? null);
  }, [active?.id, active?.start, showLayer]);
  useEffect(() => () => showLayer(null), [showLayer]);

  const step = (by: 1 | -1) => {
    if (!matches.length) return;
    setCurrent((index + by + matches.length) % matches.length);
  };

  const groups = [
    { type: LayerType.Text, label: "Texts", icon: Type },
    { type: LayerType.Note, label: "Sticky notes", icon: StickyNote },
  ] as const;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-x-2 rounded-lg bg-neutral-100 px-3 focus-within:ring-2 focus-within:ring-indigo-400">
        <Search className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          ref={input}
          type="search"
          value={query}
          placeholder="Find on board"
          aria-label="Find text on the board"
          onChange={(e) => {
            setQuery(e.target.value);
            setCurrent(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
          className="h-10 w-full bg-transparent text-sm outline-hidden"
        />
      </label>

      {query.trim() && (
        <div className="flex items-center text-xs text-neutral-600">
          <span role="status" className="flex-1">
            {matches.length === 0
              ? "No results"
              : `${index + 1} / ${matches.length}${
                  matches.length >= MAX_MATCHES ? "+" : ""
                } result${matches.length === 1 ? "" : "s"}`}
          </span>
          <button
            type="button"
            aria-label="Next result"
            disabled={!matches.length}
            onClick={() => step(1)}
            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-neutral-100 disabled:opacity-40"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Previous result"
            disabled={!matches.length}
            onClick={() => step(-1)}
            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-neutral-100 disabled:opacity-40"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      )}

      {groups.map(({ type, label, icon: Icon }) => {
        const inGroup = matches
          .map((match, i) => ({ match, i }))
          .filter(({ match }) => match.type === type);
        if (inGroup.length === 0) return null;

        return (
          <section key={type} aria-label={label}>
            <h3 className="mb-1 flex items-center gap-x-1.5 text-xs font-semibold text-neutral-700">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </h3>
            <ul>
              {inGroup.map(({ match, i }) => (
                <li key={`${match.id}:${match.start}`}>
                  <button
                    type="button"
                    onClick={() => setCurrent(i)}
                    aria-current={i === index}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-sm text-neutral-600",
                      i === index ? "bg-indigo-50" : "hover:bg-neutral-50"
                    )}
                  >
                    <Snippet match={match} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

// --------------------------------------------------------------- Library

/** A picture of a library item, drawn like an export. */
const Thumbnail = ({ item }: { item: LibraryItem }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const layers = Object.fromEntries(
      item.layers.map((layer, i) => [`${item.id}-${i}`, layer])
    );

    void boardToSvg({ layers, layerIds: Object.keys(layers) }).then((result) => {
      if (!cancelled && result) {
        setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item]);

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-full w-full object-contain p-1.5" />
  ) : null;
};

const LibraryTab = ({
  insertItem,
}: {
  insertItem: (layers: readonly Layer[]) => void;
}) => {
  const store = useBoardStore();
  const selected = store.useSelectedLayers();
  const { items, add, remove } = useLibrary();

  const addSelection = () => {
    if (items.length >= MAX_LIBRARY_ITEMS) {
      toast.error(`The library holds ${MAX_LIBRARY_ITEMS} items. Remove one first.`);
      return;
    }
    if (add(selected)) toast.success("Added to your library");
    else toast.error("Couldn't save to the library");
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-indigo-600">
          Personal library
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Saved in this browser, for any board.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {selected.length > 0 && (
          <Hint label="Add the selection to the library" side="bottom">
            <button
              type="button"
              onClick={addSelection}
              aria-label="Add the selection to the library"
              className="aspect-square rounded-lg border-2 border-dashed border-indigo-300 text-indigo-500 flex items-center justify-center hover:bg-indigo-50"
            >
              <Plus className="h-5 w-5" />
            </button>
          </Hint>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-square rounded-lg border border-neutral-200 bg-white hover:border-indigo-400"
          >
            <button
              type="button"
              onClick={() => insertItem(item.layers)}
              aria-label="Add to the board"
              title="Add to the board"
              className="h-full w-full"
            >
              <Thumbnail item={item} />
              <span className="absolute inset-0 m-auto h-7 w-7 rounded-md bg-indigo-500 text-white items-center justify-center hidden group-hover:flex group-focus-within:flex">
                <Plus className="h-4 w-4" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label="Remove from the library"
              title="Remove from the library"
              className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full border border-neutral-200 bg-white text-neutral-500 items-center justify-center hidden group-hover:flex group-focus-within:flex hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {selected.length > 0
            ? "Add the selection with the + tile to reuse it on any board."
            : "Select shapes on the board, then add them here to reuse them on any board."}
        </p>
      )}
    </div>
  );
};
