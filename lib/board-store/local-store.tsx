"use client";

import { nanoid } from "nanoid";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { Layer } from "@/types/canvas";

import { boundingBox, moveIds } from "./bounds";
import { BoardStoreContext } from "./context";
import { parseSnapshot } from "./validate";
import {
  MAX_LAYERS,
  type BoardActions,
  type BoardSnapshot,
  type BoardStore,
  type PencilDraft,
} from "./types";

// A board kept only in this browser (guest mode): no Liveblocks room, no
// account. Content is saved to localStorage; selection and history are kept
// in memory, like they are per user on a Liveblocks board.

export const GUEST_BOARD_STORAGE_KEY = "board:guest:v1";

const MAX_HISTORY = 100;
const SAVE_DELAY_MS = 300;

/** Reads the guest board from localStorage; empty when missing or invalid. */
export const loadGuestBoard = (): BoardSnapshot => {
  try {
    const raw = window.localStorage.getItem(GUEST_BOARD_STORAGE_KEY);
    const parsed = raw ? parseSnapshot(JSON.parse(raw)) : null;

    if (parsed) {
      return parsed;
    }
  } catch {
    // Unreadable or blocked storage: start with an empty board.
  }

  return { layers: {}, layerIds: [] };
};

export const clearGuestBoard = () => {
  try {
    window.localStorage.removeItem(GUEST_BOARD_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
};

const writeGuestBoard = (snapshot: BoardSnapshot) => {
  try {
    window.localStorage.setItem(
      GUEST_BOARD_STORAGE_KEY,
      JSON.stringify(snapshot)
    );
  } catch {
    // Storage full or blocked. The board still works for this visit.
  }
};

/** What undo/redo restores: the content plus the selection. */
type HistoryEntry = Required<Omit<BoardSnapshot, "background">> & {
  background: string | null;
  selection: string[];
};

type LocalState = HistoryEntry & {
  pencilDraft: PencilDraft | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  paused: boolean;
  /** Whether the paused group already has its history entry. */
  pausedEntryRecorded: boolean;
};

const entryOf = (state: LocalState): HistoryEntry => ({
  layers: state.layers,
  layerIds: state.layerIds,
  background: state.background,
  selection: state.selection,
});

/** The content of the state, as saved. */
const snapshotOf = ({
  layers,
  layerIds,
  background,
}: HistoryEntry): BoardSnapshot =>
  background ? { layers, layerIds, background } : { layers, layerIds };

const createLocalStore = (initial: BoardSnapshot) =>
  createStore<LocalState>(() => ({
    layers: initial.layers,
    layerIds: initial.layerIds,
    background: initial.background ?? null,
    selection: [],
    pencilDraft: null,
    past: [],
    future: [],
    paused: false,
    pausedEntryRecorded: false,
  }));

type LocalStore = StoreApi<LocalState>;

const createActions = (store: LocalStore): BoardActions => {
  const { getState: get, setState: set } = store;

  // Call before changing content or selection that should be undoable.
  const record = () => {
    const state = get();

    if (state.paused) {
      if (state.pausedEntryRecorded) {
        return;
      }

      set({ pausedEntryRecorded: true });
    }

    set({
      past: [...state.past, entryOf(state)].slice(-MAX_HISTORY),
      future: [],
    });
  };

  const updateLayers = (
    ids: readonly string[],
    update: (layer: Layer) => Layer
  ) => {
    const { layers } = get();
    const next = { ...layers };
    let changed = false;

    for (const id of ids) {
      const layer = layers[id];

      if (layer) {
        next[id] = update(layer);
        changed = true;
      }
    }

    if (changed) {
      record();
      set({ layers: next });
    }
  };

  return {
    insertLayer: (layer, options) => {
      const { layers, layerIds } = get();

      if (layerIds.length >= MAX_LAYERS) {
        return null;
      }

      const id = nanoid();
      record();
      set({
        layers: { ...layers, [id]: layer },
        layerIds: [...layerIds, id],
        ...(options?.select ? { selection: [id] } : {}),
      });

      return id;
    },
    updateLayer: (id, patch) =>
      updateLayers([id], (layer) => ({ ...layer, ...patch }) as Layer),
    translateLayers: (ids, offset) =>
      updateLayers(ids, (layer) => ({
        ...layer,
        x: layer.x + offset.x,
        y: layer.y + offset.y,
      })),
    setLayersFill: (ids, fill) =>
      updateLayers(ids, (layer) => ({ ...layer, fill })),
    deleteLayers: (ids) => {
      const { layers, layerIds } = get();
      const removed = new Set(ids);
      const next = { ...layers };

      for (const id of ids) {
        delete next[id];
      }

      record();
      set({
        layers: next,
        layerIds: layerIds.filter((id) => !removed.has(id)),
        selection: [],
      });
    },
    moveLayers: (ids, move) => {
      record();
      set({ layerIds: moveIds(get().layerIds, ids, move) });
    },
    setBackground: (color) => {
      if (get().background === color) return;
      record();
      set({ background: color });
    },
    replaceContent: (snapshot) => {
      const layerIds = snapshot.layerIds
        .filter((id) => snapshot.layers[id])
        .slice(0, MAX_LAYERS);

      record();
      set({
        layers: Object.fromEntries(
          layerIds.map((id) => [id, snapshot.layers[id]])
        ),
        layerIds,
        background: snapshot.background ?? null,
        selection: [],
      });
    },
    setSelection: (ids, options) => {
      if (options?.addToHistory) {
        record();
      }

      set({ selection: ids });
    },
    getSelection: () => get().selection,
    getSnapshot: () => snapshotOf(get()),
    setCursor: () => {
      // Nobody else to show the cursor to.
    },
    setPencilDraft: (pencilDraft) => set({ pencilDraft }),
    getPencilDraft: () => get().pencilDraft,
    setView: () => {
      // Nobody to follow this board.
    },
    setLaser: () => {
      // Nobody else to point at things for.
    },
    undo: () => {
      const state = get();
      const previous = state.past.at(-1);

      if (!previous) return;

      set({
        ...previous,
        past: state.past.slice(0, -1),
        future: [entryOf(state), ...state.future],
      });
    },
    redo: () => {
      const state = get();
      const [next, ...future] = state.future;

      if (!next) return;

      set({
        ...next,
        past: [...state.past, entryOf(state)],
        future,
      });
    },
    pauseHistory: () => set({ paused: true, pausedEntryRecorded: false }),
    resumeHistory: () => set({ paused: false, pausedEntryRecorded: false }),
  };
};

// Reactive reads, from the zustand store in context.

const LocalStoreContext = createContext<LocalStore | null>(null);

const useLocalState = <T,>(selector: (state: LocalState) => T): T => {
  const store = useContext(LocalStoreContext);

  if (!store) {
    throw new Error("Missing LocalBoardStoreProvider");
  }

  return useStore(store, selector);
};

const noRemoteSelections: Record<string, string> = {};

const readHooks = {
  useRemoteSelections: () => noRemoteSelections,
  useLayerIds: () => useLocalState((s) => s.layerIds),
  useLayer: (id: string) => useLocalState((s) => s.layers[id]),
  useSelection: () => useLocalState((s) => s.selection),
  useSelectedLayers: () =>
    useLocalState(
      useShallow((s) =>
        s.selection.map((id) => s.layers[id]).filter((layer) => !!layer)
      )
    ),
  useSelectionBounds: () =>
    useLocalState(
      useShallow((s) =>
        boundingBox(
          s.selection.map((id) => s.layers[id]).filter((layer) => !!layer)
        )
      )
    ),
  usePencilDraft: () => useLocalState((s) => s.pencilDraft),
  useBackground: () => useLocalState((s) => s.background),
  useOtherView: () => undefined,
  useLayerCount: () => useLocalState((s) => s.layerIds.length),
  useCanUndo: () => useLocalState((s) => s.past.length > 0),
  useCanRedo: () => useLocalState((s) => s.future.length > 0),
};

/** Writes content changes to localStorage, debounced. */
const createPersistence = (store: LocalStore) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const write = () => {
    timer = null;
    writeGuestBoard(snapshotOf(store.getState()));
  };

  return {
    schedule: () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(write, SAVE_DELAY_MS);
    },
    /** Writes a pending change now. */
    flush: () => {
      if (timer) {
        clearTimeout(timer);
        write();
      }
    },
    /** Drops pending writes and ignores later changes. */
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
};

type GuestBoardControls = {
  /**
   * Deletes the guest board from this browser and stops saving it (after it
   * was saved to the user's account).
   */
  clear: () => void;
};

const GuestBoardContext = createContext<GuestBoardControls | null>(null);

export const useGuestBoard = (): GuestBoardControls => {
  const controls = useContext(GuestBoardContext);

  if (!controls) {
    throw new Error("Missing LocalBoardStoreProvider");
  }

  return controls;
};

/**
 * Board store kept in this browser. Must render on the client only (it reads
 * localStorage when it is created).
 *
 * With `initial`, the board starts from that snapshot instead (read-only
 * share links); `persist={false}` keeps it out of localStorage.
 */
export const LocalBoardStoreProvider = ({
  children,
  initial,
  persist = true,
}: {
  children: React.ReactNode;
  initial?: BoardSnapshot;
  persist?: boolean;
}) => {
  const [store] = useState(() =>
    createLocalStore(initial ?? loadGuestBoard())
  );
  const [persistence] = useState(() => createPersistence(store));

  const boardStore = useMemo<BoardStore>(
    () => ({ ...readHooks, actions: createActions(store) }),
    [store]
  );

  const controls = useMemo<GuestBoardControls>(
    () => ({
      clear: () => {
        persistence.stop();
        clearGuestBoard();
      },
    }),
    [persistence]
  );

  // Save content changes, and flush when the page is hidden or the provider
  // unmounts, so the last change isn't lost.
  useEffect(() => {
    if (!persist) return;

    const unsubscribe = store.subscribe((state, previous) => {
      if (
        state.layers !== previous.layers ||
        state.layerIds !== previous.layerIds ||
        state.background !== previous.background
      ) {
        persistence.schedule();
      }
    });

    window.addEventListener("pagehide", persistence.flush);

    return () => {
      persistence.flush();
      unsubscribe();
      window.removeEventListener("pagehide", persistence.flush);
    };
  }, [store, persistence, persist]);

  return (
    <LocalStoreContext.Provider value={store}>
      <GuestBoardContext.Provider value={controls}>
        <BoardStoreContext.Provider value={boardStore}>
          {children}
        </BoardStoreContext.Provider>
      </GuestBoardContext.Provider>
    </LocalStoreContext.Provider>
  );
};
