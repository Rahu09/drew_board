# 1. Overview

## What it is

**Board** is a real-time collaborative whiteboard, in the spirit of Excalidraw and Miro. People sign in, pick a workspace (their personal space or a team), and create boards. On a board they draw together:

- rectangles, ellipses, arrows, freehand pen strokes
- text boxes and sticky notes
- images (uploaded)
- comment pins with threads and replies

Everyone on the board sees live cursors, selections, a laser pointer and the same content instantly, with shared undo/redo.

- Production: Vercel (`drew-board.vercel.app`)
- Source: GitHub `Rahu09/drew_board`, branch `main`

## Who it is for and why

- **Teams** that want a quick shared sketching space tied to their organization (Clerk organizations). Every member of the active team can open and edit the team's boards.
- **Individuals** who want private boards (the personal workspace) and may later move a board into a team to share it.
- **Visitors without an account** who want to try it first: `/try` is a full guest board kept in the browser, no sign-up. Signing in saves it as a real board.
- **People who only need to look**: a read-only link (`/view/<token>`) opens without an account.

The project started from a tutorial-style Miro clone (2024 commits) and has since been upgraded and rebuilt in phases (see [PROJECT_HISTORY.md](PROJECT_HISTORY.md)): security fixes, CI, a real landing page, guest mode, an Excalidraw-like canvas, dashboard polish, mobile support.

## Main features at a glance

| Area | Features |
| --- | --- |
| Accounts | Clerk sign-in (email, Google, GitHub, Facebook), organizations (teams), personal workspace |
| Dashboard | Board grid with real thumbnails, search, favorites, sort, inline rename, "Edited by", instant (optimistic) updates, dark mode, phone layout |
| Board | Live collaboration (Liveblocks), cursors, selections, follow a collaborator's view, laser pointer, undo/redo, 100-shape limit |
| Drawing | Rectangle, ellipse, arrow, pen, text, sticky note, image, comment, hand, eraser, laser |
| Styling | Excalidraw-style left panel: stroke, background, sloppiness (rough.js), edges, font family/size/align, opacity, layer order |
| Tools | Command palette, help, search on canvas, personal library, export PNG/SVG/clipboard, open/save `.board` files, reset canvas, canvas background color, dark theme |
| Sharing | Team boards: copy link. Personal boards: move into a team. Anyone: read-only link |
| Guest | `/try`: full board in localStorage, saved into your account after sign-in |
| Mobile | Touch drawing, pinch zoom, two-finger pan, phone layout like Excalidraw's |

## Glossary

| Term | Meaning |
| --- | --- |
| Workspace | Where a board lives: a Clerk org id (`org_...`) or `user:<userId>` for personal boards. Stored in the `orgId` field |
| Active org | The organization currently selected in Clerk; it is in the `org_id` claim of the `convex` JWT |
| Layer | One thing on the canvas (shape, text, note, path, arrow, image) |
| Room | A Liveblocks room; its id is the Convex board id |
| BoardStore | The interface the canvas talks to, implemented by Liveblocks (live boards) and localStorage (guest and read-only boards) |
| Snapshot | Plain JSON of a board: `{ layers, layerIds, background }` |
| Thumbnail | Small webp/png picture of a board, in Convex file storage, shown on dashboard cards |
| Guest board | The `/try` board, kept in `localStorage` key `board:guest:v1` |
| Share token | Secret in a read-only link, stored in `boards.shareToken` |
| Mod | Ctrl on Windows/Linux, ⌘ on Mac |
