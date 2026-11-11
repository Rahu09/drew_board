"use client";

import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

// Values saved before layers stored plain text are HTML from the old
// contentEditable: line breaks as <div>/<br>, entities such as &nbsp; and
// &lt;, and markup from pasted content. That editor escaped every typed
// "<" and "&", so a value with a bare one is plain text.
const MARKUP = /<\/?[a-z][^>]*>|&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;
const BARE_CHARACTER = /<(?![a-z/!])|&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/i;

const isLegacyHtml = (value: string) =>
  MARKUP.test(value) && !BARE_CHARACTER.test(value);

/**
 * The text of a stored layer value. Old HTML values are turned into plain
 * text with an inert DOMParser document, which never runs scripts or loads
 * resources. Either way the result is only ever written with textContent.
 */
export const layerText = (value: string | undefined) => {
  if (!value) return "";
  if (!isLegacyHtml(value) || typeof DOMParser === "undefined") {
    return value;
  }

  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?:div|p)(?:\s[^>]*)?>/gi, "\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  doc.body.querySelectorAll("script, style").forEach((node) => node.remove());

  return (doc.body.textContent ?? "").replace(/^\n/, "");
};

interface PlainTextEditableProps {
  /** The stored layer value. */
  value: string | undefined;
  /** Shown when the layer has no text yet. */
  fallback: string;
  /** Shows the text without letting anyone edit it. */
  readOnly?: boolean;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * An editable block of plain text. Text is written to the page with
 * textContent and read back with innerText, so a value can never add
 * markup, and pasted content loses its formatting ("plaintext-only").
 */
export const PlainTextEditable = ({
  value,
  fallback,
  readOnly = false,
  onChange,
  className,
  style,
}: PlainTextEditableProps) => {
  const ref = useRef<HTMLDivElement>(null);
  // The last text typed here. When the store hands it back, it is shown as
  // typed, without the old-HTML conversion, so typing "<b" stays "<b".
  const typed = useRef<string | null>(null);

  // Write only when the page shows something else (an undo, another user's
  // edit), so typing doesn't move the caret.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const text =
      value !== undefined && value === typed.current
        ? value
        : layerText(value) || fallback;

    if (element.innerText !== text) {
      element.textContent = text;
    }
  }, [value, fallback]);

  return (
    <div
      ref={ref}
      contentEditable={readOnly ? false : "plaintext-only"}
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => {
        const text = e.currentTarget.innerText;
        typed.current = text;
        onChange(text);
      }}
      className={cn(
        "h-full w-full flex flex-col justify-center-safe text-center whitespace-pre-wrap break-words outline-hidden",
        className
      )}
      style={style}
    />
  );
};
