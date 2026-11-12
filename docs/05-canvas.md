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
| `Bucket` | Click a shape, sticky note or table cell to fill it with the color chosen in the `BucketPalette` (`bucket.ts` finds the topmost fillable layer under the click with real geometry, so an empty rectangle can be filled by clicking inside it) |
| `Lasso` | Draw a loop; on release every layer with a sample point (center, corners, edge middles) inside it is selected and the tool returns to Select (`hit-test.ts`) |

After creating a shape the tool returns to Select. New layers go **on top**.

## Camera and zoom

- `camera.ts`: `Camera { x, y, scale }`, scale clamped to **0.1–4** (10%–400%). `camera-context.tsx` shares it.
- Ctrl/⌘+wheel or trackpad pinch zooms around the pointer (page zoom is prevented); plain wheel pans; middle-mouse drag pans.
- Touch: two-finger pinch zooms and pans. Whatever the first finger had started is dropped.
- Zoom bar (bottom left, desktop): −, level (click = 100%), +, then undo/redo. Shift+1 fits all content (max 100%). Selection handles and remote cursors keep a constant screen size.
- Follow: clicking a collaborator's avatar follows their `view` presence (`follow.ts`).

## Layers and rendering

The canvas is one `<svg>`. `layer-preview.tsx` picks a component per layer type:

- `rectangle.tsx`, `ellipse.tsx`, `diamond.tsx`: drawn with **rough.js** (`rough-shape.ts`, `shape.tsx`, `shape-style.ts`). Sloppiness 0 architect / 1 artist / 2 cartoonist; the rough seed is derived from the layer id so the wobble is identical on every redraw and for every viewer. Outline shapes (`fillStyle: "none"`) are only clickable on the outline, so you can click through to what's underneath.
- `path.tsx`: pen strokes with perfect-freehand.
- `arrow.tsx`: straight arrows **and lines** (`LayerType.Line`, an arrow without the head) with draggable end handles; Shift snaps to 45°. Hand-drawn like the shapes (`linearPaths` in `rough-shape.ts`, optional `roughness`).
- `frame.tsx`: a named area (round outline, name above, double-click the name to rename). The inside lets clicks through; moving a frame moves every layer fully inside it (`withFrameContents` in `hit-test.ts`, worked out once per drag into `translateIds`).
- `embed.tsx` + `embed-url.ts`: a web page in an `<iframe>` inside a `<foreignObject>`. Only https; YouTube, Vimeo, Spotify, Loom and Figma links are turned into their embed address, anything else is used as is. `sandbox` limits the page, `referrerPolicy="strict-origin-when-cross-origin"` (YouTube refuses a frame with no referrer: Error 153). While merely selected, a transparent rectangle keeps it movable; double-click or "Interact" hands the mouse to the page. **Safari and every iPhone browser** (`isWebKit()`) get a link card instead of the iframe, because WebKit draws frames inside the transformed SVG wrongly. Dark theme turns iframes back like images. Export draws a placeholder with the host name.
- `table/`: the spreadsheet (see "Tables" below).
- `image-layer.tsx`: SVG `<image>`.
- `text.tsx`, `note.tsx`: HTML in a `<foreignObject>` with an editable `plain-text-editable.tsx`.

### Defaults of new layers

Everything drawn is hand-drawn (**sloppiness 1, "artist"**) with **round corners** where corners exist: rectangle, diamond, note, arrow, line (`createShapeLayer` in `lib/canvas-geometry.ts`). Ellipses are round anyway. Tables and frames stay clean on purpose (a wobbly grid is unreadable; frames are structure). Layers saved earlier keep their old look because the fields are optional.

### Tables

A `LayerType.Table` layer (`types/canvas.ts`, code in `components/canvas/table/`) is a grid with Excel-like features:

| Feature | Where |
| --- | --- |
| Cells with text or **formulas** (`=SUM(A1:B3)`, `=IF(B2>5,"big","small")`): A1 references and ranges, `+ - * / ^ & %`, comparisons, about 30 functions (SUM AVERAGE MIN MAX COUNT COUNTA COUNTBLANK PRODUCT MEDIAN ABS SQRT INT ROUND ROUNDUP ROUNDDOWN POWER MOD PI IF IFERROR AND OR NOT CONCAT LEN UPPER LOWER TRIM LEFT RIGHT SUMIF COUNTIF), errors `#DIV/0! #REF! #NAME? #VALUE! #CIRC! #ERROR!`. A small parser, never `eval` | `formula.ts` |
| Number formats (auto, 1.00, 1,000, $, %), bold, italic, alignment, text color, cell fill, header row | `format.ts`, `table-panel.tsx` |
| Select cells (click, drag, Shift+click, column or row header, Ctrl+A); arrows, Tab, Enter, F2, typing, Delete, Escape; Ctrl+B / I / Z | `table-layer.tsx` |
| Copy, cut, paste as tab-separated text (works with Excel and Google Sheets; a pasted grid grows the table; one value pasted into a block fills the block) | `table-layer.tsx`, `model.ts` |
| Insert and delete rows and columns (formula references move with them), drag column and row borders to resize, sort by a column, fill down and right, clear, download CSV | `model.ts`, `table-panel.tsx` |
| Up to 52 columns, 200 rows, 5,000 filled cells | `model.ts`, `lib/board-store/validate.ts` |

How it works: the grid is drawn as SVG (so export is easy and nothing hits the WebKit foreignObject bug); one invisible `<textarea>` over the selected cell takes the keyboard. While not editing it holds the tab-separated text of the selection, selected, so the browser's own copy and cut work. Text that arrives without a key press (phone keyboards, input methods) starts an edit too. Clicking a table first selects it (move, delete, duplicate as any layer); once it is the only selected layer clicks select cells, and the corner square above the row numbers moves it. The pointer release after a cell click is swallowed (`trackPointer`), or the canvas would read it as a click on empty space and deselect the table. Cell selection lives in `selection.ts` (zustand) so the style panel can work on it.

Data: `cols` and `rows` are the column widths and row heights (`width` and `height` are their sums), `cells` is `{ "row,col": { v, b, i, a, c, g, n } }` with only filled cells. Saved whole in the layer, so **two people editing different cells of one table at the same moment can overwrite each other** (last write wins for the whole table). Sorting does not rewrite formulas that point at other rows. No merged cells, charts, freeze panes or wrapped text yet.

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
| V, T, N, R, D, O, A, L, P | Select, text, note, rectangle, diamond, ellipse, arrow, line, pen |
| G, F, B | Table, frame, bucket fill (web embed and lasso are in the "More tools" menu, no key) |
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
