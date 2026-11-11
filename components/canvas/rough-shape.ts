import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

import type { Edges, Roughness } from "@/types/canvas";

const generator = rough.generator();

/** One SVG path of a drawn shape. */
export type ShapePath = {
  d: string;
  /** "none" for the inside. */
  stroke: string;
  strokeWidth: number;
  /** "none" for the outline. */
  fill: string;
};

export type ShapeSpec = {
  kind: "rectangle" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  roughness: Roughness;
  /** Rectangles only. */
  edges?: Edges;
  /** CSS color, or null for no outline. */
  stroke: string | null;
  strokeWidth: number;
  /** CSS color, or null for a see-through inside. */
  background: string | null;
  /** Keeps the wobble the same on every render and every client. */
  seed: number;
};

/** A stable seed from a layer id, so a shape keeps its wobble. */
export const seedFromId = (id: string) => {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // rough.js wants a positive 31-bit integer.
  return (hash >>> 1) || 1;
};

/** Corner radius of a round rectangle: a quarter of the short side, at most 32. */
export const cornerRadius = (width: number, height: number) =>
  Math.min(32, Math.min(Math.abs(width), Math.abs(height)) * 0.25);

const roundRectPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = radius;
  const right = x + width;
  const bottom = y + height;

  return (
    `M ${x + r} ${y} L ${right - r} ${y} Q ${right} ${y} ${right} ${y + r} ` +
    `L ${right} ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} ` +
    `L ${x + r} ${bottom} Q ${x} ${bottom} ${x} ${bottom - r} ` +
    `L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`
  );
};

/** The outline of the shape as clean SVG path data (no wobble). */
export const cleanShapePath = (spec: ShapeSpec) => {
  const { x, y, width, height } = spec;

  if (spec.kind === "ellipse") {
    const rx = width / 2;
    const ry = height / 2;
    const cy = y + ry;
    return (
      `M ${x} ${cy} A ${rx} ${ry} 0 1 0 ${x + width} ${cy} ` +
      `A ${rx} ${ry} 0 1 0 ${x} ${cy} Z`
    );
  }

  const radius = spec.edges === "round" ? cornerRadius(width, height) : 0;
  return radius > 0
    ? roundRectPath(x, y, width, height, radius)
    : `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
};

/**
 * The SVG paths that draw a rectangle or ellipse: the inside first, then
 * the outline. Sloppiness 0 is clean lines; 1 and 2 are hand-drawn with
 * rough.js, more wobbly at 2.
 */
export const shapePaths = (spec: ShapeSpec): ShapePath[] => {
  const width = Math.max(spec.width, 1);
  const height = Math.max(spec.height, 1);

  if (spec.roughness === 0) {
    const d = cleanShapePath({ ...spec, width, height });
    return [
      {
        d,
        stroke: spec.stroke ?? "none",
        strokeWidth: spec.stroke ? spec.strokeWidth : 0,
        fill: spec.background ?? "none",
      },
    ];
  }

  const options: Options = {
    seed: spec.seed,
    roughness: spec.roughness === 1 ? 1 : 2.4,
    bowing: spec.roughness === 1 ? 1 : 2,
    stroke: spec.stroke ?? "none",
    strokeWidth: spec.strokeWidth,
    fill: spec.background ?? undefined,
    fillStyle: "solid",
    // Corners meet where they should.
    preserveVertices: true,
  };

  const { x, y } = spec;
  const drawable =
    spec.kind === "ellipse"
      ? generator.ellipse(x + width / 2, y + height / 2, width, height, {
          ...options,
          curveFitting: 1,
        })
      : spec.edges === "round"
        ? generator.path(
            roundRectPath(x, y, width, height, cornerRadius(width, height)),
            options
          )
        : generator.rectangle(x, y, width, height, options);

  return generator.toPaths(drawable).map((path) => ({
    d: path.d,
    stroke: path.stroke,
    strokeWidth: path.strokeWidth,
    fill: path.fill ?? "none",
  }));
};
