"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Circle,
  Copy,
  Eraser,
  Expand,
  FolderOpen,
  Hand,
  HelpCircle,
  ImageDown,
  ImagePlus,
  Library,
  MessageCircle,
  Monitor,
  Moon,
  MousePointer2,
  MoveUpRight,
  PanelRight,
  Pencil,
  Redo2,
  Save,
  Search,
  Square,
  SquareDashedMousePointer,
  StickyNote,
  Sun,
  Trash2,
  Type,
  Undo2,
  Users,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import {
  Camera,
  CanvasMode,
  CanvasState,
  Color,
  Layer,
  LayerType,
  Point,
  Side,
  XYWH,
} from "@/types/canvas";
import {
  colorToCss,
  findIntersectingLayersWithRectangle,
  penPointsToPathLayer,
  pointerEventToCanvasPoint,
  resizeBounds,
} from "@/lib/utils";
import {
  arrowEndpoints,
  arrowFromPoints,
  createShapeLayer,
  isClickDrag,
} from "@/lib/canvas-geometry";
import { boundingBox } from "@/lib/board-store/bounds";
import { useBoardStore } from "@/lib/board-store/context";
import { MAX_LAYERS, type BoardSnapshot } from "@/lib/board-store/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDisableScrollBounce } from "@/hooks/use-disable-scroll-bounce";

import { Hint } from "@/components/hints";
import { withShortcut } from "@/lib/shortcuts";

import { IMAGE_ACCEPT, Toolbar, type ToolbarHome } from "./toolbar";
import { SIDEBAR_WIDTH, Sidebar, type SidebarTab } from "./sidebar";
import { LayerPreview, LayerView } from "./layer-preview";
import { SelectionBox } from "./selection-box";
import { PropertiesPanel } from "./properties-panel";
import { PhoneActions, ZoomControls } from "./zoom-controls";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { Path } from "./path";
import {
  INITIAL_CAMERA,
  ZOOM_STEP,
  clampScale,
  fitCamera,
  screenToCanvas,
  viewportCenter,
  zoomAt,
} from "./camera";
import { CameraScaleContext } from "./camera-context";
import { notifyLayerLimit } from "./layer-limit";
import { noteLayerFontSize, textLayerFontSize } from "./text-metrics";
import {
  duplicateSelection,
  insertLayerCopies,
  isTypingTarget,
  pasteCopiedLayers,
  useCanvasShortcuts,
  type MenuShortcut,
} from "./use-canvas-shortcuts";
import { MainMenu } from "./main-menu";
import { ExportDialog } from "./export-dialog";
import { HelpDialog } from "./help-dialog";
import { CommandPalette, type Command } from "./command-palette";
import { BOARD_FILE_ACCEPT, readBoardFile, saveBoardFile } from "./board-file";
import { useFollow } from "./follow";
import { LaserPath, useLaser } from "./laser";
import { useApplyBoardTheme, useBoardTheme } from "./theme";
import { CanvasReadOnlyContext } from "./read-only-context";
import type {
  CommentsListSlotProps,
  CommentsSlotProps,
} from "./comments-slot";

const PINNED_KEY = "board:sidebar-pinned";

const readPinned = () => {
  try {
    return localStorage.getItem(PINNED_KEY) === "1";
  } catch {
    return false;
  }
};

/** Screen width the sidebar leaves free (none on phones, where it's full width). */
const freeWidth = (sidebarOpen: boolean) =>
  sidebarOpen && window.innerWidth >= 640
    ? window.innerWidth - SIDEBAR_WIDTH
    : window.innerWidth;

// Outside the component on purpose: the React Compiler lint reads
// `state.current` as a ref access and refuses to keep the memoization.
const lastPointOf = (state: { current: Point }) => state.current;

const offsetBetween = (from: Point, to: Point): Point => ({
  x: to.x - from.x,
  y: to.y - from.y,
});

const distanceBetween = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const midpointOf = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Wheel deltas in pixels, whatever unit the browser reports. */
const wheelDelta = (e: WheelEvent) => {
  const unit =
    e.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? window.innerHeight
        : 1;

  return { x: e.deltaX * unit, y: e.deltaY * unit };
};

/** Zoom factor of one wheel event; a mouse notch is about 25%. */
const wheelZoomFactor = (deltaY: number) =>
  Math.exp(-Math.max(-50, Math.min(50, deltaY)) * 0.006);

/** Modes where the selection toolbar would get in the way. */
const isBusy = (mode: CanvasMode) =>
  mode === CanvasMode.Translating ||
  mode === CanvasMode.Resizing ||
  mode === CanvasMode.SelectionNet ||
  mode === CanvasMode.Creating ||
  mode === CanvasMode.MovingEndpoint ||
  mode === CanvasMode.Panning;

const IMAGE_TYPES = IMAGE_ACCEPT.split(",");
/** Same limit as the server (convex/images.ts). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Longest side of a newly added image, in canvas units. */
const MAX_IMAGE_SIDE = 480;

/** The image's size, scaled down to fit MAX_IMAGE_SIDE. */
const imageSize = async (file: File) => {
  let width = 320;
  let height = 240;

  try {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch {
    // Keep the fallback size; the browser still shows the image.
  }

  const fit = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height, 1));
  return {
    width: Math.max(Math.round(width * fit), 8),
    height: Math.max(Math.round(height * fit), 8),
  };
};

/**
 * Puts the caret in a new text or note layer with its text selected, so
 * typing replaces the placeholder. Waits for the layer to render.
 */
