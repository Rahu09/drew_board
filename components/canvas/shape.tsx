import { useMemo } from "react";

import type { EllipseLayer, RectangleLayer } from "@/types/canvas";

import { cleanShapePath, shapePaths } from "./rough-shape";
import { HIT_STROKE_WIDTH, shapeSpec } from "./shape-style";

interface ShapeProps {
  id: string;
  layer: RectangleLayer | EllipseLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

/**
 * A rectangle or ellipse. One with a see-through inside is picked up by
 * its edge only, so what is under it stays clickable.
 */
export const Shape = ({
  id,
  layer,
  onPointerDown,
  selectionColor,
}: ShapeProps) => {
  const spec = shapeSpec(id, layer);
  const { kind, x, y, width, height, roughness, edges, stroke, background } =
    spec;

  const paths = useMemo(
    () => shapePaths(spec),
    // The spec is rebuilt every render; these are what it is made of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, x, y, width, height, roughness, edges, stroke, background, spec.seed]
  );
  const outline = cleanShapePath(spec);
  // Older filled shapes keep their shadow.
  const isLegacySolid = stroke === null;

  return (
    <g
      onPointerDown={(e) => onPointerDown(e, id)}
      className={isLegacySolid ? "drop-shadow-md" : undefined}
    >
      <path
        d={outline}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE_WIDTH}
        pointerEvents={background ? "all" : "stroke"}
      />
      {selectionColor &&
        (kind === "ellipse" ? (
          <ellipse
            cx={x + width / 2}
            cy={y + height / 2}
            rx={width / 2 + 4}
            ry={height / 2 + 4}
            fill="none"
            stroke={selectionColor}
            strokeWidth={1}
            pointerEvents="none"
          />
        ) : (
          <rect
            x={x - 4}
            y={y - 4}
            width={width + 8}
            height={height + 8}
            fill="none"
            stroke={selectionColor}
            strokeWidth={1}
            pointerEvents="none"
          />
        ))}
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill={path.fill}
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
