"use client";

import { useMemo } from "react";
import { nanoid } from "nanoid";
import { LiveObject, shallow } from "@liveblocks/client";

import {
  useCanRedo,
  useCanUndo,
  useHistory,
  useMutation,
  useOthers,
  useOthersMapped,
  useRoom,
  useSelf,
  useStorage,
  useUpdateMyPresence,
} from "@/liveblocks.config";
import { connectionIdToColor } from "@/lib/utils";
import type { Layer } from "@/types/canvas";

import { boundingBox, moveIds, type LayerMove } from "./bounds";
import { BoardStoreContext } from "./context";
import {
  MAX_LAYERS,
  type BoardActions,
  type BoardSnapshot,
  type BoardStore,
  type PencilDraft,
} from "./types";

// Reactive reads. Liveblocks returns immutable (readonly) copies of the
// storage, typed as such; the canvas never mutates them.

const useLayerIds = () => useStorage((root) => root.layerIds);

const useLayer = (id: string) =>
  useStorage((root) => root.layers[id]) as Layer | undefined;

const useLayerCount = () => useStorage((root) => root.layerIds.length);

const useSelection = () => useSelf((me) => me.presence.selection);

const usePencilDraft = () =>
  useSelf((me) => me.presence.pencilDraft) as PencilDraft | null;

const useSelectionBounds = () => {
  const selection = useSelection();

  return useStorage(
    (root) =>
      boundingBox(
        selection.map((id) => root.layers[id]).filter((layer) => !!layer)
      ),
    shallow
  );
};

const useSelectedLayers = () => {
  const selection = useSelection();

  return useStorage(
    (root) =>
      selection
        .map((id) => root.layers[id])
        .filter((layer) => !!layer) as Layer[],
    shallow
  );
};

const useBackground = () => useStorage((root) => root.background ?? null);

const useOtherView = (connectionId: number | null) =>
  useOthers((others) => {
    if (connectionId === null) return undefined;
    const other = others.find((o) => o.connectionId === connectionId);
    return other ? other.presence.view : undefined;
  }, shallow);

const useRemoteSelections = () => {
  const selections = useOthersMapped((other) => other.presence.selection);

  return useMemo(() => {
    const colors: Record<string, string> = {};

    for (const [connectionId, selection] of selections) {
      for (const layerId of selection) {
        colors[layerId] = connectionIdToColor(connectionId);
      }
    }

    return colors;
  }, [selections]);
};

