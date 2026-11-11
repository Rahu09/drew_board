# 5. The canvas

Everything lives in `components/canvas/`. The canvas is used on three pages with different stores:

| Page | Store | Live? | Images/comments |
| --- | --- | --- | --- |
| `/board/[id]` | Liveblocks (`lib/board-store/liveblocks-store.tsx`) | yes | yes |
| `/try` | Local, saved to localStorage (`local-store.tsx`) | no | no |
| `/view/[token]` | Local, seeded from the saved board, never saved | no | read-only |

## The store layer (`lib/board-store/`)

The canvas never calls Liveblocks directly. It talks to a `BoardStore` (`types.ts`):

- **Reactive reads are hooks**: `useLayerIds`, `useLayer(id)`, `useSelection`, `useSelectedLayers`, `useSelectionBounds`, `usePencilDraft`, `useBackground`, `useRemoteSelections`, `useOtherView`, `useLayerCount`, `useCanUndo/Redo`. Each store implements them its own way (Liveblocks hooks, or zustand).
- **Writes are `actions`** (`BoardActions`): `insertLayer` (returns null at the 100-layer limit), `updateLayer`, `translateLayers`, `setLayersFill`, `deleteLayers`, `moveLayers`, `setBackground`, `replaceContent`, `setSelection`, `getSelection`, `getSnapshot`, `setCursor`, `setPencilDraft`, `setView`, `setLaser`, `undo`, `redo`, `pauseHistory`/`resumeHistory` (group a drag into one undo step).
- `context.tsx` provides the store; `validate.ts` (`parseSnapshot`) validates untrusted snapshots (guest data, `.board` files, server upload); `bounds.ts` has layer ordering moves.

Why: Phase 3 needed the same canvas for guests without Liveblocks (no monthly-active-user cost, no abuse of anonymous rooms). Building the abstraction before adding more canvas features kept both versions identical.

## Canvas state machine

`canvas.tsx` (≈2000 lines) holds a `CanvasState` whose `mode` is a `CanvasMode` (`types/canvas.ts`):

| Mode | Meaning |
| --- | --- |
| `None` | Idle, select tool |
| `Pressing` | Pointer down on empty canvas (may become a selection net) |
| `SelectionNet` | Dragging a selection rectangle. The layers are read from the store **once, when the net starts** (`netLayers` ref), not on every pointer move (`getSnapshot()` copies the whole board), and the selection is only set when the set of layers inside the net changes |
| `Translating` | Moving selected layers |
| `Resizing` | Dragging a selection handle |
| `Inserting` | A shape tool is picked, waiting for a press |
| `Creating` | Dragging out a new shape (it appears only once the pointer moves; a plain click places the default size) |
| `MovingEndpoint` | Dragging an arrow end |
| `Pencil` | Drawing with the pen (perfect-freehand) |
| `Comment` | Comment tool |
| `Panning` | Middle-mouse / hand drag |
| `Hand` | Hand tool (drag pans) |
| `Eraser` | Drag over layers to delete them (one undo restores) |
| `Laser` | Laser pointer trail, shared via presence |

After creating a shape the tool returns to Select. New layers go **on top**.

## Camera and zoom

- `camera.ts`: `Camera { x, y, scale }`, scale clamped to **0.1–4** (10%–400%). `camera-context.tsx` shares it.
- Ctrl/⌘+wheel or trackpad pinch zooms around the pointer (page zoom is prevented); plain wheel pans; middle-mouse drag pans.
- Touch: two-finger pinch zooms and pans. Whatever the first finger had started is dropped.
- Zoom bar (bottom left, desktop): −, level (click = 100%), +, then undo/redo. Shift+1 fits all content (max 100%). Selection handles and remote cursors keep a constant screen size.
- Follow: clicking a collaborator's avatar follows their `view` presence (`follow.ts`).

## Layers and rendering

The canvas is one `<svg>`. `layer-preview.tsx` picks a component per layer type:

