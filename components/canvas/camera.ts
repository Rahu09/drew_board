import type { Camera, Point, XYWH } from "@/types/canvas";

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;
/** One step of the zoom buttons and Ctrl+=/Ctrl+-. */
export const ZOOM_STEP = 1.2;

export const INITIAL_CAMERA: Camera = { x: 0, y: 0, scale: 1 };

/**
 * Screen areas covered by the fixed panels (top bar, zoom bar; the toolbar
 * is at the bottom on narrow screens), so "fit" stays clear of them.
 */
export const SAFE_AREA = { top: 60, left: 8, right: 8, bottom: 60 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const clampScale = (scale: number) =>
  clamp(scale, MIN_SCALE, MAX_SCALE);

/** A point on the screen (client coordinates) in canvas coordinates. */
export const screenToCanvas = (point: Point, camera: Camera): Point => ({
  x: (point.x - camera.x) / camera.scale,
  y: (point.y - camera.y) / camera.scale,
});

/** Zooms to `scale`, keeping the canvas point under `anchor` in place. */
export const zoomAt = (camera: Camera, anchor: Point, scale: number): Camera => {
  const next = clampScale(scale);
  const ratio = next / camera.scale;

  return {
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
    scale: next,
  };
};

export const viewportCenter = (): Point => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
});

/** Shows `bounds` as large as possible (up to 100%) in the free area. */
export const fitCamera = (bounds: XYWH | null): Camera => {
  if (!bounds) return INITIAL_CAMERA;

  const padding = 32;
  const left = SAFE_AREA.left + padding;
  const top = SAFE_AREA.top + padding;
  const width = Math.max(
    window.innerWidth - left - SAFE_AREA.right - padding,
    1
  );
  const height = Math.max(
    window.innerHeight - top - SAFE_AREA.bottom - padding,
    1
  );

  const scale = clamp(
    Math.min(
      width / Math.max(bounds.width, 1),
      height / Math.max(bounds.height, 1)
    ),
    MIN_SCALE,
    1
  );

  return {
    x: left + (width - bounds.width * scale) / 2 - bounds.x * scale,
    y: top + (height - bounds.height * scale) / 2 - bounds.y * scale,
    scale,
  };
};
