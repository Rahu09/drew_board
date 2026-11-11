"use client";

import { memo, useEffect, useRef } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Code,
  Copy,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";

import { Hint } from "@/components/hints";
import {
  Color,
  Edges,
  FontFamily,
  Layer,
  LayerType,
  Roughness,
  TextAlign,
} from "@/types/canvas";
import { cn, colorToCss } from "@/lib/utils";
import { withShortcut } from "@/lib/shortcuts";
import { useBoardStore } from "@/lib/board-store/context";
import type { BoardActions } from "@/lib/board-store/types";
import type { LayerMove } from "@/lib/board-store/bounds";

import { changeFontSize, hasFontSize, layerFontSize } from "./font-size";
import { FONT_SIZES } from "./text-metrics";
import { layerFontFamily } from "./fonts";
import { noteTextColor } from "./note";
import { duplicateSelection } from "./use-canvas-shortcuts";

// Colors offered first, like Excalidraw's: dark strokes, light insides.
const STROKE_COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
const BACKGROUND_COLORS = ["#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
const NOTE_COLORS = ["#fff9b1", "#ffc9c9", "#b2f2bb", "#a5d8ff"];

const COLOR_NAMES: Record<string, string> = {
  "#1e1e1e": "Black",
  "#e03131": "Red",
  "#2f9e44": "Green",
  "#1971c2": "Blue",
  "#f08c00": "Orange",
  "#ffc9c9": "Light red",
  "#b2f2bb": "Light green",
  "#a5d8ff": "Light blue",
  "#ffec99": "Light yellow",
  "#fff9b1": "Yellow",
};

const FONT_PRESETS = [
  { label: "S", name: "Small", size: 16 },
  { label: "M", name: "Medium", size: 20 },
  { label: "L", name: "Large", size: 28 },
  { label: "XL", name: "Extra large", size: 36 },
];

const hexToColor = (hex: string): Color => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

/** "#rrggbb" for a color input (which takes no names). */
const toHex = (css: string) =>
  css === "black" ? "#000000" : css === "white" ? "#ffffff" : css;

type ShapeLayer = Extract<Layer, { type: LayerType.Rectangle | LayerType.Ellipse }>;

const isShape = (layer: Layer): layer is ShapeLayer =>
  layer.type === LayerType.Rectangle || layer.type === LayerType.Ellipse;

/** Layers whose `fill` is the color of their lines or text. */
const hasStroke = (layer: Layer) =>
  isShape(layer) ||
  layer.type === LayerType.Text ||
  layer.type === LayerType.Arrow ||
  layer.type === LayerType.Path;

const hasBackground = (layer: Layer) =>
  isShape(layer) || layer.type === LayerType.Note;

const hasEdges = (layer: Layer) =>
  layer.type === LayerType.Rectangle || layer.type === LayerType.Note;

/** The inside's color of a shape or note, or null when see-through. */
const backgroundOf = (layer: Layer): string | null => {
  if (isShape(layer)) {
    if (layer.fillStyle !== "none") return colorToCss(layer.fill);
    return layer.backgroundColor ? colorToCss(layer.backgroundColor) : null;
  }
  if (layer.type === LayerType.Note) {
    return layer.fillStyle === "none" ? null : colorToCss(layer.fill);
  }
  return null;
};

/** Changes each selected layer the patch applies to, as one undo step. */
const applyToSelection = (
  actions: BoardActions,
  patchFor: (layer: Layer) => Partial<Layer> | null,
  options: { group: boolean } = { group: true }
) => {
  const { layers } = actions.getSnapshot();

  if (options.group) actions.pauseHistory();
  for (const id of actions.getSelection()) {
    const layer = layers[id];
    const patch = layer ? patchFor(layer) : null;
    if (patch) actions.updateLayer(id, patch);
  }
  if (options.group) actions.resumeHistory();
};

interface PropertiesPanelProps {
  /** While dragging, resizing or drawing a selection net. */
  isHidden: boolean;
  setLastUsedColor: (color: Color) => void;
  /** Phones: a sheet above the bottom toolbar instead of a side panel. */
  sheet?: boolean;
}

/**
 * The style of the selection, at the left of the board (as in Excalidraw).
 * Shows only what applies to the selected layers; values are the first
 * one's, and a change applies to every selected layer it fits.
 */
export const PropertiesPanel = memo(
  ({ isHidden, setLastUsedColor, sheet }: PropertiesPanelProps) => {
    const store = useBoardStore();
    const { actions } = store;
    const layers = store.useSelectedLayers();

    if (layers.length === 0 || isHidden) {
      return null;
    }

    const apply = (patchFor: (layer: Layer) => Partial<Layer> | null) =>
      applyToSelection(actions, patchFor);

    const strokeLayer = layers.find(hasStroke);
    const note = layers.find((layer) => layer.type === LayerType.Note);
    const backgroundLayer = layers.find(hasBackground);
    const roughLayer = layers.find(
      (layer) => isShape(layer) || layer.type === LayerType.Note
    );
    const edgeLayer = layers.find(hasEdges);
    const textLayer = layers.find(hasFontSize);
    const opacity = layers[0].opacity ?? 100;

    const setStroke = (css: string) => {
      const fill = hexToColor(css);
      setLastUsedColor(fill);
      apply((layer) => {
        if (isShape(layer)) {
          // An older filled shape keeps its color inside, now with a line.
          return layer.fillStyle === "none"
            ? { fill }
            : { fill, fillStyle: "none", backgroundColor: layer.fill };
        }
        return hasStroke(layer) ? { fill } : null;
      });
    };

    const setBackground = (css: string | null) => {
      const color = css ? hexToColor(css) : null;
      apply((layer) => {
        if (isShape(layer)) {
          return { fillStyle: "none", backgroundColor: color };
        }
        if (layer.type === LayerType.Note) {
          return color ? { fill: color, fillStyle: "solid" } : { fillStyle: "none" };
        }
        return null;
      });
    };

    const strokeValue = strokeLayer ? colorToCss(strokeLayer.fill) : null;
    const backgroundValue = backgroundLayer ? backgroundOf(backgroundLayer) : null;
    const roughness: Roughness | null =
      roughLayer && "roughness" in roughLayer
        ? (roughLayer.roughness ?? 0)
        : roughLayer
          ? 0
          : null;
    const edges: Edges | null = edgeLayer
      ? ("edges" in edgeLayer && edgeLayer.edges) || "sharp"
      : null;
    const fontFamily: FontFamily = hasFontSize(textLayer)
      ? (textLayer.fontFamily ?? "hand")
      : "hand";
    const textAlign: TextAlign = hasFontSize(textLayer)
      ? (textLayer.textAlign ?? "center")
      : "center";
    const fontSize = hasFontSize(textLayer)
      ? Math.round(layerFontSize(textLayer))
      : null;

    return (
      <div
        className={
          sheet
            ? "fixed left-2 right-2 bottom-[112px] z-20 max-h-[45vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-lg grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 select-none"
            : "absolute left-2 top-[60px] z-10 w-[212px] max-h-[calc(100%-8rem)] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 shadow-md flex flex-col gap-y-3 select-none"
        }
        aria-label="Style of the selection"
        role="region"
      >
        {strokeLayer && (
          <Section title="Stroke">
            <ColorRow
              colors={STROKE_COLORS}
              value={strokeValue}
              onPick={setStroke}
              label="Stroke"
            />
          </Section>
        )}

        {note && (
          <Section title="Text color">
            <ColorRow
              colors={STROKE_COLORS}
              value={note.type === LayerType.Note ? toHex(noteTextColor(note)) : null}
              onPick={(css) =>
                apply((layer) =>
                  layer.type === LayerType.Note
                    ? { textColor: hexToColor(css) }
                    : null
                )
              }
              label="Text color"
            />
          </Section>
        )}

        {backgroundLayer && (
          <Section title="Background">
            <Swatch
              color={null}
              label="Transparent"
              active={backgroundValue === null}
              onClick={() => setBackground(null)}
            />
            <ColorRow
              colors={
                backgroundLayer.type === LayerType.Note
                  ? NOTE_COLORS
                  : BACKGROUND_COLORS
              }
              value={backgroundValue}
              onPick={setBackground}
              label="Background"
            />
          </Section>
        )}

        {roughness !== null && (
          <Section title="Sloppiness">
            {(
              [
                [0, "Architect"],
                [1, "Artist"],
                [2, "Cartoonist"],
              ] as const
            ).map(([level, name]) => (
              <Choice
                key={level}
                label={name}
                active={roughness === level}
                onClick={() =>
                  apply((layer) =>
                    isShape(layer) || layer.type === LayerType.Note
                      ? { roughness: level }
                      : null
                  )
                }
              >
                <SloppinessIcon level={level} />
              </Choice>
            ))}
          </Section>
        )}

        {edges !== null && (
          <Section title="Edges">
            {(["sharp", "round"] as const).map((value) => (
              <Choice
                key={value}
                label={value === "sharp" ? "Sharp" : "Round"}
                active={edges === value}
                onClick={() =>
                  apply((layer) => (hasEdges(layer) ? { edges: value } : null))
                }
              >
                <EdgesIcon edges={value} />
              </Choice>
            ))}
          </Section>
        )}

        {fontSize !== null && (
          <>
            <Section title="Font family">
              {(
                [
                  ["hand", "Hand-drawn"],
                  ["sans", "Normal"],
                  ["mono", "Code"],
                ] as const
              ).map(([family, name]) => (
                <Choice
                  key={family}
                  label={name}
                  active={fontFamily === family}
                  onClick={() =>
                    apply((layer) =>
                      hasFontSize(layer) ? { fontFamily: family } : null
                    )
                  }
                >
                  {family === "mono" ? (
                    <Code className="h-4 w-4" />
                  ) : (
                    <span
                      className="text-base leading-none"
                      style={{ fontFamily: layerFontFamily(family) }}
                    >
                      A
                    </span>
                  )}
                </Choice>
              ))}
            </Section>

            <Section title="Font size">
              {FONT_PRESETS.map((preset) => (
                <Choice
                  key={preset.label}
                  label={`${preset.name} (${preset.size})`}
                  active={fontSize === preset.size}
                  onClick={() =>
                    apply((layer) =>
                      hasFontSize(layer) ? { fontSize: preset.size } : null
                    )
                  }
                >
                  <span className="text-xs font-semibold">{preset.label}</span>
                </Choice>
              ))}
              <div className="mt-1 flex w-full items-center gap-1">
                <Choice
                  label={withShortcut("Smaller text", "Mod+Shift+<")}
                  disabled={fontSize <= FONT_SIZES[0]}
                  onClick={() => changeFontSize(actions, -1)}
                >
                  <Minus className="h-4 w-4" />
                </Choice>
                <span
                  className="w-10 text-center text-sm tabular-nums text-neutral-700"
                  aria-label={`Text size ${fontSize}`}
                >
                  {fontSize}
                </span>
                <Choice
                  label={withShortcut("Larger text", "Mod+Shift+>")}
                  disabled={fontSize >= FONT_SIZES.at(-1)!}
                  onClick={() => changeFontSize(actions, 1)}
                >
                  <Plus className="h-4 w-4" />
                </Choice>
              </div>
            </Section>

            <Section title="Text align">
              {(
                [
                  ["left", "Left", AlignLeft],
                  ["center", "Center", AlignCenter],
                  ["right", "Right", AlignRight],
                ] as const
              ).map(([align, name, Icon]) => (
                <Choice
                  key={align}
                  label={name}
                  active={textAlign === align}
                  onClick={() =>
                    apply((layer) =>
                      hasFontSize(layer) ? { textAlign: align } : null
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                </Choice>
              ))}
            </Section>
          </>
        )}

        <Section title="Opacity">
          <OpacitySlider value={opacity} actions={actions} />
        </Section>

        <Section title="Layers">
          {(
            [
              ["back", "Send to back", "Mod+Shift+[", ArrowDownToLine],
              ["backward", "Send backward", "Mod+[", ArrowDown],
              ["forward", "Bring forward", "Mod+]", ArrowUp],
              ["front", "Bring to front", "Mod+Shift+]", ArrowUpToLine],
            ] as const
          ).map(([move, name, shortcut, Icon]) => (
            <Choice
              key={move}
              label={withShortcut(name, shortcut)}
              onClick={() =>
                actions.moveLayers(actions.getSelection(), move as LayerMove)
              }
            >
              <Icon className="h-4 w-4" />
            </Choice>
          ))}
        </Section>

        <Section title="Actions">
          <Choice
            label={withShortcut("Duplicate", "Mod+D")}
            onClick={() => duplicateSelection(actions)}
          >
            <Copy className="h-4 w-4" />
          </Choice>
          <Choice
            label={withShortcut("Delete", "Del")}
            onClick={() => actions.deleteLayers(actions.getSelection())}
          >
            <Trash2 className="h-4 w-4" />
          </Choice>
        </Section>
      </div>
    );
  }
);

PropertiesPanel.displayName = "PropertiesPanel";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div role="group" aria-label={title}>
    <p className="mb-1.5 text-xs text-neutral-500">{title}</p>
    <div className="flex flex-wrap items-center gap-1">{children}</div>
  </div>
);

interface ChoiceProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Choice = ({ label, active, disabled, onClick, children }: ChoiceProps) => (
  <Hint label={label} side="bottom">
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8 rounded-md flex items-center justify-center text-neutral-700 transition disabled:opacity-40",
        active
          ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-400"
          : "bg-neutral-100 hover:bg-neutral-200"
      )}
    >
      {children}
    </button>
  </Hint>
);