- `rectangle.tsx`, `ellipse.tsx`: drawn with **rough.js** (`rough-shape.ts`, `shape.tsx`, `shape-style.ts`). Sloppiness 0 architect / 1 artist / 2 cartoonist; the rough seed is derived from the layer id so the wobble is identical on every redraw and for every viewer. Outline shapes (`fillStyle: "none"`) are only clickable on the outline, so you can click through to what's underneath.
- `path.tsx`: pen strokes with perfect-freehand.
- `arrow.tsx`: straight arrows with draggable end handles; Shift snaps to 45°.
- `image-layer.tsx`: SVG `<image>`.
- `text.tsx`, `note.tsx`: HTML in a `<foreignObject>` with an editable `plain-text-editable.tsx`.

### Text and sticky notes

- **Plain text only** (`plain-text-editable.tsx`): uses `contenteditable="plaintext-only"` where supported, and falls back to `"true"` + a plain-text paste handler on browsers that don't support it (older iOS). The value is written as text, never HTML; it only rewrites the DOM when the value changed elsewhere (undo, another user), so the caret doesn't jump.
- **Fixed font size**: text defaults to 30px, notes to 24px; resizing the box doesn't change it (`fontSize` field). Older layers without `fontSize` scale with their box until first resized. Sizes step 12, 14, 16, 18, 20, 24, 28, 32 … 96 (`font-size.ts`), via the panel or Mod+Shift+> / <.
- **Auto-grow**: the box grows so every line stays visible (`text-metrics.ts`); typing and growth are one undo step.
- **Notes**: start yellow, show the creation date (`createdAt`) in the bottom-right corner in a **separate fixed strip** so text can never cover it. When text overflows, the note first shows it 2px smaller, then grows taller.
- **iPhone / WebKit rule**: HTML inside `<foreignObject>` must stay plain. WebKit (Safari and every iOS browser) draws foreignObject content that has a CSS filter, shadow, opacity, `position` or transform in the wrong place and ignores the zoom. So:
  - the note's paper, border, rounded corners and shadow are an SVG `<rect>` **behind** the foreignObject,
  - the date is faded with `color-mix(...)`, not `opacity`,
  - remote selection outlines are SVG `<rect>`s, not CSS outlines,
  - text has no drop shadow.
  Keep it that way when changing `text.tsx` / `note.tsx`.

## UI around the canvas (Excalidraw-style)

| Piece | File | Notes |
| --- | --- | --- |
| Toolbar | `toolbar.tsx`, `tool-button.tsx` | Desktop: compact row top-center, logo first, shortcut letter in each button's corner, "More tools" dropdown (hand H, eraser E, laser K); a picked extra tool shows in the bar until another tool is chosen. Phone: full-width bottom bar |
| Main menu | `main-menu.tsx` | Top-left with the board name: Open / Save to (`.board`), Export image, Live collaboration, Command palette, Find on canvas, Help, Reset the canvas, theme, canvas background, board actions (copy link, read-only link, share with a team, rename, delete). Phone: "Go to boards" row |
| Style panel | `properties-panel.tsx` | Left panel when something is selected; only the sections that apply: stroke/text color, background, sloppiness, edges, font family, font size, align, opacity, layers (order), actions (duplicate/delete). Last swatch opens a color picker. Phone: a sheet above the toolbar, opened with a palette button |
| Sidebar | `sidebar.tsx` | Search text (Mod+F, Enter / Shift+Enter, dashed outline on results), Library (`library.ts`, localStorage), Comments (live boards). Pin to keep open |
| Zoom / undo | `zoom-controls.tsx` | Desktop zoom pills + undo/redo bottom-left; `LayerCount` from 90 layers; `PhoneActions` on phones |
| Participants | `participants.tsx`, `cursors-presence.tsx`, `cursor.tsx` | Other users' avatars (click to follow), cursors, live pen drafts |
| Laser | `laser.tsx` | Fading trail; others see it in your color |
| Export | `export-dialog.tsx`, `export.ts` | Preview, background on/off, only-selected, PNG (2×), SVG, copy to clipboard. Text uses system fonts in exports. `boardToThumbnail` reuses this for dashboard thumbnails |
| Command palette | `command-palette.tsx` | Mod+/ searches every tool and action |
| Help | `help-dialog.tsx` | `?` lists shortcuts |
| Theme | `theme.ts` | Dark = `html.board-dark { filter: invert(93%) hue-rotate(180deg) }` (images re-inverted). Uses next-themes, so the dashboard and the board share one choice |
| Shortcuts | `use-canvas-shortcuts.ts`, `lib/shortcuts.ts` | Off while typing in text or a field |
| Limit | `layer-limit.ts` | 100 layers: adding past it shows "This board is full…"; duplicate/paste are all-or-nothing |
| Comments | `comments-slot.ts` + `app/(app)/board/[boardId]/_components/board-comments.tsx` | Pins rendered on live boards only |

