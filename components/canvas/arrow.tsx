import { useMemo } from "react";

import { LinearLayer } from "@/types/canvas";
import { colorToCss } from "@/lib/utils";
import { arrowPathData } from "@/lib/canvas-geometry";

import { linearPaths, seedFromId } from "./rough-shape";
import { HIT_STROKE_WIDTH, OUTLINE_WIDTH } from "./shape-style";

interface ArrowProps {
  id: string;
  layer: LinearLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

/** An arrow or a line (an arrow without the head). */
export const Arrow = ({
  id,
  layer,
  onPointerDown,
  selectionColor,
}: ArrowProps) => {
  const d = arrowPathData(layer);
  const color = colorToCss(layer.fill);
  const roughness = layer.roughness ?? 0;
  const paths = useMemo(
    () => linearPaths(d, roughness, color, OUTLINE_WIDTH, seedFromId(id)),
    [d, roughness, color, id]
  );

  return (
    <g onPointerDown={(e) => onPointerDown(e, id)}>
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE_WIDTH}
        strokeLinecap="round"
        pointerEvents="stroke"
      />
      {selectionColor && (
        <path
          d={d}
          fill="none"
          stroke={selectionColor}
          strokeOpacity={0.4}
          strokeWidth={8}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill="none"
          stroke={path.stroke}
          strokeWidth={path.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      ))}
    </g>
  );
};
