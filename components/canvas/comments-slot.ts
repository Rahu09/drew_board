import type { Camera, Point } from "@/types/canvas";

/** What the canvas hands to a board's comments layer (live boards). */
export interface CommentsSlotProps {
  camera: Camera;
  /** Where a new thread is being started (canvas coordinates), if any. */
  draft: Point | null;
  /** The new thread was posted or cancelled. */
  onDraftDone: () => void;
}

/** What the canvas hands to the sidebar's comments tab (live boards). */
export interface CommentsListSlotProps {
  /** Moves the view so this canvas point is in the middle. */
  focus: (point: Point) => void;
}
