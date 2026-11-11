// Font sizes of text and sticky notes. Both have a fixed size that resizing
// doesn't change (the font size control does); boxes grow to fit the text.
// Layers made before sizes were stored have no fontSize: theirs follows the
// box, as it used to, until they are first resized.

/** Legacy size of a sticky note's text: grows with the note, up to 96px. */
export const noteFontSize = (width: number, height: number) =>
  Math.min(height * 0.15, width * 0.15, 96);

/** Legacy size of a text layer: grows with its box, up to 96px. */
export const textFontSize = (width: number, height: number) =>
  Math.min(height * 0.5, width * 0.5, 96);

/** Font size of new text layers. */
export const TEXT_FONT_SIZE = 30;

/** Font size of new sticky notes. */
export const NOTE_FONT_SIZE = 24;

/** Before a note grows, its text gets this much smaller. */
export const NOTE_SHRINK = 2;

interface SizedLayer {
  width: number;
  height: number;
  fontSize?: number;
}

/** A text layer's font size, whatever its age. */
export const textLayerFontSize = (layer: SizedLayer) =>
  layer.fontSize ?? textFontSize(layer.width, layer.height);

/** A sticky note's font size (before any shrinking), whatever its age. */
export const noteLayerFontSize = (layer: SizedLayer) =>
  layer.fontSize ?? noteFontSize(layer.width, layer.height);

/** Sizes the font size control steps through. */
export const FONT_SIZES = [
  12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 84, 96,
];

/** The next size up (1) or down (-1) from `size`. */
export const stepFontSize = (size: number, direction: 1 | -1) => {
  if (direction === 1) {
    return FONT_SIZES.find((s) => s > size + 0.5) ?? FONT_SIZES.at(-1)!;
  }
  return FONT_SIZES.findLast((s) => s < size - 0.5) ?? FONT_SIZES[0];
};

/**
 * How much taller (canvas units) `element` must get to show all of its
 * text at `fontSize`; 0 when it fits. Measures without changing what is
 * shown. Layout inside a foreignObject is not affected by the zoom.
 */
export const overflowAt = (element: HTMLElement, fontSize: number) => {
  const shown = element.style.fontSize;
  element.style.fontSize = `${fontSize}px`;
  const overflow = element.scrollHeight - element.clientHeight;
  element.style.fontSize = shown;

  return Math.max(0, Math.ceil(overflow));
};

/** Size of the date in a sticky note's corner. */
export const NOTE_DATE_FONT_SIZE = 11;

/** Room kept free under a note's text for the date. */
export const NOTE_DATE_SPACE = Math.ceil(NOTE_DATE_FONT_SIZE * 1.6);

/** "Nov 11", or "Nov 11, 2025" when not this year. */
export const formatNoteDate = (time: number) => {
  const date = new Date(time);
  const thisYear = date.getFullYear() === new Date().getFullYear();

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
  });
};
