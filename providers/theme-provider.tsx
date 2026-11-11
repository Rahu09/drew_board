"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Where the canvas draws its own dark theme (see components/canvas/theme.ts). */
const BOARD_ROUTES = ["/board", "/try", "/view"];

/**
 * Light, dark or the system's, for the app routes. One choice for the
 * whole app, saved in this browser. Board pages keep the page itself
 * light: the canvas darkens them its own way (an inverting filter), which
 * a dark page underneath would undo.
 */
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const onBoard = BOARD_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  return (
    <NextThemesProvider
      attribute="class"
      storageKey="board:theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      forcedTheme={onBoard ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
};
