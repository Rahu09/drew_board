import {
  Circle,
  Menu,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";

import { handFont, logoFont } from "./fonts";

// A picture of a board, drawn as one SVG and animated with SVG <animate>
// elements: no JavaScript, and it scales with the page. Colors come from the
// board's color picker and cursor colors.
const NOTE_YELLOW = "#FFF9B1";
const NOTE_GREEN = "#44CA63";
const SHAPE_BLUE = "#278EED";
const SHAPE_ORANGE = "#FC8E2A";
const MAYA = "#7C3AED";
const LEO = "#059669";
const YOU = "#D97706";
const INK = "#1F2937";

// Leo draws an arrow from the green note to the ellipse. The cursor follows
// the same path the stroke is drawn along, so they stay in sync.
const ARROW_PATH = "M690 345 C690 392 722 426 772 432 M752 417 L772 432 L753 447";
const ARROW_DURATION = "8s";
const DRAW_KEY_TIMES = "0;0.45;1";

// Maya wanders over the board and keeps her selection on the rectangle.
const MAYA_PATH =
  "M310 300 C370 250 470 262 470 330 S370 470 300 420 S240 330 310 300";

const toolbarIcons = [MousePointer2, Type, StickyNote, Square, Circle, Pencil];

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
  <g filter="url(#demo-shadow)">
    <rect x={x} y={y} width={width} height={height} fill={fill} />
    <text
      x={x + width / 2}
      y={y + height / 2 - (lines.length - 1) * 17}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={28}
      fill={INK}
      style={{ fontFamily: handFont.style.fontFamily }}
    >
      {lines.map((line, index) => (
        <tspan key={line} x={x + width / 2} dy={index === 0 ? 0 : 34}>
          {line}
        </tspan>
      ))}
    </text>
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
    <circle cx={cx} cy={40} r={15} fill="white" stroke={color} strokeWidth={2.5} />
    <text
      x={cx}
      y={40.5}
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
        aria-label="A Board canvas with sticky notes and shapes. One teammate draws an arrow while another moves their cursor across the board."
      >
        <defs>
          <pattern
            id="demo-dots"
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={2} cy={2} r={1.2} fill="#D4D4D4" />
          </pattern>
          <filter id="demo-shadow" x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx={0} dy={2} stdDeviation={3} floodOpacity={0.15} />
          </filter>
        </defs>

        <rect width={1000} height={600} fill="#F5F5F5" />
        <rect width={1000} height={600} fill="url(#demo-dots)" />

        {/* Canvas content */}
        <text
          x={360}
          y={100}
          fontSize={38}
          fill={INK}
          style={{ fontFamily: handFont.style.fontFamily }}
        >
          Q3 planning
        </text>
        <Note
          x={340}
          y={125}
          width={200}
          height={175}
          fill={NOTE_YELLOW}
          lines={["Launch the", "landing page"]}
        />
        <Note
          x={575}
          y={175}
          width={175}
          height={155}
          fill={NOTE_GREEN}
          lines={["Guest mode", "next!"]}
        />
        <rect
          x={110}
          y={330}
          width={190}
          height={115}
          fill={SHAPE_BLUE}
          filter="url(#demo-shadow)"
        />
        <ellipse
          cx={850}
          cy={470}
          rx={95}
          ry={58}
          fill={SHAPE_ORANGE}
          filter="url(#demo-shadow)"
        />
        {/* Another user's selection is outlined in their color. */}
        <rect
          x={104}
          y={324}
          width={202}
          height={127}
          fill="none"
          stroke={MAYA}
          strokeWidth={2}
        />

        {/* Animated layer: hidden when the visitor prefers reduced motion. */}
        <g className="motion-reduce:hidden">
          <path
            d={ARROW_PATH}
            pathLength={1}
            fill="none"
            stroke={INK}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="1;0;0"
              keyTimes={DRAW_KEY_TIMES}
              dur={ARROW_DURATION}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;1;0;0"
              keyTimes="0;0.8;0.9;1"
              dur={ARROW_DURATION}
              repeatCount="indefinite"
            />
          </path>
          <g>
            <animateMotion
              path={ARROW_PATH}
              keyPoints="0;1;1"
              keyTimes={DRAW_KEY_TIMES}
              calcMode="linear"
              dur={ARROW_DURATION}
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

        {/* Still layer for reduced motion: the finished arrow and cursors. */}
        <g className="hidden motion-reduce:inline">
          <path
            d={ARROW_PATH}
            fill="none"
            stroke={INK}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g transform="translate(772 432)">
            <Cursor name="Leo" color={LEO} />
          </g>
          <g transform="translate(470 330)">
            <Cursor name="Maya" color={MAYA} />
          </g>
        </g>

        {/* Board chrome, as in the app */}
        <g filter="url(#demo-shadow)">
          <rect x={16} y={16} width={318} height={48} rx={8} fill="white" />
          <image href="/logo.svg" x={26} y={25} width={45} height={30} />
          <text
            x={78}
            y={47}
            fontSize={19}
            fontWeight={600}
            fill="black"
            style={{ fontFamily: logoFont.style.fontFamily }}
          >
            Board
          </text>
          <text x={146} y={46} fontSize={18} fill="#D4D4D4">
            |
          </text>
          <text x={162} y={45.5} fontSize={15} fill={INK}>
            Q3 planning
          </text>
          <text x={260} y={46} fontSize={18} fill="#D4D4D4">
            |
          </text>
          <Menu x={280} y={28} width={24} height={24} color={INK} />
        </g>

        <g filter="url(#demo-shadow)">
          <rect x={870} y={16} width={114} height={48} rx={8} fill="white" />
          <Avatar cx={895} initial="M" color={MAYA} />
          <Avatar cx={927} initial="L" color={LEO} />
          <Avatar cx={959} initial="Y" color={YOU} />
        </g>

        <g filter="url(#demo-shadow)">
          <rect x={16} y={150} width={48} height={280} rx={8} fill="white" />
          <rect x={22} y={156} width={36} height={36} rx={6} fill="#DBEAFE" />
          {toolbarIcons.map((Icon, index) => (
            <Icon
              key={index}
              x={28}
              y={162 + index * 44}
              width={24}
              height={24}
              color={index === 0 ? "#1E40AF" : INK}
            />
          ))}
          <rect x={16} y={446} width={48} height={92} rx={8} fill="white" />
          <Undo2 x={28} y={458} width={24} height={24} color={INK} />
          <Redo2 x={28} y={502} width={24} height={24} color="#A3A3A3" />
        </g>
      </svg>
    </div>
  );
};
