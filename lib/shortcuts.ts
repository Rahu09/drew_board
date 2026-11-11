/** True on Apple platforms, where shortcuts use ⌘ instead of Ctrl. */
export const isApplePlatform = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * A shortcut for display, written with "Mod" for Ctrl (⌘ on Apple):
 * "Mod+Shift+Z" is "Ctrl+Shift+Z", or "⌘⇧Z" on a Mac.
 */
export const shortcutLabel = (shortcut: string) => {
  if (!isApplePlatform()) {
    return shortcut.replace("Mod", "Ctrl");
  }

  const symbols: Record<string, string> = {
    Mod: "⌘",
    Shift: "⇧",
    Alt: "⌥",
  };

  return shortcut
    .split("+")
    .map((key) => symbols[key] ?? key)
    .join("");
};

/** "Rectangle" with shortcut "R" becomes "Rectangle (R)". */
export const withShortcut = (label: string, shortcut?: string) =>
  shortcut ? `${label} (${shortcutLabel(shortcut)})` : label;