const focusLayerText = (id: string, tries = 10) => {
  requestAnimationFrame(() => {
    const editable = document.querySelector<HTMLElement>(
      `[data-layer-id="${CSS.escape(id)}"] [contenteditable]`
    );

    if (!editable) {
      if (tries > 0) focusLayerText(id, tries - 1);
      return;
    }

    editable.focus();
    const range = document.createRange();
    range.selectNodeContents(editable);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
};

const svgCursor = (svg: string, x: number, y: number, fallback: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;

const ERASER_CURSOR = svgCursor(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="7" fill="white" stroke="black" stroke-width="1.5"/></svg>',
  10,
  10,
  "crosshair"
);

const LASER_CURSOR = svgCursor(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="4" fill="#ef4444" stroke="white" stroke-width="1.5"/></svg>',
  8,
  8,
  "crosshair"
);

const cursorFor = (state: CanvasState, readOnly: boolean) => {
  switch (state.mode) {
    case CanvasMode.Inserting:
    case CanvasMode.Creating:
    case CanvasMode.Comment:
      return "crosshair";
    case CanvasMode.Panning:
      return "grabbing";
    case CanvasMode.Hand:
      return "grab";
    case CanvasMode.Eraser:
      return ERASER_CURSOR;
    case CanvasMode.Laser:
      return LASER_CURSOR;
    default:
      return readOnly ? "grab" : undefined;
  }
};

/**
 * Ids of the layers under the line from `from` to `to` (screen points),
 * tested every few pixels so fast strokes don't skip any.
 */
const layersUnder = (from: Point, to: Point) => {
  const steps = Math.max(1, Math.ceil(distanceBetween(from, to) / 4));
  const ids = new Set<string>();

  for (let i = 0; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;

    for (const element of document.elementsFromPoint(x, y)) {
      const id = element.closest("[data-layer]")?.getAttribute("data-layer");
      if (id && id !== "draft") ids.add(id);
    }
  }

  return ids;
};

/** The layer within `radius` screen pixels of a point, for fingers. */
const layerNear = (x: number, y: number, radius: number) => {
  const offsets = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
    [radius * 0.7, radius * 0.7],
    [-radius * 0.7, radius * 0.7],
    [radius * 0.7, -radius * 0.7],
    [-radius * 0.7, -radius * 0.7],
  ];

  for (const [dx, dy] of offsets) {
    const id = document
      .elementFromPoint(x + dx, y + dy)
      ?.closest("[data-layer]")
      ?.getAttribute("data-layer");
    if (id && id !== "draft") return id;
  }

  return null;
};

/** How far (screen pixels) a finger may wander and still be a tap. */
const TAP_SLOP = 8;

/**
 * Phones only open the keyboard for a field focused during the tap
 * itself, but a new text layer renders a moment later. Focusing a hidden
 * field now opens the keyboard; focusLayerText then moves the caret over.
 */
const openKeyboard = () => {
  let field = document.getElementById("canvas-keyboard-primer");
  if (!field) {
    field = document.createElement("input");
    field.id = "canvas-keyboard-primer";
    field.setAttribute("aria-hidden", "true");
    field.tabIndex = -1;
    // 16px: iOS zooms the page into smaller fields.
    field.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none";
    document.body.appendChild(field);
  }
  field.focus({ preventScroll: true });
};

/** Puts the caret where a finger tapped a text or note layer. */
const editLayerTextAt = (id: string, x: number, y: number) => {
  const editable = document.querySelector<HTMLElement>(
    `[data-layer-id="${CSS.escape(id)}"] [contenteditable]`
  );
  if (!editable || !editable.isContentEditable) return;

  editable.focus({ preventScroll: true });

  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };
  let caret: Range | null = null;
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) {
    caret = document.createRange();
    caret.setStart(position.offsetNode, position.offset);
  } else {
    caret = document.caretRangeFromPoint?.(x, y) ?? null;
  }

  const selection = window.getSelection();
  if (caret && editable.contains(caret.startContainer)) {
    caret.collapse(true);
  } else {
    // Tapped the empty part of the box: caret at the end.
    caret = document.createRange();
    caret.selectNodeContents(editable);
    caret.collapse(false);
  }
  selection?.removeAllRanges();
  selection?.addRange(caret);
};

type ConfirmRequest = {
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
};

type CreatingState = Extract<CanvasState, { mode: CanvasMode.Creating }>;

interface Pinch {
  distance: number;
  midpoint: Point;
  camera: Camera;
}

interface CanvasProps {
  /** Where the logo at the start of the toolbar leads. */
  home: ToolbarHome;
  /** Top left, after the menu button: the board's name. */
  title?: React.ReactNode;
  /** Board items for the menu (rename, links, delete…). */
  menuItems?: React.ReactNode;
  /** "Live collaboration…" in the menu (live boards). */
  onShare?: () => void;
  /**
   * Top right, before the sidebar button: who is here and Share (live
   * boards), or save (guest boards).
   */
  topRight?: React.ReactNode;
  /** Drawn on the canvas above the layers: other users' cursors and drafts. */
  overlay?: React.ReactNode;
  /** View only (share links): pan, zoom and export, nothing else. */
  readOnly?: boolean;
  /**
   * Stores an image and returns its https URL. Without it (guest boards),
   * adding an image asks the user to sign in.
   */
  uploadImage?: (file: File) => Promise<string>;
  /** Comment pins and threads (live boards); enables the Comment tool. */
  comments?: (props: CommentsSlotProps) => React.ReactNode;
  /** All comments, for the sidebar's comments tab (live boards). */
  commentsList?: (props: CommentsListSlotProps) => React.ReactNode;
  /** File name of exports, without the extension. */
  exportName?: string;
}

/**
 * The drawing surface. Storage-agnostic: it reads and writes the board only
 * through the board store from context (Liveblocks or the browser).
 */
