export type Color = {
  r: number;
  g: number;
  b: number;
};

/**
 * What part of the board a user is looking at: the canvas point in the
 * middle of their screen, and their zoom. Shared so others can follow them.
 */
export type View = {
  x: number;
  y: number;
  scale: number;
};

/** Screen position of the canvas origin, and the zoom (1 = 100%). */
export type Camera = {
  x: number;
  y: number;
  scale: number;
};

// Stored in boards: only append new types, never reorder.
export enum LayerType {
  Rectangle,
  Ellipse,
  Path,
  Text,
  Note,
  Arrow,
  Image,
}

/**
 * How a shape uses its color: "none" draws an outline in that color with a
 * see-through inside, "solid" fills it. Layers saved before this existed
 * have no fillStyle and are solid.
 */
export type FillStyle = "solid" | "none";

// Style options from the properties panel. All optional: layers saved
// before they existed have none and keep the look they had.

/** Sloppiness: 0 architect (clean lines), 1 artist, 2 cartoonist. */
export type Roughness = 0 | 1 | 2;
export type Edges = "sharp" | "round";
export type FontFamily = "hand" | "sans" | "mono";
export type TextAlign = "left" | "center" | "right";

/** Shared by every layer. */
type Common = {
  /** 0–100; none means 100. */
  opacity?: number;
};

/** Text of text layers and notes. */
type TextStyle = {
  /** Default "hand". */
  fontFamily?: FontFamily;
  /** Default "center". */
  textAlign?: TextAlign;
};

/** Layer types the toolbar draws by dragging on the canvas. */
export type InsertableLayerType =
  | LayerType.Rectangle
  | LayerType.Ellipse
  | LayerType.Text
  | LayerType.Note
  | LayerType.Arrow;

/**
 * Rectangles and ellipses: with fillStyle "none", `fill` is the stroke and
 * `backgroundColor` the inside (null or none: see-through). With "solid"
 * (or none, on older layers) the whole shape is `fill`.
 */
export type RectangleLayer = Common & {
  type: LayerType.Rectangle;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: Color;
  fillStyle?: FillStyle;
  backgroundColor?: Color | null;
  roughness?: Roughness;
  edges?: Edges;
  value?: string;
};

export type EllipseLayer = Common & {
  type: LayerType.Ellipse;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: Color;
  fillStyle?: FillStyle;
  backgroundColor?: Color | null;
  roughness?: Roughness;
  value?: string;
};

export type PathLayer = Common & {
  type: LayerType.Path;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: Color;
  points: number[][];
  value?: string;
};

export type TextLayer = Common &
  TextStyle & {
  type: LayerType.Text;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: Color;
  /**
   * Fixed: resizing the box doesn't change it, and the box grows to fit the
   * text. Older layers have none; their size follows the box until they
   * are first resized (see textLayerFontSize).
   */
  fontSize?: number;
  value?: string;
};

/** `fill` is the paper; fillStyle "none" makes it see-through. */
export type NoteLayer = Common &
  TextStyle & {
  type: LayerType.Note;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: Color;
  fillStyle?: FillStyle;
  /** Default: black or white, whichever reads better on the paper. */
  textColor?: Color;
  roughness?: Roughness;
  /** Default "sharp". */
  edges?: Edges;
  /** Fixed, like a text layer's (see TextLayer.fontSize). */
  fontSize?: number;
  /** When the note was made (ms since epoch), shown in its corner. */
  createdAt?: number;
  value?: string;
};

/**
 * A straight arrow. `points` holds the start and the end ([x, y], relative
 * to x/y); x, y, width and height are their bounding box. `fill` is the
 * line color.
 */
export type ArrowLayer = Common & {
  type: LayerType.Arrow;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: Color;
  points: number[][];
  value?: string;
};

/** An uploaded image, stretched to the box. `src` is its https URL. */
export type ImageLayer = Common & {
  type: LayerType.Image;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: Color;
  src: string;
  value?: string;
};

export type Point = {
  x: number;
  y: number;
};

export type XYWH = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export enum Side {
  Top = 1,
  Bottom = 2,
  Left = 4,
  Right = 8,
}

export type CanvasState =
  | {
      mode: CanvasMode.None;
    }
  | {
      mode: CanvasMode.SelectionNet;
      origin: Point;
      current?: Point;
    }
  | {
      mode: CanvasMode.Translating;
      current: Point;
    }
  | {
      mode: CanvasMode.Inserting;
      layerType: InsertableLayerType;
    }
  | {
      // Dragging out a new shape: from origin to current.
      mode: CanvasMode.Creating;
      layerType: InsertableLayerType;
      origin: Point;
      current: Point;
      /** Shift held: square, circle, or an arrow at 45° steps. */
      constrain: boolean;
    }
  | {
      // Dragging one end of an arrow.
      mode: CanvasMode.MovingEndpoint;
      id: string;
      end: 0 | 1;
    }
  | {
      // Click to start a comment thread.
      mode: CanvasMode.Comment;
    }
  | {
      // Dragging the view (read-only boards, middle mouse button, hand).
      mode: CanvasMode.Panning;
      last: Point;
      /** Started with the hand tool (it stays the current tool). */
      byHand?: boolean;
    }
  | {
      mode: CanvasMode.Pencil;
    }
  | {
      mode: CanvasMode.Pressing;
      origin: Point;
    }
  | {
      mode: CanvasMode.Resizing;
      initialBounds: XYWH;
      corner: Side;
    }
  | {
      // Hand tool: drag to move the view.
      mode: CanvasMode.Hand;
    }
  | {
      // Eraser: drag over layers to delete them. `erasing` holds the ones
      // touched so far while the pointer is down (null when it is up).
      mode: CanvasMode.Eraser;
      erasing: string[] | null;
    }
  | {
      // Laser pointer: a fading trail to point at things.
      mode: CanvasMode.Laser;
    };

export enum CanvasMode {
  None,
  Pressing,
  SelectionNet,
  Translating,
  Inserting,
  Resizing,
  Pencil,
  Creating,
  MovingEndpoint,
  Comment,
  Panning,
  Hand,
  Eraser,
  Laser,
}

export type Layer =
  | RectangleLayer
  | EllipseLayer
  | PathLayer
  | TextLayer
  | NoteLayer
  | ArrowLayer
  | ImageLayer;
