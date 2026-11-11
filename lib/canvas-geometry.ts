import {
  ArrowLayer,
  Color,
  InsertableLayerType,
  Layer,
  LayerType,
  Point,
} from "@/types/canvas";
import {
  NOTE_FONT_SIZE,
  TEXT_FONT_SIZE,
} from "@/components/canvas/text-metrics";

/** Sticky-note yellow: notes drawn while the color is black get this. */
export const NOTE_COLOR: Color = { r: 255, g: 249, b: 177 };

/** Size of a shape placed with a click instead of a drag. */
const DEFAULT_SIZE: Record<InsertableLayerType, { width: number; height: number }> =
  {
    [LayerType.Rectangle]: { width: 120, height: 80 },
    [LayerType.Ellipse]: { width: 100, height: 100 },
    [LayerType.Note]: { width: 160, height: 160 },
    [LayerType.Text]: { width: 160, height: 60 },
    [LayerType.Arrow]: { width: 120, height: 0 },
  };

/** A drag shorter than this (screen pixels) counts as a click. */
const CLICK_DISTANCE = 4;

/** Whether a drag from `origin` to `current` is short enough to be a click. */
export const isClickDrag = (origin: Point, current: Point, scale: number) =>
  Math.max(Math.abs(current.x - origin.x), Math.abs(current.y - origin.y)) *
    scale <
  CLICK_DISTANCE;

/** An arrow from `start` to `end` (canvas coordinates). */
export const arrowFromPoints = (
  start: Point,
  end: Point,
  fill: Color
): ArrowLayer => {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    type: LayerType.Arrow,
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    fill,
    points: [
      [start.x - x, start.y - y],
      [end.x - x, end.y - y],
    ],
  };
};

/** The start and end of an arrow, in canvas coordinates. */
export const arrowEndpoints = (layer: ArrowLayer): [Point, Point] => {
  const [start = [0, 0], end = [layer.width, layer.height]] = layer.points;

  return [
    { x: layer.x + start[0], y: layer.y + start[1] },
    { x: layer.x + end[0], y: layer.y + end[1] },
  ];
};

/** Snaps `end` so the line from `start` is at a multiple of 45°. */
const snapAngle = (start: Point, end: Point): Point => {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const step = Math.PI / 4;
  const angle =
    Math.round(Math.atan2(end.y - start.y, end.x - start.x) / step) * step;

  return {
    x: start.x + Math.cos(angle) * length,
    y: start.y + Math.sin(angle) * length,
  };
};

/**
 * The layer for a shape dragged from `origin` to `current` (canvas
 * coordinates). A click (no real drag) gives the default size at `origin`.
 * Rectangles and ellipses start as outlines (see FillStyle); notes stay
 * solid, like paper.
 */
export const createShapeLayer = (
  type: InsertableLayerType,
  origin: Point,
  current: Point,
  color: Color,
  options: { constrain: boolean; scale: number }
): Layer => {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const isClick = isClickDrag(origin, current, options.scale);

  if (type === LayerType.Arrow) {
    const end = isClick
      ? { x: origin.x + DEFAULT_SIZE[type].width, y: origin.y }
      : options.constrain
        ? snapAngle(origin, current)
        : current;

    return arrowFromPoints(origin, end, color);
  }

  let width = Math.abs(dx);
  let height = Math.abs(dy);

  if (isClick) {
    ({ width, height } = DEFAULT_SIZE[type]);
  } else if (options.constrain) {
    width = height = Math.max(width, height);
  }

  // Dragging up or left grows the shape that way.
  const x = !isClick && dx < 0 ? origin.x - width : origin.x;
  const y = !isClick && dy < 0 ? origin.y - height : origin.y;
  const box = { x, y, width: Math.max(width, 8), height: Math.max(height, 8) };

  switch (type) {
    case LayerType.Note:
      return {
        type,
        ...box,
        // Always yellow paper: the pen color is for lines and text. The
        // properties panel changes the paper.
        fill: NOTE_COLOR,
        fillStyle: "solid",
        fontSize: NOTE_FONT_SIZE,
        createdAt: Date.now(),
      };
    case LayerType.Text:
      // At least one line tall; the box grows as text is typed.
      return {
        type,
        ...box,
        height: Math.max(box.height, Math.ceil(TEXT_FONT_SIZE * 1.5)),
        fill: color,
        fontSize: TEXT_FONT_SIZE,
      };
    // Outlined and hand-drawn by default, like paper sketches.
    case LayerType.Rectangle:
      return {
        type,
        ...box,
        fill: color,
        fillStyle: "none",
        backgroundColor: null,
        roughness: 1,
        edges: "round",
      };
    case LayerType.Ellipse:
      return {
        type,
        ...box,
        fill: color,
        fillStyle: "none",
        backgroundColor: null,
        roughness: 1,
      };
  }
};

/** SVG path data for an arrow: the line and a two-stroke head. */
export const arrowPathData = (layer: ArrowLayer) => {
  const [start, end] = arrowEndpoints(layer);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = Math.min(16, length / 2);
  const spread = Math.PI / 7;

  const wing = (side: number) => ({
    x: end.x - head * Math.cos(angle + side * spread),
    y: end.y - head * Math.sin(angle + side * spread),
  });
  const left = wing(1);
  const right = wing(-1);

  return (
    `M ${start.x} ${start.y} L ${end.x} ${end.y} ` +
    `M ${left.x} ${left.y} L ${end.x} ${end.y} L ${right.x} ${right.y}`
  );
};