export const Canvas = ({
  home,
  title,
  menuItems,
  onShare,
  topRight,
  overlay,
  readOnly = false,
  uploadImage,
  comments,
  commentsList,
  exportName = "board",
}: CanvasProps) => {
  const store = useBoardStore();
  const { actions } = store;

  const layerIds = store.useLayerIds();
  const layerCount = store.useLayerCount();
  const pencilDraft = store.usePencilDraft();
  const remoteSelections = store.useRemoteSelections();
  const canUndo = store.useCanUndo();
  const canRedo = store.useCanRedo();
  const selection = store.useSelection();
  const isPhone = useMediaQuery(PHONE_QUERY);
  // Phones: the style sheet is opened from a button, not on every select.
  const [stylesOpen, setStylesOpen] = useState(false);
  const background = store.useBackground();

  const [canvasState, setCanvasState] = useState<CanvasState>({
    mode: CanvasMode.None,
  });
  // The user's own view; while following someone, theirs is shown instead.
  const [ownCamera, setCameraState] = useState<Camera>(INITIAL_CAMERA);
  const [lastUsedColor, setLastUsedColor] = useState<Color>({
    r: 0,
    g: 0,
    b: 0,
  });
  // Where a new comment thread is being started (Comment tool).
  const [commentDraft, setCommentDraft] = useState<Point | null>(null);
  // The sidebar's open tab, or null when it is closed.
  const [sidebarTab, setSidebarTab] = useState<SidebarTab | null>(null);
  const [sidebarPinned, setSidebarPinned] = useState(readPinned);
  // The layer of the current search result, marked on the board.
  const [foundId, setFoundId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"export" | "help" | "palette" | null>(
    null
  );
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const sidebarOpen = sidebarTab !== null;
  const followTarget = useFollow((state) => state.target);
  const followedView = store.useOtherView(followTarget?.connectionId ?? null);
  const { theme, isDark, setTheme } = useBoardTheme();
  const laser = useLaser(actions);
  const camera = useMemo<Camera>(
    () =>
      followTarget && followedView
        ? {
            scale: followedView.scale,
            x: freeWidth(sidebarOpen) / 2 - followedView.x * followedView.scale,
            y: window.innerHeight / 2 - followedView.y * followedView.scale,
          }
        : ownCamera,
    [followTarget, followedView, ownCamera, sidebarOpen]
  );

  const svgRef = useRef<SVGSVGElement>(null);
  // Touch points on the canvas, for two-finger pinch and pan.
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);
  // After a pinch, ignore the fingers until all of them are lifted.
  const ignoreTouches = useRef(false);
  // A finger that went down to move layers: where, so a small wobble
  // doesn't move them and a tap on text can put the caret there.
  const fingerDown = useRef<{
    id: string | null;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  // The tool to go back to after panning with the middle mouse button.
  const stateBeforePan = useRef<CanvasState>({ mode: CanvasMode.None });
  // For work that finishes later (image uploads).
  const cameraRef = useRef(camera);
  // The eraser stroke while the pointer is down: its last position
  // (screen) and the layers touched. Kept outside state so quick events
  // never see an old copy; the state only draws them faded.
  const eraser = useRef<{ last: Point; ids: string[] } | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useDisableScrollBounce();
  useApplyBoardTheme(isDark);

  /**
   * The user moves the view: that stops following someone, carrying on
   * from what they were shown.
   */
  const setCamera = useCallback((update: React.SetStateAction<Camera>) => {
    const follow = useFollow.getState();
    // Stopping first puts the followed view in the state (see below), so
    // an update function starts from it.
    if (follow.target) follow.stop();
    setCameraState(update);
  }, []);

  // Following stopped some other way (the menu, the frame's ×): stay where
  // the followed user was.
  useEffect(
    () =>
      useFollow.subscribe((state, previous) => {
        if (previous.target && !state.target) {
          setCameraState(cameraRef.current);
        }
      }),
    []
  );

  // Tell others what this user is looking at, so they can follow.
  useEffect(() => {
    if (readOnly) return;

    const center = screenToCanvas(
      { x: freeWidth(sidebarOpen) / 2, y: window.innerHeight / 2 },
      camera
    );
    actions.setView({ x: center.x, y: center.y, scale: camera.scale });
  }, [actions, camera, readOnly, sidebarOpen]);

  // The followed user left: stop following.
  useEffect(() => {
    if (followTarget && followedView === undefined) {
      useFollow.getState().stop();
      toast.info(`${followTarget.name} left the board`);
    }
  }, [followTarget, followedView]);

  // Leaving the board stops following.
  useEffect(() => () => useFollow.getState().stop(), []);

  const zoomIn = useCallback(
    () => setCamera((c) => zoomAt(c, viewportCenter(), c.scale * ZOOM_STEP)),
    [setCamera]
  );
  const zoomOut = useCallback(
    () => setCamera((c) => zoomAt(c, viewportCenter(), c.scale / ZOOM_STEP)),
    [setCamera]
  );
  const resetZoom = useCallback(
    () => setCamera((c) => zoomAt(c, viewportCenter(), 1)),
    [setCamera]
  );
  const fitToScreen = useCallback(() => {
    const { layers, layerIds } = actions.getSnapshot();
    const boxes = layerIds.map((id) => layers[id]).filter(Boolean);

    setCamera(fitCamera(boundingBox(boxes)));
  }, [actions, setCamera]);

  /** Moves the view (same zoom) so `point` is in the middle of the free area. */
  const focusPoint = useCallback(
    (point: Point) => {
      const width = freeWidth(sidebarOpen);
      setCamera((c) => ({
        ...c,
        x: width / 2 - point.x * c.scale,
        y: window.innerHeight / 2 - point.y * c.scale,
      }));
    },
    [setCamera, sidebarOpen]
  );

  /** Marks a search result and brings it into view. */
  const showLayer = useCallback(
    (id: string | null) => {
      setFoundId(id);
      const layer = id ? actions.getSnapshot().layers[id] : undefined;
      if (layer) {
        focusPoint({
          x: layer.x + layer.width / 2,
          y: layer.y + layer.height / 2,
        });
      }
    },
    [actions, focusPoint]
  );

  /** Adds a library item in the middle of the view, selected. */
  const insertLibraryItem = useCallback(
    (layers: readonly Layer[]) => {
      const bounds = boundingBox(layers);
      if (!bounds) return;

      const center = screenToCanvas(
        { x: freeWidth(sidebarOpen) / 2, y: window.innerHeight / 2 },
        cameraRef.current
      );
      insertLayerCopies(actions, layers, {
        x: Math.round(center.x - (bounds.x + bounds.width / 2)),
        y: Math.round(center.y - (bounds.y + bounds.height / 2)),
      });
    },
    [actions, sidebarOpen]
  );

  const closeSidebar = useCallback(() => setSidebarTab(null), []);
  const setPinned = useCallback((pinned: boolean) => {
    setSidebarPinned(pinned);
    try {
      localStorage.setItem(PINNED_KEY, pinned ? "1" : "0");
    } catch {
      // Not remembered; fine.
    }
  }, []);
  const openSearch = useCallback(() => setSidebarTab("search"), []);

  const saveFile = useCallback(
    () => saveBoardFile(actions.getSnapshot(), exportName),
    [actions, exportName]
  );

  const openFile = useCallback(() => {
    if (!readOnly) document.getElementById("board-file-input")?.click();
  }, [readOnly]);

  /** Puts a board read from a file on this board, asking first if it has content. */
  const loadBoard = useCallback(
    (snapshot: BoardSnapshot) => {
      const load = () => {
        actions.replaceContent(snapshot);
        requestAnimationFrame(fitToScreen);
      };

      if (actions.getSnapshot().layerIds.length === 0) {
        load();
      } else {
        setConfirm({
          title: "Replace this board?",
          description:
            "Opening the file replaces everything on this board. You can undo it.",
          action: "Replace",
          onConfirm: load,
        });
      }
    },
    [actions, fitToScreen]
  );

  const resetCanvas = useCallback(
    () =>
      setConfirm({
        title: "Reset the canvas?",
        description:
          "This removes everything on the board and its background color. You can undo it.",
        action: "Reset",
        onConfirm: () => actions.replaceContent({ layers: {}, layerIds: [] }),
      }),
    [actions]
  );

  const onMenuShortcut = useCallback(
    (shortcut: MenuShortcut) => {
      if (shortcut === "save") saveFile();
      else if (shortcut === "open") openFile();
      else setDialog(shortcut);
    },
    [openFile, saveFile]
  );

  const cancelTool = useCallback(() => {
    actions.setPencilDraft(null);
    setCommentDraft(null);
    setCanvasState({ mode: CanvasMode.None });
  }, [actions]);

  const changeTool = useCallback(
    (state: CanvasState) => {
      actions.setPencilDraft(null);
      setCommentDraft(null);
      setCanvasState(state);
    },
    [actions]
  );

  const pickImage = useCallback(() => {
    document.getElementById("canvas-image-input")?.click();
  }, []);

  useCanvasShortcuts({
    actions,
    readOnly,
    hasComments: !!comments,
    pickImage,
    setCanvasState,
    cancelTool,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    openSearch,
    onMenuShortcut,
  });

  // Wheel: pan, or zoom with Ctrl/⌘ (also what a trackpad pinch sends).
  // A native listener, because React's wheel listener is passive and can't
  // stop the browser from zooming the whole page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = wheelDelta(e);

      if (e.ctrlKey || e.metaKey) {
        const anchor = { x: e.clientX, y: e.clientY };
        setCamera((c) =>
          zoomAt(c, anchor, c.scale * wheelZoomFactor(delta.y))
        );
      } else {
        setCamera((c) => ({ ...c, x: c.x - delta.x, y: c.y - delta.y }));
      }
    };

    // Safari sends trackpad pinches as gesture events instead.
    let gestureScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const gesture = e as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      const factor = gesture.scale / gestureScale;
      gestureScale = gesture.scale;
      const anchor = { x: gesture.clientX, y: gesture.clientY };
      setCamera((c) => zoomAt(c, anchor, c.scale * factor));
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("gesturestart", onGestureStart);
    svg.addEventListener("gesturechange", onGestureChange);

    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("gesturestart", onGestureStart);
      svg.removeEventListener("gesturechange", onGestureChange);
    };
  }, [setCamera]);

  /** Adds the shape that was dragged out (or clicked) with a shape tool. */
  const finishCreating = useCallback(
    (state: CreatingState) => {
      const layer = createShapeLayer(
        state.layerType,
        state.origin,
        state.current,
        lastUsedColor,
        { constrain: state.constrain, scale: camera.scale }
      );
      const id = actions.insertLayer(layer, { select: true });

      // Like Excalidraw: back to the select tool after each shape.
      setCanvasState({ mode: CanvasMode.None });

      if (id === null) {
        notifyLayerLimit();
      } else if (
        layer.type === LayerType.Text ||
        layer.type === LayerType.Note
      ) {
        focusLayerText(id);
      }
    },
    [actions, camera.scale, lastUsedColor]
  );

  /** Uploads an image and adds it at `at` (default: the middle of the view). */
  const addImage = useCallback(
    async (file: File, at?: Point) => {
      if (readOnly) return;

      if (!uploadImage) {
        toast.info("Sign in and save the board to add images");
        return;
      }
      if (!IMAGE_TYPES.includes(file.type)) {
        toast.error("Use a PNG, JPEG, GIF or WebP image");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error("Images can be up to 5 MB");
        return;
      }
      if (actions.getSnapshot().layerIds.length >= MAX_LAYERS) {
        notifyLayerLimit();
        return;
      }

      const toastId = toast.loading("Adding the image…");

      try {
        const [size, src] = await Promise.all([
          imageSize(file),
          uploadImage(file),
        ]);
        const center =
          at ?? screenToCanvas(viewportCenter(), cameraRef.current);
        const id = actions.insertLayer(
          {
            type: LayerType.Image,
            x: Math.round(center.x - size.width / 2),
            y: Math.round(center.y - size.height / 2),
            ...size,
            fill: { r: 0, g: 0, b: 0 },
            src,
          },
          { select: true }
        );

        toast.dismiss(toastId);
        if (id === null) notifyLayerLimit();
        setCanvasState({ mode: CanvasMode.None });
      } catch {
        toast.error("Couldn't add the image", { id: toastId });
      }
    },
    [actions, readOnly, uploadImage]
  );

  // Paste: an image from the clipboard, or the layers copied with Mod+C.
  useEffect(() => {
    if (readOnly) return;

    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const image = [...(e.clipboardData?.files ?? [])].find((file) =>
        file.type.startsWith("image/")
      );

      if (image) {
        e.preventDefault();
        void addImage(image);
      } else if (pasteCopiedLayers(actions)) {
        e.preventDefault();
      }
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [actions, addImage, readOnly]);

  const onCommentDraftDone = useCallback(() => {
    setCommentDraft(null);
    setCanvasState({ mode: CanvasMode.None });
  }, []);

  const continueDrawing = useCallback(
    (point: Point, e: React.PointerEvent) => {
      const draft = actions.getPencilDraft();

      if (
        canvasState.mode !== CanvasMode.Pencil ||
        e.buttons !== 1 ||
        draft == null
      ) {
        return;
      }

      actions.setPencilDraft(
        draft.length === 1 &&
          draft[0][0] === point.x &&
          draft[0][1] === point.y
          ? draft
          : [...draft, [point.x, point.y, e.pressure]]
      );
    },
    [actions, canvasState.mode]
  );

  const insertPath = useCallback(() => {
    const draft = actions.getPencilDraft();

    if (draft != null && draft.length >= 2) {
      const id = actions.insertLayer(penPointsToPathLayer(draft, lastUsedColor));

      if (id === null) {
        notifyLayerLimit();
      }
    }

    actions.setPencilDraft(null);
    setCanvasState({ mode: CanvasMode.Pencil });
  }, [actions, lastUsedColor]);

  const startDrawing = useCallback(
    (point: Point, pressure: number) => {
      // Say so before the stroke, not after it is drawn and lost.
      if (actions.getSnapshot().layerIds.length >= MAX_LAYERS) {
        notifyLayerLimit();
        return;
      }

      actions.setPencilDraft([[point.x, point.y, pressure]], lastUsedColor);
    },
    [actions, lastUsedColor]
  );

  const unselectLayers = useCallback(() => {
    if (actions.getSelection().length > 0) {
      actions.setSelection([], { addToHistory: true });
    }
  }, [actions]);

  const updateSelectionNet = useCallback(
    (current: Point, origin: Point) => {
      const { layers } = actions.getSnapshot();

      setCanvasState({
        mode: CanvasMode.SelectionNet,
        origin,
        current,
      });

      actions.setSelection(
        findIntersectingLayersWithRectangle(layerIds, layers, origin, current)
      );
    },
    [actions, layerIds]
  );

  const startMultiSelection = useCallback(
    (current: Point, origin: Point) => {
      // 5 screen pixels, whatever the zoom.
      const distance =
        (Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y)) *
        camera.scale;

      if (distance > 5) {
        setCanvasState({
          mode: CanvasMode.SelectionNet,
          origin,
          current,
        });
      }
    },
    [camera.scale]
  );

  const resizeSelectedLayer = useCallback(
    (point: Point) => {
      if (canvasState.mode !== CanvasMode.Resizing) {
        return;
      }

      const [id] = actions.getSelection();
      if (!id) return;

      const bounds = resizeBounds(
        canvasState.initialBounds,
        canvasState.corner,
        point
      );
      const layer = actions.getSnapshot().layers[id];

      // Resizing never changes the font size of text or notes. Older layers
      // had none (it followed the box): keep the size they had.
      if (layer?.type === LayerType.Text && layer.fontSize === undefined) {
        actions.updateLayer(id, {
          ...bounds,
          fontSize: textLayerFontSize(canvasState.initialBounds),
        });
      } else if (
        layer?.type === LayerType.Note &&
        layer.fontSize === undefined
      ) {
        actions.updateLayer(id, {
          ...bounds,
          fontSize: noteLayerFontSize(canvasState.initialBounds),
        });
      } else {
        actions.updateLayer(id, bounds);
      }
    },
    [actions, canvasState]
  );

  const onResizeHandlePointerDown = useCallback(
    (corner: Side, initialBounds: XYWH) => {
      actions.pauseHistory();
      setCanvasState({
        mode: CanvasMode.Resizing,
        initialBounds,
        corner,
      });
    },
    [actions]
  );

  const onArrowHandlePointerDown = useCallback(
    (id: string, end: 0 | 1) => {
      actions.pauseHistory();
      setCanvasState({ mode: CanvasMode.MovingEndpoint, id, end });
    },
    [actions]
  );

  const moveArrowEndpoint = useCallback(
    (point: Point) => {
      if (canvasState.mode !== CanvasMode.MovingEndpoint) return;

      const layer = actions.getSnapshot().layers[canvasState.id];
      if (layer?.type !== LayerType.Arrow) return;

      const ends = arrowEndpoints(layer);
      ends[canvasState.end] = point;
      const { x, y, width, height, points } = arrowFromPoints(
        ends[0],
        ends[1],
        layer.fill
      );
      actions.updateLayer(canvasState.id, { x, y, width, height, points });
    },
    [actions, canvasState]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const point = pointerEventToCanvasPoint(e, camera);

      // Middle button anywhere, the hand tool, or any drag on a read-only
      // board: pan.
      const byHand = canvasState.mode === CanvasMode.Hand && e.button === 0;
      if (e.button === 1 || (readOnly && e.button === 0) || byHand) {
        e.preventDefault();
        stateBeforePan.current = readOnly
          ? { mode: CanvasMode.None }
          : canvasState;
        setCanvasState({
          mode: CanvasMode.Panning,
          last: { x: e.clientX, y: e.clientY },
          byHand,
        });
        return;
      }

      if (e.button !== 0 || readOnly) return;

      if (canvasState.mode === CanvasMode.Laser) {
        laser.add(point);
        return;
      }

      if (canvasState.mode === CanvasMode.Eraser) {
        const at = { x: e.clientX, y: e.clientY };
        const ids = [...layersUnder(at, at)];
        eraser.current = { last: at, ids };
        setCanvasState({ mode: CanvasMode.Eraser, erasing: ids });
        return;
      }

      if (canvasState.mode === CanvasMode.Inserting) {
        // Say so before the drag, not after the shape is drawn and lost.
        if (actions.getSnapshot().layerIds.length >= MAX_LAYERS) {
          notifyLayerLimit();
          return;
        }

        setCanvasState({
          mode: CanvasMode.Creating,
          layerType: canvasState.layerType,
          origin: point,
          current: point,
          constrain: e.shiftKey,
        });
        return;
      }

      if (canvasState.mode === CanvasMode.Comment) {
        setCommentDraft(point);
        return;
      }

      if (canvasState.mode === CanvasMode.Pencil) {
        startDrawing(point, e.pressure);
        return;
      }

      // Inside the selection's box: move it (like Excalidraw), so an
      // outlined shape can be dragged by its middle. Fingers also pick up
      // a layer they land just next to.
      const selected = actions.getSelection();
      const snapshot = actions.getSnapshot();
      const bounds = boundingBox(
        selected
          .map((id) => snapshot.layers[id])
          .filter((layer) => layer !== undefined)
      );
      const pad = 6 / camera.scale;
      const inSelection =
        bounds !== null &&
        point.x >= bounds.x - pad &&
        point.x <= bounds.x + bounds.width + pad &&
        point.y >= bounds.y - pad &&
        point.y <= bounds.y + bounds.height + pad;
      const nearby =
        !inSelection && e.pointerType === "touch"
          ? layerNear(e.clientX, e.clientY, 14)
          : null;

      if (inSelection || nearby) {
        if (nearby) actions.setSelection([nearby], { addToHistory: true });
        actions.pauseHistory();
        if (e.pointerType === "touch") {
          fingerDown.current = {
            id: nearby,
            x: e.clientX,
            y: e.clientY,
            moved: false,
          };
        }
        setCanvasState({ mode: CanvasMode.Translating, current: point });
        return;
      }

      setCanvasState({ origin: point, mode: CanvasMode.Pressing });
    },
    [actions, camera, canvasState, laser, readOnly, startDrawing]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const point = pointerEventToCanvasPoint(e, camera);
      const finger = fingerDown.current;
      fingerDown.current = null;

      if (
        canvasState.mode === CanvasMode.None ||
        canvasState.mode === CanvasMode.Pressing
      ) {
        unselectLayers();
        setCanvasState({ mode: CanvasMode.None });
      } else if (canvasState.mode === CanvasMode.Pencil) {
        insertPath();
      } else if (canvasState.mode === CanvasMode.Creating) {
        if (
          e.pointerType === "touch" &&
          (canvasState.layerType === LayerType.Text ||
            canvasState.layerType === LayerType.Note)
        ) {
          openKeyboard();
        }
        finishCreating({
          ...canvasState,
          current: point,
          constrain: e.shiftKey,
        });
      } else if (canvasState.mode === CanvasMode.Panning) {
        setCanvasState(stateBeforePan.current);
      } else if (canvasState.mode === CanvasMode.Eraser) {
        // One undo step for the whole stroke.
        const ids = eraser.current?.ids ?? [];
        eraser.current = null;
        if (ids.length > 0) actions.deleteLayers(ids);
        setCanvasState({ mode: CanvasMode.Eraser, erasing: null });
      } else if (
        canvasState.mode !== CanvasMode.Inserting &&
        canvasState.mode !== CanvasMode.Comment &&
        canvasState.mode !== CanvasMode.Hand &&
        canvasState.mode !== CanvasMode.Laser
      ) {
        setCanvasState({ mode: CanvasMode.None });
      }

      actions.resumeHistory();

      // A tap (not a drag) on text or a note: edit it, caret where tapped.
      if (finger?.id && !finger.moved) {
        editLayerTextAt(finger.id, e.clientX, e.clientY);
      }
    },
    [actions, camera, canvasState, finishCreating, unselectLayers, insertPath]
  );

  const onLayerPointerDown = useCallback(
    (e: React.PointerEvent, layerId: string) => {
      // Left to the canvas: drawing over the layer, panning, commenting.
      if (
        readOnly ||
        e.button !== 0 ||
        canvasState.mode === CanvasMode.Pencil ||
        canvasState.mode === CanvasMode.Inserting ||
        canvasState.mode === CanvasMode.Comment ||
        canvasState.mode === CanvasMode.Hand ||
        canvasState.mode === CanvasMode.Eraser ||
        canvasState.mode === CanvasMode.Laser
      ) {
        return;
      }

      actions.pauseHistory();
      e.stopPropagation();

      const point = pointerEventToCanvasPoint(e, camera);

      if (!actions.getSelection().includes(layerId)) {
        actions.setSelection([layerId], { addToHistory: true });
      }

      if (e.pointerType === "touch") {
        fingerDown.current = {
          id: layerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
        };
      }

      setCanvasState({ mode: CanvasMode.Translating, current: point });
    },
    [actions, camera, canvasState.mode, readOnly]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      if (canvasState.mode === CanvasMode.Panning) {
        const { last } = canvasState;
        setCamera((c) => ({
          ...c,
          x: c.x + e.clientX - last.x,
          y: c.y + e.clientY - last.y,
        }));
        setCanvasState({
          ...canvasState,
          last: { x: e.clientX, y: e.clientY },
        });
        return;
      }

      const current = pointerEventToCanvasPoint(e, camera);

      if (canvasState.mode === CanvasMode.Laser) {
        if (e.buttons === 1) laser.add(current);
      } else if (canvasState.mode === CanvasMode.Eraser) {
        const stroke = eraser.current;
        if (stroke && e.buttons & 1) {
          const at = { x: e.clientX, y: e.clientY };
          const added = [...layersUnder(stroke.last, at)].filter(
            (id) => !stroke.ids.includes(id)
          );
          stroke.last = at;
          if (added.length > 0) {
            stroke.ids = [...stroke.ids, ...added];
            setCanvasState({ mode: CanvasMode.Eraser, erasing: stroke.ids });
          }
        }
      } else if (canvasState.mode === CanvasMode.Creating) {
        setCanvasState({ ...canvasState, current, constrain: e.shiftKey });
      } else if (canvasState.mode === CanvasMode.MovingEndpoint) {
        moveArrowEndpoint(current);
      } else if (canvasState.mode === CanvasMode.Pressing) {
        startMultiSelection(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.SelectionNet) {
        updateSelectionNet(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.Translating) {
        // A finger wobbles while tapping: only a real drag moves layers.
        const finger = fingerDown.current;
        if (finger && !finger.moved) {
          const at = { x: e.clientX, y: e.clientY };
          if (distanceBetween(finger, at) < TAP_SLOP) return;
          finger.moved = true;
        }
        actions.translateLayers(
          actions.getSelection(),
          offsetBetween(lastPointOf(canvasState), current)
        );
        setCanvasState({ mode: CanvasMode.Translating, current });
      } else if (canvasState.mode === CanvasMode.Resizing) {
        resizeSelectedLayer(current);
      } else if (canvasState.mode === CanvasMode.Pencil) {
        continueDrawing(current, e);
      }

      if (!readOnly) actions.setCursor(current);
    },
    [
      actions,
      continueDrawing,
      camera,
      canvasState,
      laser,
      moveArrowEndpoint,
      readOnly,
      resizeSelectedLayer,
      setCamera,
      startMultiSelection,
      updateSelectionNet,
    ]
  );

  const onPointerLeave = useCallback(() => {
    actions.setCursor(null);
  }, [actions]);

  // The browser took the touch over (e.g. a long press): drop what it was
  // doing without finishing it, and keep the tool.
  const onPointerCancel = useCallback(() => {
    fingerDown.current = null;
    eraser.current = null;
    actions.setPencilDraft(null);
    actions.resumeHistory();
    setCanvasState((state) => {
      switch (state.mode) {
        case CanvasMode.Creating:
          return { mode: CanvasMode.Inserting, layerType: state.layerType };
        case CanvasMode.Eraser:
          return { mode: CanvasMode.Eraser, erasing: null };
        case CanvasMode.Panning:
          return stateBeforePan.current;
        case CanvasMode.Pencil:
        case CanvasMode.Hand:
        case CanvasMode.Laser:
        case CanvasMode.Inserting:
        case CanvasMode.Comment:
          return state;
        default:
          return { mode: CanvasMode.None };
      }
    });
  }, [actions]);

  // Two-finger touch: pinch to zoom and drag to pan. These run in the
  // capture phase, before layers and the canvas see the event, and stop it
  // while a pinch is going on.
  const onTouchDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;

      // The first finger of a touch: no other can be down. Forget fingers
      // whose lift never reached the canvas, or every later touch would
      // count as a second finger (a pinch) and do nothing.
      if (e.isPrimary) {
        touches.current.clear();
        pinch.current = null;
        ignoreTouches.current = false;
      }

      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        pinch.current = {
          distance: Math.max(distanceBetween(a, b), 1),
          midpoint: midpointOf(a, b),
          camera,
        };
        ignoreTouches.current = true;

        // Drop what the first finger started: a stroke, a shape, a net.
        actions.setPencilDraft(null);
        actions.resumeHistory();
        setCanvasState((state) =>
          state.mode === CanvasMode.Creating
            ? { mode: CanvasMode.Inserting, layerType: state.layerType }
            : state.mode === CanvasMode.Pencil ||
                state.mode === CanvasMode.Inserting ||
                state.mode === CanvasMode.Comment
              ? state
              : { mode: CanvasMode.None }
        );
      }

      if (ignoreTouches.current) e.stopPropagation();
    },
    [actions, camera]
  );

  const onTouchMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || !touches.current.has(e.pointerId)) {
      return;
    }

    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const start = pinch.current;
    if (start && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()];
      const scale = clampScale(
        (start.camera.scale * distanceBetween(a, b)) / start.distance
      );
      const anchor = screenToCanvas(start.midpoint, start.camera);
      const midpoint = midpointOf(a, b);

      setCamera({
        x: midpoint.x - anchor.x * scale,
        y: midpoint.y - anchor.y * scale,
        scale,
      });
    }

    if (ignoreTouches.current) e.stopPropagation();
  }, [setCamera]);

  const onTouchEnd = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;

    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;

    if (ignoreTouches.current) {
      e.stopPropagation();
      if (touches.current.size === 0) ignoreTouches.current = false;
    }
  }, []);

  // Everything the command palette (Mod+/) offers.
  const commands = useMemo<Command[]>(() => {
    const tool = (
      id: string,
      label: string,
      icon: Command["icon"],
      shortcut: string,
      state: CanvasState
    ): Command => ({
      id,
      label,
      group: "Tools",
      icon,
      shortcut,
      run: () => changeTool(state),
    });
    const list: Command[] = [];

    if (!readOnly) {
      list.push(
        tool("select", "Select", MousePointer2, "V", { mode: CanvasMode.None }),
        tool("rectangle", "Rectangle", Square, "R", {
          mode: CanvasMode.Inserting,
          layerType: LayerType.Rectangle,
        }),
        tool("ellipse", "Ellipse", Circle, "O", {
          mode: CanvasMode.Inserting,
          layerType: LayerType.Ellipse,
        }),
        tool("arrow", "Arrow", MoveUpRight, "A", {
          mode: CanvasMode.Inserting,
          layerType: LayerType.Arrow,
        }),
        tool("pen", "Pen", Pencil, "P", { mode: CanvasMode.Pencil }),
        tool("text", "Text", Type, "T", {
          mode: CanvasMode.Inserting,
          layerType: LayerType.Text,
        }),
        tool("note", "Sticky note", StickyNote, "N", {
          mode: CanvasMode.Inserting,
          layerType: LayerType.Note,
        }),
        {
          id: "image",
          label: "Image",
          group: "Tools",
          icon: ImagePlus,
          shortcut: "I",
          keywords: "picture photo upload",
          run: pickImage,
        },
        ...(comments
          ? [
              tool("comment", "Comment", MessageCircle, "C", {
                mode: CanvasMode.Comment,
              }),
            ]
          : []),
        tool("hand", "Hand (move the view)", Hand, "H", {
          mode: CanvasMode.Hand,
        }),
        tool("eraser", "Eraser", Eraser, "E", {
          mode: CanvasMode.Eraser,
          erasing: null,
        }),
        tool("laser", "Laser pointer", WandSparkles, "K", {
          mode: CanvasMode.Laser,
        }),
        {
          id: "undo",
          label: "Undo",
          group: "Edit",
          icon: Undo2,
          shortcut: "Mod+Z",
          run: actions.undo,
        },
        {
          id: "redo",
          label: "Redo",
          group: "Edit",
          icon: Redo2,
          shortcut: "Mod+Shift+Z",
          run: actions.redo,
        },
        {
          id: "select-all",
          label: "Select all",
          group: "Edit",
          icon: SquareDashedMousePointer,
          shortcut: "Mod+A",
          run: () =>
            actions.setSelection([...actions.getSnapshot().layerIds], {
              addToHistory: true,
            }),
        },
        {
          id: "duplicate",
          label: "Duplicate selection",
          group: "Edit",
          icon: Copy,
          shortcut: "Mod+D",
          run: () => duplicateSelection(actions),
        },
        {
          id: "delete",
          label: "Delete selection",
          group: "Edit",
          icon: Trash2,
          shortcut: "Delete",
          run: () => actions.deleteLayers(actions.getSelection()),
        },
        {
          id: "front",
          label: "Bring to front",
          group: "Edit",
          icon: ArrowUpToLine,
          shortcut: "Mod+Shift+]",
          keywords: "layer order",
          run: () => actions.moveLayers(actions.getSelection(), "front"),
        },
        {
          id: "back",
          label: "Send to back",
          group: "Edit",
          icon: ArrowDownToLine,
          shortcut: "Mod+Shift+[",
          keywords: "layer order",
          run: () => actions.moveLayers(actions.getSelection(), "back"),
        }
      );
    }

    list.push(
      {
        id: "zoom-in",
        label: "Zoom in",
        group: "View",
        icon: ZoomIn,
        shortcut: "Mod+=",
        run: zoomIn,
      },
      {
        id: "zoom-out",
        label: "Zoom out",
        group: "View",
        icon: ZoomOut,
        shortcut: "Mod+-",
        run: zoomOut,
      },
      {
        id: "zoom-reset",
        label: "Reset zoom to 100%",
        group: "View",
        shortcut: "Mod+0",
        run: resetZoom,
      },
      {
        id: "fit",
        label: "Fit everything on screen",
        group: "View",
        icon: Expand,
        shortcut: "Shift+1",
        keywords: "zoom",
        run: fitToScreen,
      },
      {
        id: "find",
        label: "Find on canvas",
        group: "View",
        icon: Search,
        shortcut: "Mod+F",
        keywords: "search text",
        run: openSearch,
      },
      ...(readOnly
        ? []
        : [
            {
              id: "library",
              label: "Library",
              group: "View",
              icon: Library,
              run: () => setSidebarTab("library"),
            },
          ]),
      {
        id: "theme-light",
        label: "Light theme",
        group: "Theme",
        icon: Sun,
        run: () => setTheme("light"),
      },
      {
        id: "theme-dark",
        label: "Dark theme",
        group: "Theme",
        icon: Moon,
        run: () => setTheme("dark"),
      },
      {
        id: "theme-system",
        label: "System theme",
        group: "Theme",
        icon: Monitor,
        run: () => setTheme("system"),
      },
      ...(readOnly
        ? []
        : [
            {
              id: "open",
              label: "Open a board file",
              group: "Board",
              icon: FolderOpen,
              shortcut: "Mod+O",
              run: openFile,
            },
          ]),
      {
        id: "save",
        label: "Save to a file",
        group: "Board",
        icon: Save,
        shortcut: "Mod+S",
        keywords: "download",
        run: saveFile,
      },
      {
        id: "export",
        label: "Export image",
        group: "Board",
        icon: ImageDown,
        shortcut: "Mod+Shift+E",
        keywords: "png svg download picture",
        run: () => setDialog("export"),
      },
      ...(onShare
        ? [
            {
              id: "share",
              label: "Live collaboration",
              group: "Board",
              icon: Users,
              keywords: "share link",
              run: onShare,
            },
          ]
        : []),
      {
        id: "help",
        label: "Keyboard shortcuts",
        group: "Board",
        icon: HelpCircle,
        shortcut: "?",
        keywords: "help",
        run: () => setDialog("help"),
      },
      ...(readOnly
        ? []
        : [
            {
              id: "reset",
              label: "Reset the canvas",
              group: "Board",
              icon: Trash2,
              keywords: "clear",
              run: resetCanvas,
            },
          ])
    );

    return list;
  }, [
    actions,
    changeTool,
    comments,
    fitToScreen,
    onShare,
    openFile,
    openSearch,
    pickImage,
    readOnly,
    resetCanvas,
    resetZoom,
    saveFile,
    setTheme,
    zoomIn,
    zoomOut,
  ]);

  // The shape being dragged out, drawn before it is added. Nothing until
  // the pointer really moves: a click places the default size on release,
  // and showing that size first would flash before the drag takes over.
  const draftLayer =
    canvasState.mode === CanvasMode.Creating &&
    !isClickDrag(canvasState.origin, canvasState.current, camera.scale)
      ? createShapeLayer(
          canvasState.layerType,
          canvasState.origin,
          canvasState.current,
          lastUsedColor,
          { constrain: canvasState.constrain, scale: camera.scale }
        )
      : null;

  return (
    <main
      className="h-full w-full relative touch-none"
      style={{ backgroundColor: background ?? "#ffffff" }}
      onDragOver={(e) => {
        if (!readOnly && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        const file = e.dataTransfer.files[0];
        if (readOnly || !file) return;

        e.preventDefault();
        void addImage(
          file,
          screenToCanvas({ x: e.clientX, y: e.clientY }, camera)
        );
      }}
    >
      <CanvasReadOnlyContext.Provider value={readOnly}>
        {/*
          The top bar: the toolbar in the middle of the free area and the
          board's actions at the right. The right column never shrinks
          below its content, so with the sidebar open the toolbar moves
          left instead of being covered. Clicks pass through the gaps.
        */}
        <div
          className="absolute top-2 left-2 z-20 grid grid-cols-[1fr_auto_minmax(max-content,1fr)] items-start gap-x-2 pointer-events-none"
          style={{ right: sidebarOpen ? SIDEBAR_WIDTH + 8 : 8 }}
        >
          <div
            className={
              isPhone
                ? "justify-self-start pointer-events-auto"
                : "h-11 max-w-full min-w-0 justify-self-start bg-white rounded-xl border border-neutral-200 px-1 flex items-center shadow-md pointer-events-auto"
            }
          >
            <MainMenu
              home={isPhone ? home : undefined}
              standalone={isPhone}
              onOpenFile={readOnly ? undefined : openFile}
              onSave={saveFile}
              onExport={() => setDialog("export")}
              onShare={onShare}
              onPalette={() => setDialog("palette")}
              onFind={openSearch}
              onHelp={() => setDialog("help")}
              onReset={readOnly ? undefined : resetCanvas}
              background={background}
              onBackground={readOnly ? undefined : actions.setBackground}
            >
              {menuItems}
            </MainMenu>
            {!isPhone && title}
          </div>
          <Toolbar
            home={home}
            readOnly={readOnly}
            isPhone={isPhone}
            canvasState={canvasState}
            setCanvasState={changeTool}
            onImageFile={(file) => void addImage(file)}
            hasComments={!!comments}
          />
          <div className="col-start-3 flex min-w-0 items-center justify-end gap-x-2 pointer-events-auto">
            {topRight}
            {!sidebarOpen && (
              <Hint
                label={withShortcut("Search, library and comments", "Mod+F")}
                side="bottom"
                sideOffset={8}
              >
                <button
                  type="button"
                  aria-label="Open sidebar"
                  onClick={() => setSidebarTab(readOnly ? "search" : "library")}
                  className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-lg bg-[#ececf4] flex items-center justify-center text-neutral-800 hover:bg-[#d9d9ef]"
                >
                  <PanelRight className="h-[18px] w-[18px]" />
                </button>
              </Hint>
            )}
          </div>
        </div>
        {!readOnly && (
          <PropertiesPanel
            isHidden={isBusy(canvasState.mode) || (isPhone && !stylesOpen)}
            setLastUsedColor={setLastUsedColor}
            sheet={isPhone}
          />
        )}
        {sidebarTab && (
          <Sidebar
            tab={sidebarTab}
            setTab={setSidebarTab}
            onClose={closeSidebar}
            pinned={sidebarPinned}
            setPinned={setPinned}
            readOnly={readOnly}
            showLayer={showLayer}
            insertItem={insertLibraryItem}
            comments={commentsList?.({ focus: focusPoint })}
          />
        )}
        {isPhone ? (
          !readOnly && (
            <PhoneActions
              layerCount={layerCount}
              history={{ undo: actions.undo, redo: actions.redo, canUndo, canRedo }}
              hasSelection={selection.length > 0}
              onDuplicate={() => duplicateSelection(actions)}
              onDelete={() => actions.deleteLayers(actions.getSelection())}
              stylesOpen={stylesOpen}
              onToggleStyles={() => setStylesOpen((open) => !open)}
            />
          )
        ) : (
          <ZoomControls
            history={
              readOnly
                ? undefined
                : { undo: actions.undo, redo: actions.redo, canUndo, canRedo }
            }
            scale={camera.scale}
            layerCount={readOnly ? 0 : layerCount}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetZoom}
          />
        )}
        <input
          id="board-file-input"
          type="file"
          accept={BOARD_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;

            readBoardFile(file)
              .then(loadBoard)
              .catch((error: Error) => toast.error(error.message));
          }}
        />
        <ExportDialog
          open={dialog === "export"}
          onOpenChange={(open) => setDialog(open ? "export" : null)}
          getSnapshot={actions.getSnapshot}
          selection={selection}
          name={exportName}
        />
        <HelpDialog
          open={dialog === "help"}
          onOpenChange={(open) => setDialog(open ? "help" : null)}
        />
        <CommandPalette
          open={dialog === "palette"}
          onOpenChange={(open) => setDialog(open ? "palette" : null)}
          commands={commands}
        />
        <AlertDialog
          open={confirm !== null}
          onOpenChange={(open) => !open && setConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirm?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirm?.onConfirm()}>
                {confirm?.action}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {canvasState.mode === CanvasMode.Eraser && canvasState.erasing && (
          <style>
            {canvasState.erasing
              .map((id) => `[data-layer="${CSS.escape(id)}"]{opacity:.25}`)
              .join("")}
          </style>
        )}
        {followTarget && (
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 z-30 border-4"
            style={{
              borderColor: followTarget.color,
              right: sidebarOpen ? SIDEBAR_WIDTH : 0,
            }}
          >
            <div
              className="pointer-events-auto absolute left-1/2 bottom-[58px] lg:bottom-0 -translate-x-1/2 flex items-center gap-x-1 whitespace-nowrap rounded-t-lg py-1 pl-3 pr-1 text-xs font-medium text-white"
              style={{ backgroundColor: followTarget.color }}
            >
              Following {followTarget.name}
              <button
                type="button"
                aria-label="Stop following"
                onClick={() => useFollow.getState().stop()}
                className="rounded p-0.5 hover:bg-black/15"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        <svg
          ref={svgRef}
          data-canvas
          className="h-screen w-screen"
          style={{ cursor: cursorFor(canvasState, readOnly) }}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerDownCapture={onTouchDown}
          onPointerMoveCapture={onTouchMove}
          onPointerUpCapture={onTouchEnd}
          onPointerCancelCapture={onTouchEnd}
        >
          <CameraScaleContext.Provider value={camera.scale}>
            <g
              transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}
            >
              {layerIds.map((layerId) => (
                <LayerPreview
                  key={layerId}
                  id={layerId}
                  onLayerPointerDown={onLayerPointerDown}
                  selectionColor={remoteSelections[layerId]}
                />
              ))}
              {!readOnly && (
                <SelectionBox
                  onResizeHandlePointerDown={onResizeHandlePointerDown}
                  onArrowHandlePointerDown={onArrowHandlePointerDown}
                />
              )}
              {draftLayer && (
                <CanvasReadOnlyContext.Provider value>
                  <g pointerEvents="none" opacity={0.8}>
                    <LayerView
                      id="draft"
                      layer={draftLayer}
                      onLayerPointerDown={() => {}}
                    />
                  </g>
                </CanvasReadOnlyContext.Provider>
              )}
              {canvasState.mode === CanvasMode.SelectionNet &&
                canvasState.current != null && (
                  <rect
                    className="fill-blue-500/5 stroke-blue-500 stroke-1"
                    vectorEffect="non-scaling-stroke"
                    x={Math.min(canvasState.origin.x, canvasState.current.x)}
                    y={Math.min(canvasState.origin.y, canvasState.current.y)}
                    width={Math.abs(
                      canvasState.origin.x - canvasState.current.x
                    )}
                    height={Math.abs(
                      canvasState.origin.y - canvasState.current.y
                    )}
                  />
                )}
              {foundId && <FoundMark id={foundId} />}
              {overlay}
              <LaserPath trail={laser.trail} />
              {pencilDraft != null && pencilDraft.length > 0 && (
                <Path
                  points={pencilDraft}
                  fill={colorToCss(lastUsedColor)}
                  x={0}
                  y={0}
                />
              )}
            </g>
          </CameraScaleContext.Provider>
        </svg>
        {comments?.({
          camera,
          draft: canvasState.mode === CanvasMode.Comment ? commentDraft : null,
          onDraftDone: onCommentDraftDone,
        })}
      </CanvasReadOnlyContext.Provider>
    </main>
  );
};

/** Marks the current search result: a dashed box around its layer. */
const FoundMark = ({ id }: { id: string }) => {
  const layer = useBoardStore().useLayer(id);
  if (!layer) return null;

  return (
    <rect
      x={layer.x - 6}
      y={layer.y - 6}
      width={layer.width + 12}
      height={layer.height + 12}
      rx={6}
      fill="rgb(251 146 60 / 0.08)"
      stroke="rgb(249 115 22)"
      strokeWidth={2}
      strokeDasharray="6 4"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
};
