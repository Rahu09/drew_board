import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  Circle,
  EllipsisVertical,
  Eraser,
  Hand,
  ImagePlus,
  MessageCircle,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Shapes,
  Square,
  StickyNote,
  Type,
  WandSparkles,
} from "lucide-react";

import {
  CanvasMode,
  CanvasState,
  InsertableLayerType,
  LayerType,
} from "@/types/canvas";
import { Hint } from "@/components/hints";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { shortcutLabel } from "@/lib/shortcuts";

import { ToolButton } from "./tool-button";

/** Where the logo at the start of the toolbar leads. */
export type ToolbarHome = { href: string; label: string };

interface ToolbarProps {
  home: ToolbarHome;
  /** View only: just the logo. */
  readOnly: boolean;
  /** Phone width: the tools that matter most, across the bottom. */
  isPhone: boolean;
  canvasState: CanvasState;
  setCanvasState: (newState: CanvasState) => void;
  /** Called with the file picked from the image button. */
  onImageFile: (file: File) => void;
  /** Whether this board has comments (live boards). */
  hasComments: boolean;
}

/** File types the image button offers (see convex/images.ts). */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

type ToolId =
  | "select"
  | "rectangle"
  | "ellipse"
  | "arrow"
  | "pen"
  | "text"
  | "note"
  | "image"
  | "comment"
  | "hand"
  | "eraser"
  | "laser";

type Tool = {
  id: ToolId;
  label: string;
  shortcut: string;
  icon: typeof Square;
  /** The state the tool switches to (none: the image picker). */
  state?: CanvasState;
  isActive: (state: CanvasState) => boolean;
};

const inserting = (state: CanvasState, type: InsertableLayerType) =>
  (state.mode === CanvasMode.Inserting || state.mode === CanvasMode.Creating) &&
  state.layerType === type;

const shapeTool = (
  id: ToolId,
  label: string,
  shortcut: string,
  icon: typeof Square,
  layerType: InsertableLayerType
): Tool => ({
  id,
  label,
  shortcut,
  icon,
  state: { mode: CanvasMode.Inserting, layerType },
  isActive: (state) => inserting(state, layerType),
});

const TOOLS: Record<ToolId, Tool> = {
  select: {
    id: "select",
    label: "Select",
    shortcut: "V",
    icon: MousePointer2,
    state: { mode: CanvasMode.None },
    isActive: (state) =>
      state.mode === CanvasMode.None ||
      state.mode === CanvasMode.Translating ||
      state.mode === CanvasMode.SelectionNet ||
      state.mode === CanvasMode.Pressing ||
      state.mode === CanvasMode.Resizing ||
      state.mode === CanvasMode.MovingEndpoint,
  },
  rectangle: shapeTool("rectangle", "Rectangle", "R", Square, LayerType.Rectangle),
  ellipse: shapeTool("ellipse", "Ellipse", "O", Circle, LayerType.Ellipse),
  arrow: shapeTool("arrow", "Arrow", "A", MoveUpRight, LayerType.Arrow),
  pen: {
    id: "pen",
    label: "Pen",
    shortcut: "P",
    icon: Pencil,
    state: { mode: CanvasMode.Pencil },
    isActive: (state) => state.mode === CanvasMode.Pencil,
  },
  text: shapeTool("text", "Text", "T", Type, LayerType.Text),
  note: shapeTool("note", "Sticky note", "N", StickyNote, LayerType.Note),
  image: {
    id: "image",
    label: "Image",
    shortcut: "I",
    icon: ImagePlus,
    isActive: () => false,
  },
  comment: {
    id: "comment",
    label: "Comment",
    shortcut: "C",
    icon: MessageCircle,
    state: { mode: CanvasMode.Comment },
    isActive: (state) => state.mode === CanvasMode.Comment,
  },
  hand: {
    id: "hand",
    label: "Hand (move the view)",
    shortcut: "H",
    icon: Hand,
    state: { mode: CanvasMode.Hand },
    isActive: (state) =>
      state.mode === CanvasMode.Hand ||
      (state.mode === CanvasMode.Panning && !!state.byHand),
  },
  eraser: {
    id: "eraser",
    label: "Eraser",
    shortcut: "E",
    icon: Eraser,
    state: { mode: CanvasMode.Eraser, erasing: null },
    isActive: (state) => state.mode === CanvasMode.Eraser,
  },
  laser: {
    id: "laser",
    label: "Laser pointer",
    shortcut: "K",
    icon: WandSparkles,
    state: { mode: CanvasMode.Laser },
    isActive: (state) => state.mode === CanvasMode.Laser,
  },
};

/**
 * Which tools are in the bar and which in the "more tools" menu. The one
 * in use from the menu shows in the bar until another tool is picked.
 */
