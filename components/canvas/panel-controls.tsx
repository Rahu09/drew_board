"use client";

import { useEffect, useRef } from "react";

import { Hint } from "@/components/hints";
import { cn } from "@/lib/utils";

// The small building blocks of the style panel (sections, buttons, color
// swatches), shared by the shape panel and the table panel.

export const COLOR_NAMES: Record<string, string> = {
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

export const Section = ({
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

export const Choice = ({ label, active, disabled, onClick, children }: ChoiceProps) => (
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

export const Swatch = ({ color, label, active, onClick }: SwatchProps) => (
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
export const ColorRow = ({ colors, value, onPick, label }: ColorRowProps) => {
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
export const CustomColor = ({ value, active, onPick, label }: CustomColorProps) => {
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
