"use client";

import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches now (false while rendering on the server). */
export const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );

/** Phone width: the board uses its compact, bottom-heavy layout. */
export const PHONE_QUERY = "(max-width: 639px)";