interface SwatchProps {
  /** CSS color, or null for see-through. */
  color: string | null;
  label: string;
  active: boolean;
  onClick: () => void;
}

const Swatch = ({ color, label, active, onClick }: SwatchProps) => (
  <Hint label={label} side="bottom">
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-6 w-6 rounded-md p-0.5 transition",
        active ? "ring-2 ring-indigo-500" : "hover:ring-1 hover:ring-neutral-300"
      )}
    >
      <span
        className="block h-full w-full rounded-[4px] border border-black/10"
        style={
          color
            ? { background: color }
            : {
                // A checkerboard: nothing inside.
                backgroundImage:
                  "conic-gradient(#d4d4d4 25%, #fff 0 50%, #d4d4d4 0 75%, #fff 0)",
                backgroundSize: "8px 8px",
              }
        }
      />
    </button>
  </Hint>
);

interface ColorRowProps {
  colors: readonly string[];
  /** The current color ("#rrggbb"), or null. */
  value: string | null;
  onPick: (css: string) => void;
  label: string;
}

/** Preset colors, then the current one, which opens a picker for any color. */
const ColorRow = ({ colors, value, onPick, label }: ColorRowProps) => {
  const current = value?.toLowerCase() ?? null;
  const isPreset = current !== null && colors.includes(current);

  return (
    <>
      {colors.map((color) => (
        <Swatch
          key={color}
          color={color}
          label={COLOR_NAMES[color] ?? color}
          active={current === color}
          onClick={() => onPick(color)}
        />
      ))}
      <span className="mx-0.5 h-5 w-px bg-neutral-200" aria-hidden />
      <CustomColor
        value={current}
        active={current !== null && !isPreset}
        onPick={onPick}
        label={`${label}: any color`}
      />
    </>
  );
};

