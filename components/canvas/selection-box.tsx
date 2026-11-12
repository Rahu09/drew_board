"use client";

import { memo } from "react";
import { useMediaQuery } from "usehooks-ts";

import { LayerType, Side, XYWH, isLinearLayer } from "@/types/canvas";
import { useBoardStore } from "@/lib/board-store/context";

import { arrowEndpoints } from "@/lib/canvas-geometry";

import { useCameraScale } from "./camera-context";

interface SelectionBoxProps {
  onResizeHandlePointerDown: (corner: Side, initialBounds: XYWH) => void;
  /** Dragging the start (0) or end (1) of the selected arrow. */
  onArrowHandlePointerDown: (id: string, end: 0 | 1) => void;
}

/** Handle size on screen, in pixels: bigger for fingers. */
const HANDLE_SIZE = { mouse: 8, touch: 16 };

/** Each handle: the sides it moves, where it sits (0–1 of the box), cursor. */
const HANDLES: { side: Side; x: number; y: number; cursor: string }[] = [
  { side: Side.Top + Side.Left, x: 0, y: 0, cursor: "nwse-resize" },
  { side: Side.Top, x: 0.5, y: 0, cursor: "ns-resize" },
  { side: Side.Top + Side.Right, x: 1, y: 0, cursor: "nesw-resize" },
  { side: Side.Right, x: 1, y: 0.5, cursor: "ew-resize" },
  { side: Side.Bottom + Side.Right, x: 1, y: 1, cursor: "nwse-resize" },
  { side: Side.Bottom, x: 0.5, y: 1, cursor: "ns-resize" },
  { side: Side.Bottom + Side.Left, x: 0, y: 1, cursor: "nesw-resize" },
  { side: Side.Left, x: 0, y: 0.5, cursor: "ew-resize" },
];

export const SelectionBox = memo(
  ({ onResizeHandlePointerDown, onArrowHandlePointerDown }: SelectionBoxProps) => {
    const store = useBoardStore();
    const selection = store.useSelection();
    const soleLayer = store.useLayer(
      selection.length === 1 ? selection[0] : ""
    );
    const scale = useCameraScale();
    const isTouch = useMediaQuery("(pointer: coarse)");

    // Paths can't be resized; arrows have a handle at each end instead.
    const isShowingHandles =
      !!soleLayer &&
      soleLayer.type !== LayerType.Path &&
      soleLayer.type !== LayerType.Table &&
      !isLinearLayer(soleLayer);

    const bounds = store.useSelectionBounds();

    if (!bounds) {
      return null;
    }

    // Canvas units, so the handles keep their screen size at any zoom.
    const size = (isTouch ? HANDLE_SIZE.touch : HANDLE_SIZE.mouse) / scale;

    if (soleLayer && isLinearLayer(soleLayer)) {
      const id = selection[0];

      return (
        <>
          {arrowEndpoints(soleLayer).map((point, end) => (
            <circle
              key={end}
              className="fill-white stroke-1 stroke-blue-500"
              vectorEffect="non-scaling-stroke"
              cx={point.x}
              cy={point.y}
              r={size / 1.6}
              style={{ cursor: "move" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onArrowHandlePointerDown(id, end as 0 | 1);
              }}
            />
          ))}
        </>
      );
    }

    return (
      <>
        <rect
          className="fill-transparent stroke-blue-500 stroke-1 pointer-events-none"
          vectorEffect="non-scaling-stroke"
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
        />
        {isShowingHandles &&
          HANDLES.map((handle) => (
            <rect
              key={handle.side}
              className="fill-white stroke-1 stroke-blue-500"
              vectorEffect="non-scaling-stroke"
              x={bounds.x + bounds.width * handle.x - size / 2}
              y={bounds.y + bounds.height * handle.y - size / 2}
              width={size}
              height={size}
              style={{ cursor: handle.cursor }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizeHandlePointerDown(handle.side, bounds);
              }}
            />
          ))}
      </>
    );
  }
);

SelectionBox.displayName = "SelectionBox";