const useLiveblocksActions = (): BoardActions => {
  const room = useRoom();
  const history = useHistory();
  const updateMyPresence = useUpdateMyPresence();

  const insertLayer = useMutation(
    (
      { storage, setMyPresence },
      layer: Layer,
      options?: { select?: boolean }
    ) => {
      const liveLayers = storage.get("layers");

      if (liveLayers.size >= MAX_LAYERS) {
        return null;
      }

      const id = nanoid();
      liveLayers.set(id, new LiveObject(layer));
      storage.get("layerIds").push(id);

      if (options?.select) {
        setMyPresence({ selection: [id] }, { addToHistory: true });
      }

      return id;
    },
    []
  );

  const updateLayer = useMutation(
    ({ storage }, id: string, patch: Partial<Layer>) => {
      storage.get("layers").get(id)?.update(patch);
    },
    []
  );

  const translateLayers = useMutation(
    ({ storage }, ids: readonly string[], offset: { x: number; y: number }) => {
      const liveLayers = storage.get("layers");

      for (const id of ids) {
        const layer = liveLayers.get(id);

        if (layer) {
          layer.update({
            x: layer.get("x") + offset.x,
            y: layer.get("y") + offset.y,
          });
        }
      }
    },
    []
  );

  const setLayersFill = useMutation(
    ({ storage }, ids: readonly string[], fill: Layer["fill"]) => {
      const liveLayers = storage.get("layers");

      for (const id of ids) {
        liveLayers.get(id)?.set("fill", fill);
      }
    },
    []
  );

  const deleteLayers = useMutation(
    ({ storage, setMyPresence }, ids: readonly string[]) => {
      const liveLayers = storage.get("layers");
      const liveLayerIds = storage.get("layerIds");

      for (const id of ids) {
        liveLayers.delete(id);

        const index = liveLayerIds.indexOf(id);

        if (index !== -1) {
          liveLayerIds.delete(index);
        }
      }

      setMyPresence({ selection: [] }, { addToHistory: true });
    },
    []
  );

  const reorder = useMutation(
    ({ storage }, ids: readonly string[], move: LayerMove) => {
      const liveLayerIds = storage.get("layerIds");
      const target = moveIds(liveLayerIds.toJSON(), ids, move);

      // Move each id into place, front to back of the target order.
      target.forEach((id, index) => {
        const from = liveLayerIds.indexOf(id);

        if (from !== index) {
          liveLayerIds.move(from, index);
        }
      });
    },
    []
  );

  const setBackground = useMutation(({ storage }, color: string | null) => {
    if (color) storage.set("background", color);
    else storage.delete("background");
  }, []);

  const replaceContent = useMutation(
    ({ storage, setMyPresence }, snapshot: BoardSnapshot) => {
      const liveLayers = storage.get("layers");
      const liveLayerIds = storage.get("layerIds");

      setMyPresence({ selection: [] }, { addToHistory: true });
      liveLayerIds.clear();
      for (const id of [...liveLayers.keys()]) {
        liveLayers.delete(id);
      }

      for (const id of snapshot.layerIds.slice(0, MAX_LAYERS)) {
        const layer = snapshot.layers[id];
        if (!layer) continue;

        liveLayers.set(id, new LiveObject(layer));
        liveLayerIds.push(id);
      }

      if (snapshot.background) storage.set("background", snapshot.background);
      else storage.delete("background");
    },
    []
  );

  return useMemo<BoardActions>(
    () => ({
      insertLayer,
      updateLayer,
      translateLayers,
      setLayersFill,
      deleteLayers,
      moveLayers: reorder,
      setBackground,
      replaceContent,
      setSelection: (ids, options) =>
        room.updatePresence(
          { selection: ids },
          { addToHistory: options?.addToHistory ?? false }
        ),
      getSelection: () => room.getPresence().selection,
      getSnapshot: (): BoardSnapshot => {
        const root = room.getStorageSnapshot();

        return root
          ? (root.toJSON() as BoardSnapshot)
          : { layers: {}, layerIds: [] };
      },
      setCursor: (cursor) => updateMyPresence({ cursor }),
      setPencilDraft: (pencilDraft, penColor) =>
        updateMyPresence(
          penColor ? { pencilDraft, penColor } : { pencilDraft }
        ),
      getPencilDraft: () => room.getPresence().pencilDraft,
      setView: (view) => updateMyPresence({ view }),
      setLaser: (laser) => updateMyPresence({ laser }),
      undo: history.undo,
      redo: history.redo,
      pauseHistory: history.pause,
      resumeHistory: history.resume,
    }),
    [
      room,
      history,
      updateMyPresence,
      insertLayer,
      updateLayer,
      translateLayers,
      setLayersFill,
      deleteLayers,
      reorder,
      setBackground,
      replaceContent,
    ]
  );
};

/** Board store backed by the current Liveblocks room (use inside <Room>). */
export const LiveblocksBoardStoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const actions = useLiveblocksActions();

  const store = useMemo<BoardStore>(
    () => ({
      useRemoteSelections,
      useLayerIds,
      useLayer,
      useSelection,
      useSelectionBounds,
      useSelectedLayers,
      usePencilDraft,
      useBackground,
      useOtherView,
      useLayerCount,
      useCanUndo,
      useCanRedo,
      actions,
    }),
    [actions]
  );

  return (
    <BoardStoreContext.Provider value={store}>
      {children}
    </BoardStoreContext.Provider>
  );
};
