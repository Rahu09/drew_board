import { Inter, Kalam } from "next/font/google";

import type { FontFamily, TextAlign } from "@/types/canvas";

const hand = Kalam({
  subsets: ["latin"],
  weight: ["400"],
});

const sans = Inter({ subsets: ["latin"] });

const MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** The CSS font-family of text and notes. Default: hand-drawn. */
export const layerFontFamily = (family: FontFamily | undefined) =>
  family === "sans"
    ? sans.style.fontFamily
    : family === "mono"
      ? MONO
      : hand.style.fontFamily;

/** Fonts for a file exported from the board, which has no web fonts. */
export const EXPORT_FONTS: Record<FontFamily, string> = {
  hand: "Kalam, 'Comic Sans MS', cursive",
  sans: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: MONO,
};

export const layerTextAlign = (align: TextAlign | undefined): TextAlign =>
  align ?? "center";
