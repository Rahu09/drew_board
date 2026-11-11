"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/** The color theme, as chosen in the menu (shared with the dashboard). */
export type BoardTheme = "light" | "dark" | "system";

const DARK_CLASS = "board-dark";

/**
 * The chosen theme (light/dark/system), whether the board is dark now, and
 * how to change it. The page itself is kept light on boards (see
 * providers/theme-provider.tsx), so this reads the choice, not the page.
 */
export const useBoardTheme = () => {
  const { theme, systemTheme, setTheme } = useTheme();
  const chosen: BoardTheme =
    theme === "dark" || theme === "system" ? theme : "light";

  return {
    theme: chosen,
    isDark:
      chosen === "dark" || (chosen === "system" && systemTheme === "dark"),
    setTheme: setTheme as (theme: BoardTheme) => void,
  };
};

/**
 * Darkens the page while a board is open. Like Excalidraw, the dark theme
 * inverts the page's colors (with a hue turn so colors keep their hue),
 * and turns photos back (see globals.css).
 */
export const useApplyBoardTheme = (isDark: boolean) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(DARK_CLASS, isDark);
    return () => root.classList.remove(DARK_CLASS);
  }, [isDark]);
};
