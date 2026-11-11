import { useEffect } from "react";

const LOCK = ["overflow-hidden", "overscroll-none"];

/**
 * Keeps the page itself from scrolling or bouncing while a board is open:
 * the canvas pans by itself. Mobile Safari can still scroll a page for the
 * keyboard and leave it there, hiding the top buttons, so the page is put
 * back whenever it moved while nothing is being typed.
 */
export const useDisableScrollBounce = () => {
  useEffect(() => {
    const targets = [document.documentElement, document.body];
    targets.forEach((el) => el.classList.add(...LOCK));

    const isTyping = () => {
      const active = document.activeElement;
      return (
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA")
      );
    };

    const reset = () => {
      if ((window.scrollX || window.scrollY) && !isTyping()) {
        window.scrollTo(0, 0);
      }
    };
    // After the keyboard closes, focus has not moved on yet.
    const resetSoon = () => window.setTimeout(reset, 100);

    window.addEventListener("scroll", reset, { passive: true });
    window.addEventListener("focusout", resetSoon);
    window.addEventListener("orientationchange", resetSoon);

    return () => {
      targets.forEach((el) => el.classList.remove(...LOCK));
      window.removeEventListener("scroll", reset);
      window.removeEventListener("focusout", resetSoon);
      window.removeEventListener("orientationchange", resetSoon);
    };
  }, []);
};
