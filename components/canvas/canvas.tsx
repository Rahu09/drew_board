"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Camera,
  CanvasMode,
  CanvasState,
  Color,
  LayerType,
  Point,
  Side,
  XYWH,
} from "@/types/canvas";
import {
  colorToCss,
  findIntersectingLayersWithRectangle,
  penPointsToPathLayer,
  pointerEventToCanvasPoint,
  resizeBounds,
} from "@/lib/utils";
import { useBoardStore } from "@/lib/board-store/context";
import { useDisableScrollBounce } from "@/hooks/use-disable-scroll-bounce";

import { Toolbar } from "./toolbar";
import { LayerPreview } from "./layer-preview";
import { SelectionBox } from "./selection-box";
import { SelectionTools } from "./selection-tools";
import { Path } from "./path";

// Outside the component on purpose: the React Compiler lint reads
// `state.current` as a ref access and refuses to keep the memoization.
const lastPointOf = (state: { current: Point }) => state.current;

const offsetBetween = (from: Point, to: Point): Point => ({
  x: to.x - from.x,
  y: to.y - from.y,
});

interface CanvasProps {
  /** Top-left panel: board title and menu. */
  header: React.ReactNode;
  /** Top-right panel: who is here (live boards) or sign-in actions (guest). */
  topRight?: React.ReactNode;
  /** Drawn on the canvas above the layers: other users' cursors and drafts. */
  overlay?: React.ReactNode;
}

/**
 * The drawing surface. Storage-agnostic: it reads and writes the board only
 * through the board store from context (Liveblocks or the browser).
 */