interface CustomColorProps {
  value: string | null;
  active: boolean;
  onPick: (css: string) => void;
  label: string;
}

/**
 * A swatch of the current color over a color input. The color is applied
 * when the picker closes (the input's change event), so picking is one
 * undo step, not one per move of the mouse.
 */
const CustomColor = ({ value, active, onPick, label }: CustomColorProps) => {
  const ref = useRef<HTMLInputElement>(null);
  const pick = useRef(onPick);

  useEffect(() => {
    pick.current = onPick;
  });

  useEffect(() => {
    const input = ref.current;
    if (!input) return;

    const onChange = () => pick.current(input.value);
    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, []);

  return (
    <Hint label={label} side="bottom">
      <label
        className={cn(
          "relative h-6 w-6 cursor-pointer rounded-md p-0.5 transition",
          active ? "ring-2 ring-indigo-500" : "hover:ring-1 hover:ring-neutral-300"
        )}
      >
        <span
          className="block h-full w-full rounded-[4px] border border-black/10"
          style={{
            background:
              value ??
              "conic-gradient(#d4d4d4 25%, #fff 0 50%, #d4d4d4 0 75%, #fff 0) 0 0 / 8px 8px",
          }}
        />
        <input
          ref={ref}
          key={value ?? "none"}
          type="color"
          defaultValue={value ?? "#000000"}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </Hint>
  );
};

/** 0–100 in steps of 10. A drag is one undo step. */
const OpacitySlider = ({
  value,
  actions,
}: {
  value: number;
  actions: BoardActions;
}) => {
  const dragging = useRef(false);

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    actions.resumeHistory();
  };

  return (
    <div className="flex w-full items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={10}
        value={value}
        aria-label="Opacity"
        className="flex-1 accent-indigo-500"
        onPointerDown={() => {
          if (dragging.current) return;
          dragging.current = true;
          actions.pauseHistory();
          window.addEventListener("pointerup", endDrag, { once: true });
        }}
        onChange={(e) => {
          const opacity = Number(e.currentTarget.value);
          applyToSelection(actions, () => ({ opacity }), {
            group: !dragging.current,
          });
        }}
      />
      <span className="w-8 text-right text-xs tabular-nums text-neutral-600">
        {value}
      </span>
    </div>
  );
};

/** A line drawn cleaner or sloppier, like the shapes. */
const SloppinessIcon = ({ level }: { level: Roughness }) => (
  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {level === 0 && <path d="M3 15 Q 10 3 17 6" />}
    {level === 1 && <path d="M3 15 Q 6 8 9 10 T 17 5" />}
    {level === 2 && <path d="M3 15 Q 4.5 9 6.5 12 T 10 9 T 13.5 9 T 17 5" />}
  </svg>
);

const EdgesIcon = ({ edges }: { edges: Edges }) => (
  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {edges === "sharp" ? (
      <path d="M5 16 V5 H16" />
    ) : (
      <path d="M5 16 V10 Q5 5 10 5 H16" />
    )}
  </svg>
);