### Shortcuts

| Keys | Action |
| --- | --- |
| V, T, N, R, O, A, P | Select, text, note, rectangle, ellipse, arrow, pen |
| H, E, K | Hand, eraser, laser |
| I / C | Image / comment (saved boards) |
| Delete / Backspace | Delete selection |
| Mod+A, Mod+D | Select all, duplicate |
| Mod+C / X / V | Copy, cut, paste (also between boards in the same tab; pasting an image adds it) |
| Mod+] / Mod+[ | Forward / backward one step; add Shift for front / back |
| Mod+Shift+> / < | Bigger / smaller text |
| Mod+Z, Mod+Shift+Z / Mod+Y | Undo, redo |
| Mod+= / - / 0, Shift+1 | Zoom in, out, 100%, fit |
| Mod+F, Mod+/, ? | Find, command palette, help |
| Escape | Leave text, then the tool, then the selection |

## Touch and phone

**Phone layout** (`useMediaQuery("(max-width: 639px)")`, `hooks/use-media-query.ts`), modelled on Excalidraw's phone UI:
- Top: gray menu button left, gray sidebar button right. Board name and Share are hidden (Live collaboration is in the menu).
- Bottom: full-width toolbar: hand, select, pen, eraser, rectangle, arrow, text, image, note, ⋮ (ellipse, comment, laser). Buttons shrink so the row never overflows.
- Above it: style (palette) button on the left when something is selected; undo, redo, duplicate, delete on the right. No zoom buttons (pinch).

**Touch handling in `canvas.tsx`:**
- The `touches` map tracks fingers to tell pinch from one-finger actions. It is **cleared whenever a primary pointer goes down** (`e.isPrimary`), because a missed finger-lift used to leave a "ghost" finger and every later touch was treated as a pinch (canvas stopped working until reload).
- `onPointerCancel`: when the browser takes a touch over (long press), drop what it was doing but keep the tool.
- **Drag inside the selection bounds moves it** (mouse too), so you don't need to hit a thin outline.
- `layerNear(x, y, 14)`: a finger picks up a layer up to 14px away.
- `TAP_SLOP = 8`: a layer moves only after the finger moved 8px, so taps don't nudge it.
- Tap on a text/note: `editLayerTextAt` puts the caret where tapped (`caretPositionFromPoint` / `caretRangeFromPoint`).
- New text/note by touch: `openKeyboard()` focuses a hidden 16px input during the tap (iOS only opens the keyboard for a focus inside the user gesture), then focus moves to the new layer.
- Selection handles are 16px on touch screens (8px with a mouse).
- `hooks/use-disable-scroll-bounce.ts` stops the page from scrolling or bouncing while a board is open (`overflow-hidden overscroll-none` on `<html>` and `<body>`), and scrolls the page back to the top if mobile Safari moved it for the keyboard and left it there.
- **The canvas `<svg>` is `block h-full w-full` inside `<main class="h-full overflow-hidden">`, never `h-screen`/`100vh`.** On iPhones `100vh` is taller than the visible page, so the page could scroll and the top buttons (menu, sidebar) slid half under the status bar (seen on an iPhone 15 Plus in Safari).
