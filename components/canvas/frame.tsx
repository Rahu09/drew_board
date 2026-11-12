"use client";

import { useState } from "react";

import { FrameLayer } from "@/types/canvas";
import { colorToCss } from "@/lib/utils";
import { useBoardStore } from "@/lib/board-store/context";

import { useCanvasReadOnly } from "./read-only-context";
import { cleanShapePath } from "./rough-shape";
import { HIT_STROKE_WIDTH } from "./shape-style";

interface FrameProps {
  id: string;
  layer: FrameLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

const LABEL_HEIGHT = 26;
const LABEL_FONT = 15;
const MAX_NAME_LENGTH = 60;

/**
 * A frame: a named area with a round outline. Its inside is see-through and
 * lets clicks through, so what is in it stays selectable; only the outline
 * and the name pick the frame up. Moving a frame moves what is inside it
 * (see canvas.tsx).
 */
export const Frame = ({
  id,
  layer,
  onPointerDown,
  selectionColor,
}: FrameProps) => {
  const { x, y, width, height, fill, value } = layer;
  const { actions } = useBoardStore();
  const readOnly = useCanvasReadOnly();
  const [renaming, setRenaming] = useState(false);
  const color = colorToCss(fill);
  const outline = cleanShapePath({
    kind: "rectangle",
    x,
    y,
    width,
    height,
    roughness: 0,
    edges: "round",
    stroke: color,
    strokeWidth: 2,
    background: null,
    seed: 1,
  });
  const name = value || "Frame";

  const commit = (text: string) => {
    setRenaming(false);
    const next = text.trim().slice(0, MAX_NAME_LENGTH);
    if (next && next !== value) actions.updateLayer(id, { value: next });
  };

  return (
    <g onPointerDown={(e) => onPointerDown(e, id)}>
      <path
        d={outline}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE_WIDTH}
        pointerEvents="stroke"
      />
      {selectionColor && (
        <path
          d={outline}
          fill="none"
          stroke={selectionColor}
          strokeWidth={6}
          strokeOpacity={0.35}
          pointerEvents="none"
        />
      )}
      <path
        d={outline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        pointerEvents="none"
      />
      {renaming && !readOnly ? (
        <foreignObject x={x} y={y - LABEL_HEIGHT - 2} width={Math.max(width, 160)} height={LABEL_HEIGHT}>
          <input
            autoFocus
            defaultValue={name}
            maxLength={MAX_NAME_LENGTH}
            aria-label="Frame name"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.currentTarget.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
              e.stopPropagation();
            }}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: LABEL_FONT,
              color,
              padding: 0,
            }}
          />
        </foreignObject>
      ) : (
        <text
          x={x}
          y={y - 8}
          fontSize={LABEL_FONT}
          fill={color}
          style={{ userSelect: "none", cursor: readOnly ? undefined : "text" }}
          onDoubleClick={() => !readOnly && setRenaming(true)}
        >
          {name}
        </text>
      )}
    </g>
  );
};
