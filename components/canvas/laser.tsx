"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Point } from "@/types/canvas";
import type { BoardActions, LaserTrail } from "@/lib/board-store/types";

/** How long a point of the trail stays, in ms. */
const LIFETIME_MS = 900;
/** Most points kept (and shared) at once. */
const MAX_POINTS = 80;

export const LASER_COLOR = "#ef4444";

type TimedPoint = { x: number; y: number; t: number };

/**
 * The laser pointer: points added while dragging fade out after a moment.
 * The trail is also shared with others on a live board.
 */
export const useLaser = (actions: BoardActions) => {
  const points = useRef<TimedPoint[]>([]);
  const [trail, setTrail] = useState<LaserTrail>([]);
  // Whether the fading loop runs (while the trail has points).
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;

    let frame = requestAnimationFrame(function fade() {
      const now = performance.now();
      points.current = points.current.filter((p) => now - p.t < LIFETIME_MS);
      const next = points.current.map((p) => [p.x, p.y] as [number, number]);

      setTrail(next);
      actions.setLaser(next.length > 0 ? next : null);

      if (next.length > 0) frame = requestAnimationFrame(fade);
      else setRunning(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [actions, running]);

  const add = useCallback((point: Point) => {
    points.current = [
      ...points.current,
      { ...point, t: performance.now() },
    ].slice(-MAX_POINTS);
    setRunning(true);
  }, []);

  return { trail, add };
};

/** Draws a laser trail: thin and faint at the tail, bright at the head. */
export const LaserPath = ({
  trail,
  color = LASER_COLOR,
}: {
  trail: LaserTrail;
  color?: string;
}) => {
  if (trail.length === 0) return null;

  const count = trail.length;
  const head = trail[count - 1];

  return (
    <g pointerEvents="none">
      {trail.slice(1).map(([x, y], index) => {
        const [px, py] = trail[index];
        const age = (index + 1) / count;

        return (
          <line
            key={index}
            x1={px}
            y1={py}
            x2={x}
            y2={y}
            stroke={color}
            strokeOpacity={0.15 + 0.85 * age}
            strokeWidth={1 + 4 * age}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <circle
        cx={head[0]}
        cy={head[1]}
        r={4}
        fill={color}
        stroke="white"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
};
