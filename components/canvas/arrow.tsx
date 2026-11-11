import { ArrowLayer } from "@/types/canvas";
import { colorToCss } from "@/lib/utils";
import { arrowPathData } from "@/lib/canvas-geometry";

import { HIT_STROKE_WIDTH, OUTLINE_WIDTH } from "./shape-style";

interface ArrowProps {
  id: string;
  layer: ArrowLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

export const Arrow = ({
  id,
  layer,
  onPointerDown,
  selectionColor,
}: ArrowProps) => {
  const d = arrowPathData(layer);

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
      <path
        d={d}
        fill="none"
        stroke={colorToCss(layer.fill)}
        strokeWidth={OUTLINE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
    </g>
  );
};