export const Canvas = ({ header, topRight, overlay }: CanvasProps) => {
  const store = useBoardStore();
  const { actions } = store;

  const layerIds = store.useLayerIds();
  const pencilDraft = store.usePencilDraft();
  const remoteSelections = store.useRemoteSelections();
  const canUndo = store.useCanUndo();
  const canRedo = store.useCanRedo();

  const [canvasState, setCanvasState] = useState<CanvasState>({
    mode: CanvasMode.None,
  });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0 });
  const [lastUsedColor, setLastUsedColor] = useState<Color>({
    r: 0,
    g: 0,
    b: 0,
  });

  useDisableScrollBounce();

  const insertLayer = useCallback(
    (
      layerType:
        | LayerType.Ellipse
        | LayerType.Rectangle
        | LayerType.Text
        | LayerType.Note,
      position: Point
    ) => {
      actions.insertLayer(
        {
          type: layerType,
          x: position.x,
          y: position.y,
          height: 100,
          width: 100,
          fill: lastUsedColor,
        },
        { select: true }
      );

      setCanvasState({ mode: CanvasMode.None });
    },
    [actions, lastUsedColor]
  );

  const continueDrawing = useCallback(
    (point: Point, e: React.PointerEvent) => {
      const draft = actions.getPencilDraft();

      if (
        canvasState.mode !== CanvasMode.Pencil ||
        e.buttons !== 1 ||
        draft == null
      ) {
        return;
      }

      actions.setPencilDraft(
        draft.length === 1 &&
          draft[0][0] === point.x &&
          draft[0][1] === point.y
          ? draft
          : [...draft, [point.x, point.y, e.pressure]]
      );
    },
    [actions, canvasState.mode]
  );

  const insertPath = useCallback(() => {
    const draft = actions.getPencilDraft();

    if (draft != null && draft.length >= 2) {
      actions.insertLayer(penPointsToPathLayer(draft, lastUsedColor));
    }

    actions.setPencilDraft(null);
    setCanvasState({ mode: CanvasMode.Pencil });
  }, [actions, lastUsedColor]);

  const startDrawing = useCallback(
    (point: Point, pressure: number) => {
      actions.setPencilDraft([[point.x, point.y, pressure]], lastUsedColor);
    },
    [actions, lastUsedColor]
  );

  const unselectLayers = useCallback(() => {
    if (actions.getSelection().length > 0) {
      actions.setSelection([], { addToHistory: true });
    }
  }, [actions]);

  const updateSelectionNet = useCallback(
    (current: Point, origin: Point) => {
      const { layers } = actions.getSnapshot();

      setCanvasState({
        mode: CanvasMode.SelectionNet,
        origin,
        current,
      });

      actions.setSelection(
        findIntersectingLayersWithRectangle(layerIds, layers, origin, current)
      );
    },
    [actions, layerIds]
  );

  const startMultiSelection = useCallback((current: Point, origin: Point) => {
    if (Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y) > 5) {
      setCanvasState({
        mode: CanvasMode.SelectionNet,
        origin,
        current,
      });
    }
  }, []);

  const resizeSelectedLayer = useCallback(
    (point: Point) => {
      if (canvasState.mode !== CanvasMode.Resizing) {
        return;
      }

      const [id] = actions.getSelection();

      if (id) {
        actions.updateLayer(
          id,
          resizeBounds(canvasState.initialBounds, canvasState.corner, point)
        );
      }
    },
    [actions, canvasState]
  );

  const onResizeHandlePointerDown = useCallback(
    (corner: Side, initialBounds: XYWH) => {
      actions.pauseHistory();
      setCanvasState({
        mode: CanvasMode.Resizing,
        initialBounds,
        corner,
      });
    },
    [actions]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    setCamera((camera) => ({
      x: camera.x - e.deltaX,
      y: camera.y - e.deltaY,
    }));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const point = pointerEventToCanvasPoint(e, camera);

      if (canvasState.mode === CanvasMode.Inserting) {
        return;
      }

      if (canvasState.mode === CanvasMode.Pencil) {
        startDrawing(point, e.pressure);
        return;
      }

      setCanvasState({ origin: point, mode: CanvasMode.Pressing });
    },
    [camera, canvasState.mode, startDrawing]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const point = pointerEventToCanvasPoint(e, camera);

      if (
        canvasState.mode === CanvasMode.None ||
        canvasState.mode === CanvasMode.Pressing
      ) {
        unselectLayers();
        setCanvasState({ mode: CanvasMode.None });
      } else if (canvasState.mode === CanvasMode.Pencil) {
        insertPath();
      } else if (canvasState.mode === CanvasMode.Inserting) {
        insertLayer(canvasState.layerType, point);
      } else {
        setCanvasState({ mode: CanvasMode.None });
      }

      actions.resumeHistory();
    },
    [actions, camera, canvasState, insertLayer, unselectLayers, insertPath]
  );

  const onLayerPointerDown = useCallback(
    (e: React.PointerEvent, layerId: string) => {
      if (
        canvasState.mode === CanvasMode.Pencil ||
        canvasState.mode === CanvasMode.Inserting
      ) {
        return;
      }

      actions.pauseHistory();
      e.stopPropagation();

      const point = pointerEventToCanvasPoint(e, camera);

      if (!actions.getSelection().includes(layerId)) {
        actions.setSelection([layerId], { addToHistory: true });
      }

      setCanvasState({ mode: CanvasMode.Translating, current: point });
    },
    [actions, camera, canvasState.mode]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      const current = pointerEventToCanvasPoint(e, camera);

      if (canvasState.mode === CanvasMode.Pressing) {
        startMultiSelection(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.SelectionNet) {
        updateSelectionNet(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.Translating) {
        actions.translateLayers(
          actions.getSelection(),
          offsetBetween(lastPointOf(canvasState), current)
        );
        setCanvasState({ mode: CanvasMode.Translating, current });
      } else if (canvasState.mode === CanvasMode.Resizing) {
        resizeSelectedLayer(current);
      } else if (canvasState.mode === CanvasMode.Pencil) {
        continueDrawing(current, e);
      }

      actions.setCursor(current);
    },
    [
      actions,
      continueDrawing,
      camera,
      canvasState,
      resizeSelectedLayer,
      startMultiSelection,
      updateSelectionNet,
    ]
  );

  const onPointerLeave = useCallback(() => {
    actions.setCursor(null);
  }, [actions]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) {
          actions.redo();
        } else {
          actions.undo();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [actions]);

  return (
    <main className="h-full w-full relative bg-neutral-100 touch-none">
      {header}
      {topRight}
      <Toolbar
        canvasState={canvasState}
        setCanvasState={setCanvasState}
        canRedo={canRedo}
        canUndo={canUndo}
        undo={actions.undo}
        redo={actions.redo}
      />
      <SelectionTools camera={camera} setLastUsedColor={setLastUsedColor} />
      <svg
        className="h-screen w-screen"
        onWheel={onWheel}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <g
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px)`,
          }}
        >
          {layerIds.map((layerId) => (
            <LayerPreview
              key={layerId}
              id={layerId}
              onLayerPointerDown={onLayerPointerDown}
              selectionColor={remoteSelections[layerId]}
            />
          ))}
          <SelectionBox onResizeHandlePointerDown={onResizeHandlePointerDown} />
          {canvasState.mode === CanvasMode.SelectionNet &&
            canvasState.current != null && (
              <rect
                className="fill-blue-500/5 stroke-blue-500 stroke-1"
                x={Math.min(canvasState.origin.x, canvasState.current.x)}
                y={Math.min(canvasState.origin.y, canvasState.current.y)}
                width={Math.abs(canvasState.origin.x - canvasState.current.x)}
                height={Math.abs(canvasState.origin.y - canvasState.current.y)}
              />
            )}
          {overlay}
          {pencilDraft != null && pencilDraft.length > 0 && (
            <Path
              points={pencilDraft}
              fill={colorToCss(lastUsedColor)}
              x={0}
              y={0}
            />
          )}
        </g>
      </svg>
    </main>
  );
};