const LAYOUTS: Record<"wide" | "phone", { bar: ToolId[][]; more: ToolId[] }> =
  {
    wide: {
      bar: [
        ["select", "rectangle", "ellipse", "arrow", "pen", "text", "note", "image"],
        ["comment"],
      ],
      more: ["hand", "eraser", "laser"],
    },
    // Like Excalidraw on phones: moving around and erasing come first.
    phone: {
      bar: [
        ["hand", "select", "pen", "eraser", "rectangle", "arrow", "text", "image", "note"],
      ],
      more: ["ellipse", "comment", "laser"],
    },
  };

const Separator = () => (
  <div className="mx-1 h-6 w-px shrink-0 bg-neutral-200" aria-hidden />
);

const HomeLink = ({ home }: { home: ToolbarHome }) => (
  <Hint label={home.label} side="bottom" sideOffset={8}>
    <Link
      href={home.href}
      aria-label={home.label}
      className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center hover:bg-neutral-100"
    >
      <Image src="/logo.svg" alt="" height={26} width={26} />
    </Link>
  </Hint>
);

/**
 * The tools in one row: in the canvas's top bar on wide screens, at the
 * bottom on narrower ones, and across the whole bottom on phones.
 */
export const Toolbar = ({
  home,
  readOnly,
  isPhone,
  canvasState,
  setCanvasState,
  onImageFile,
  hasComments,
}: ToolbarProps) => {
  const layout = LAYOUTS[isPhone ? "phone" : "wide"];
  const available = (id: ToolId) => id !== "comment" || hasComments;
  const more = layout.more.filter(available).map((id) => TOOLS[id]);
  const activeMore = more.find((tool) => tool.isActive(canvasState));

  const pick = (tool: Tool) => {
    if (tool.state) setCanvasState(tool.state);
    else document.getElementById("canvas-image-input")?.click();
  };

  const button = (tool: Tool, isActive = tool.isActive(canvasState)) => (
    <ToolButton
      key={tool.id}
      label={tool.label}
      shortcut={isPhone ? undefined : tool.shortcut}
      icon={tool.icon}
      onClick={() => pick(tool)}
      isActive={isActive}
      side={isPhone ? "top" : "bottom"}
      size={isPhone ? "lg" : "md"}
    />
  );

  if (readOnly) {
    // The menu has the way home on phones.
    return isPhone ? (
      <div />
    ) : (
      <div className="pointer-events-auto bg-white rounded-xl border border-neutral-200 p-1 shadow-md">
        <HomeLink home={home} />
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      className={cn(
        "fixed z-20 pointer-events-auto bg-white rounded-xl border border-neutral-200 p-1 flex items-center gap-x-0.5 shadow-md",
        "overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        isPhone
          ? "left-2 right-2 bottom-2 justify-around"
          : "left-1/2 -translate-x-1/2 bottom-2 max-w-[calc(100vw-1rem)] lg:static lg:translate-x-0 lg:overflow-visible"
      )}
    >
      {!isPhone && (
        <>
          <HomeLink home={home} />
          <Separator />
        </>
      )}
      {layout.bar.map((group, index) => {
        const tools = group.filter(available);
        if (tools.length === 0) return null;

        return (
          <div key={index} className="contents">
            {index > 0 && <Separator />}
            {tools.map((id) => button(TOOLS[id]))}
          </div>
        );
      })}
      <input
        id="canvas-image-input"
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImageFile(file);
          // Lets the same file be picked again.
          e.target.value = "";
        }}
      />
      {!isPhone && <Separator />}
      {activeMore && button(activeMore, true)}
      <DropdownMenu>
        <Hint label="More tools" side={isPhone ? "top" : "bottom"} sideOffset={8}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More tools"
              className={cn(
                "shrink-0 rounded-lg flex items-center justify-center gap-x-0.5 text-neutral-800 hover:bg-neutral-100 data-[state=open]:bg-indigo-100",
                isPhone ? "h-11 min-w-0 flex-1 max-w-11" : "h-9 px-1.5"
              )}
            >
              {isPhone ? (
                <EllipsisVertical className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <>
                  <Shapes className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent
          align="end"
          side={isPhone ? "top" : "bottom"}
          sideOffset={10}
          className="w-60 p-1.5"
        >
          {more.map((tool) => {
            const Icon = tool.icon;
            return (
              <DropdownMenuItem
                key={tool.id}
                onSelect={() => pick(tool)}
                className={cn(
                  "h-9 cursor-pointer gap-x-3 px-2.5",
                  tool.isActive(canvasState) && "bg-indigo-50 text-indigo-900"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span className="flex-1">{tool.label}</span>
                <span className="text-xs text-muted-foreground">
                  {shortcutLabel(tool.shortcut)}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const ToolbarSkeleton = () => {
  return (
    <div className="absolute left-2 right-2 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 bottom-2 lg:bottom-auto lg:top-2 bg-white h-[46px] sm:w-[460px] rounded-xl border border-neutral-200 shadow-md" />
  );
};
