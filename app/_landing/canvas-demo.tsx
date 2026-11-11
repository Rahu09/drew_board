import {
  EllipsisVertical,
  Eraser,
  Hand,
  ImagePlus,
  Menu,
  Minus,
  MousePointer2,
  MoveUpRight,
  PanelRight,
  Pencil,
  Plus,
  Redo2,
  Square,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";

import { shapePaths } from "@/components/canvas/rough-shape";

import { handFont } from "./fonts";

// A picture of a board, drawn as one SVG and animated with SVG <animate>
// elements: no JavaScript, and it scales with the page. It mirrors the real
// canvas: white paper, hand-drawn shapes (the same rough.js helper, run on
// the server), the toolbar on top, the menu and board name top left, Share
// top right, zoom and undo bottom left.
const NOTE_YELLOW = "#FFF9B1";
const NOTE_PINK = "#FFC9DE";
const INK = "#1F2937";
const PEN_BLUE = "#1971C2";
const SHAPE_ORANGE = "#E8590C";
const PILL = "#ECECF4";
const BORDER = "#E5E5E5";
const INDIGO = "#6366F1";
const MAYA = "#7C3AED";
const LEO = "#059669";
const YOU = "#D97706";

// Leo underlines the title with the pen. The cursor follows the same path
// the stroke is drawn along, so they stay in sync.
const PEN_PATH =
  "M298 138 C330 150 362 128 396 139 S452 148 478 134 S506 132 512 140";
const PEN_DURATION = "8s";
const DRAW_KEY_TIMES = "0;0.45;1";

// Maya wanders over the board and keeps her selection on the rectangle.
const MAYA_PATH =
  "M330 420 C390 380 470 400 470 450 S380 540 320 500 S270 450 330 420";

// The two hand-drawn shapes. A fixed seed keeps their wobble the same on
// every render.
const RECT = { x: 96, y: 352, width: 196, height: 112 };
const ELLIPSE = { x: 742, y: 398, width: 196, height: 118 };

const rectPaths = shapePaths({
  kind: "rectangle",
  ...RECT,
  roughness: 1,
  edges: "round",
  stroke: INK,
  strokeWidth: 2,
  background: null,
  seed: 11,
});

const ellipsePaths = shapePaths({
  kind: "ellipse",
  ...ELLIPSE,
  roughness: 1,
  stroke: SHAPE_ORANGE,
  strokeWidth: 2,
  background: null,
  seed: 23,
});

// An arrow layer from the rectangle to the ellipse: a line and a two-stroke
// head, as on the canvas.
const ARROW = "M304 414 L728 452 M711 441 L728 452 L710 460";

const toolbarIcons = [
  Hand,
  MousePointer2,
  Pencil,
  Eraser,
  Square,
  MoveUpRight,
  Type,
  ImagePlus,
  StickyNote,
  EllipsisVertical,
];
const ACTIVE_TOOL = 1;

const Cursor = ({ name, color }: { name: string; color: string }) => (
  <g>
    <path
      d="M0 0 L0 19 L5 14.2 L8.6 22 L12 20.5 L8.4 12.9 L15 12.7 Z"
      fill={color}
      stroke="white"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <rect
      x={16}
      y={20}
      width={name.length * 8 + 16}
      height={22}
      rx={6}
      fill={color}
    />
    <text x={24} y={35.5} fontSize={12.5} fontWeight={600} fill="white">
      {name}
    </text>
  </g>
);

/** Lines of hand-written text, centered on (cx, cy). */
const HandText = ({
  cx,
  cy,
  lines,
  size,
  fill = INK,
}: {
  cx: number;
  cy: number;
  lines: string[];
  size: number;
  fill?: string;
}) => {
  const lineHeight = size * 1.25;

  return (
    <text
      x={cx}
      y={cy - ((lines.length - 1) * lineHeight) / 2}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={size}
      fill={fill}
      style={{ fontFamily: handFont.style.fontFamily }}
    >
      {lines.map((line, index) => (
        <tspan key={line} x={cx} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

const Note = ({
  x,
  y,
  width,
  height,
  fill,
  lines,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  lines: string[];
}) => (
  <g>
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      filter="url(#demo-shadow)"
    />
    <HandText
      cx={x + width / 2}
      cy={y + height / 2}
      lines={lines}
      size={26}
    />
  </g>
);

const Avatar = ({
  cx,
  initial,
  color,
}: {
  cx: number;
  initial: string;
  color: string;
}) => (
  <g>
    <circle cx={cx} cy={36} r={15} fill="white" stroke={color} strokeWidth={2.5} />
    <text
      x={cx}
      y={36.5}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={13}
      fontWeight={600}
      fill={color}
    >
      {initial}
    </text>
  </g>
);

export const CanvasDemo = () => {
  return (
    // Dark theme: inverted like a real board in its dark theme (globals.css).
    <div className="overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-blue-950/10 ring-1 ring-black/5 dark:shadow-black/40 dark:[filter:invert(93%)_hue-rotate(180deg)]">
      <svg
        viewBox="0 0 1000 600"
        className="block h-auto w-full select-none"
        role="img"
        aria-label="A Board canvas with sticky notes, hand-drawn shapes joined by an arrow, and a comment. One teammate underlines the title with the pen while another moves their cursor across the board."
      >
        <defs>
          <filter id="demo-shadow" x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx={0} dy={2} stdDeviation={3} floodOpacity={0.14} />
          </filter>
        </defs>

        <rect width={1000} height={600} fill="white" />

        {/* Canvas content */}
        <text
          x={300}
          y={124}
          fontSize={38}
          fill={INK}
          style={{ fontFamily: handFont.style.fontFamily }}
        >
          Q3 planning
        </text>
        <Note
          x={300}
          y={166}
          width={190}
          height={164}
          fill={NOTE_YELLOW}
          lines={["Talk to", "five users"]}
        />
        <Note
          x={524}
          y={196}
          width={180}
          height={150}
          fill={NOTE_PINK}
          lines={["Try it,", "no sign-up"]}
        />

        {rectPaths.map((path, index) => (
          <path
            key={index}
            d={path.d}
            fill={path.fill}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <HandText
          cx={RECT.x + RECT.width / 2}
          cy={RECT.y + RECT.height / 2}
          lines={["Design"]}
          size={28}
        />
        {ellipsePaths.map((path, index) => (
          <path
            key={index}
            d={path.d}
            fill={path.fill}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <HandText
          cx={ELLIPSE.x + ELLIPSE.width / 2}
          cy={ELLIPSE.y + ELLIPSE.height / 2}
          lines={["Launch"]}
          size={28}
          fill={SHAPE_ORANGE}
        />
        <path
          d={ARROW}
          fill="none"
          stroke={INK}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Another user's selection is outlined in their color. */}
        <rect
          x={RECT.x - 8}
          y={RECT.y - 8}
          width={RECT.width + 16}
          height={RECT.height + 16}
          fill="none"
          stroke={MAYA}
          strokeWidth={2}
        />

        {/* A comment pinned to the board. */}
        <g filter="url(#demo-shadow)">
          {/* A round bubble whose bottom-left corner points at the spot. */}
          <path
            d="M888 364 a16 16 0 0 1 32 0 a16 16 0 0 1 -16 16 h-16 z"
            fill="white"
            stroke={BORDER}
          />
          <circle cx={904} cy={364} r={11} fill={YOU} />
          <text
            x={904}
            y={364.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={600}
            fill="white"
          >
            Y
          </text>
        </g>

        {/* Animated layer: hidden when the visitor prefers reduced motion. */}
        <g className="motion-reduce:hidden">
          <path
            d={PEN_PATH}
            pathLength={1}
            fill="none"
            stroke={PEN_BLUE}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="1;0;0"
              keyTimes={DRAW_KEY_TIMES}
              dur={PEN_DURATION}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;1;0;0"
              keyTimes="0;0.8;0.9;1"
              dur={PEN_DURATION}
              repeatCount="indefinite"
            />
          </path>
          <g>
            <animateMotion
              path={PEN_PATH}
              keyPoints="0;1;1"
              keyTimes={DRAW_KEY_TIMES}
              calcMode="linear"
              dur={PEN_DURATION}
              repeatCount="indefinite"
            />
            <Cursor name="Leo" color={LEO} />
          </g>
          <g>
            <animateMotion
              path={MAYA_PATH}
              dur="11s"
              repeatCount="indefinite"
            />
            <Cursor name="Maya" color={MAYA} />
          </g>
        </g>

        {/* Still layer for reduced motion: the finished stroke and cursors. */}
        <g className="hidden motion-reduce:inline">
          <path
            d={PEN_PATH}
            fill="none"
            stroke={PEN_BLUE}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g transform="translate(512 140)">
            <Cursor name="Leo" color={LEO} />
          </g>
          <g transform="translate(470 450)">
            <Cursor name="Maya" color={MAYA} />
          </g>
        </g>

        {/* Board chrome, as in the app */}

        {/* Menu and board name */}
        <g filter="url(#demo-shadow)">
          <rect
            x={16}
            y={14}
            width={176}
            height={44}
            rx={12}
            fill="white"
            stroke={BORDER}
          />
        </g>
        <rect x={22} y={20} width={32} height={32} rx={8} fill={PILL} />
        <Menu x={28} y={26} width={20} height={20} color={INK} />
        <text x={66} y={41} fontSize={15} fontWeight={500} fill={INK}>
          Q3 planning
        </text>

        {/* Toolbar */}
        <g filter="url(#demo-shadow)">
          <rect
            x={286}
            y={13}
            width={428}
            height={46}
            rx={12}
            fill="white"
            stroke={BORDER}
          />
        </g>
        <image href="/logo.svg" x={297} y={25} width={33} height={22} />
        <rect x={338} y={22} width={1} height={28} fill={BORDER} />
        <rect
          x={346 + ACTIVE_TOOL * 36}
          y={19}
          width={34}
          height={34}
          rx={8}
          fill="#E0E7FF"
        />
        {toolbarIcons.map((Icon, index) => (
          <Icon
            key={index}
            x={353 + index * 36}
            y={26}
            width={20}
            height={20}
            color={index === ACTIVE_TOOL ? "#312E81" : INK}
          />
        ))}

        {/* Who is here, Share, sidebar */}
        <Avatar cx={806} initial="M" color={MAYA} />
        <Avatar cx={832} initial="L" color={LEO} />
        <Avatar cx={858} initial="Y" color={YOU} />
        <rect x={882} y={18} width={62} height={36} rx={8} fill={INDIGO} />
        <text
          x={913}
          y={36.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={14}
          fontWeight={500}
          fill="white"
        >
          Share
        </text>
        <rect x={950} y={18} width={36} height={36} rx={8} fill={PILL} />
        <PanelRight x={958} y={26} width={20} height={20} color={INK} />

        {/* Zoom, undo and redo */}
        <rect x={16} y={550} width={124} height={36} rx={8} fill={PILL} />
        <Minus x={26} y={560} width={16} height={16} color={INK} />
        <text
          x={78}
          y={568.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fill={INK}
        >
          100%
        </text>
        <Plus x={114} y={560} width={16} height={16} color={INK} />
        <rect x={148} y={550} width={76} height={36} rx={8} fill={PILL} />
        <Undo2 x={159} y={560} width={16} height={16} color={INK} />
        <Redo2 x={197} y={560} width={16} height={16} color="#A3A3A3" />
      </svg>
    </div>
  );
};
