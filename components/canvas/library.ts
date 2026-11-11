"use client";

import { useCallback, useSyncExternalStore } from "react";
import { nanoid } from "nanoid";

import type { Layer } from "@/types/canvas";
import { parseLayer } from "@/lib/board-store/validate";

/**
 * The personal library: groups of shapes saved to reuse on any board. Kept
 * in this browser (like Excalidraw's), so it works on guest boards too.
 */
export type LibraryItem = {
  id: string;
  createdAt: number;
  layers: Layer[];
};

const KEY = "board:library:v1";
/** Keeps localStorage use small. */
export const MAX_LIBRARY_ITEMS = 50;

const EMPTY: LibraryItem[] = [];
let cache: { raw: string | null; items: LibraryItem[] } | null = null;
const listeners = new Set<() => void>();

/** Saved items, checked like board data: anything invalid is dropped. */
const parse = (raw: string | null): LibraryItem[] => {
  if (!raw) return EMPTY;

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;

    return value.flatMap((entry): LibraryItem[] => {
      if (!entry || typeof entry !== "object") return [];
      const { id, createdAt, layers } = entry as Record<string, unknown>;
      if (typeof id !== "string" || !Array.isArray(layers)) return [];

      const parsed = layers
        .map(parseLayer)
        .filter((layer): layer is Layer => layer !== null);
      if (parsed.length === 0) return [];

      return [
        {
          id,
          createdAt: typeof createdAt === "number" ? createdAt : 0,
          layers: parsed,
        },
      ];
    });
  } catch {
    return EMPTY;
  }
};

const read = (): LibraryItem[] => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: an empty library.
  }

  if (cache?.raw !== raw) cache = { raw, items: parse(raw) };
  return cache.items;
};

const write = (items: LibraryItem[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Other tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

/** The library, newest first, and ways to change it. */
export const useLibrary = () => {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);

  /** Saves layers as one item. False when the library is full or storage fails. */
  const add = useCallback((layers: readonly Layer[]) => {
    const current = read();
    if (layers.length === 0 || current.length >= MAX_LIBRARY_ITEMS) {
      return false;
    }

    return write([
      { id: nanoid(), createdAt: Date.now(), layers: structuredClone([...layers]) },
      ...current,
    ]);
  }, []);

  const remove = useCallback(
    (id: string) => write(read().filter((item) => item.id !== id)),
    []
  );

  return { items, add, remove };
};
