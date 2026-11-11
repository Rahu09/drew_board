# Board

A real-time collaborative whiteboard. Teams create boards inside an organization and draw on them together: shapes, sticky notes, text and freehand pen, with live cursors and undo/redo.

## Stack

- **Next.js 16** (App Router) and **React 19**
- **Clerk** for sign-in and organizations
- **Convex** for board data (titles, favorites, search)
- **Liveblocks** for the live canvas (shapes, presence, cursors)
- **Tailwind CSS 4** with shadcn/ui components

## Local setup

Requires Node.js 24 and pnpm.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` with:

   | Variable | Where to get it |
   | --- | --- |
   | `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` | written by `npx convex dev` |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard, API keys |
   | `LIVEBLOCKS_API_KEY` | Liveblocks dashboard, secret key (`sk_...`) |

3. In the Clerk dashboard, create a JWT template named `convex` that includes the active organization:

   ```json
   { "org_id": "{{org.id}}", "org_role": "{{org.role}}" }
   ```

   Convex uses `org_id` to make sure users only see boards of their active organization.

4. In the Convex dashboard (Settings, Environment Variables), set `LIVEBLOCKS_SECRET_KEY` to the same Liveblocks secret key. Convex uses it to delete a board's Liveblocks room when the board is deleted.

5. Run Convex and Next.js in two terminals:

   ```bash
   npx convex dev
   ```

   ```bash
   pnpm dev
   ```

## Routes

- `/`: public landing page.
- `/dashboard`: the boards of the current workspace (sign-in required): your personal boards, or those of the active organization. Old links to `/?favorites=true` or `/?search=...` redirect here.
- `/board/[boardId]`: a board (sign-in required). Opening a board of another organization you belong to switches to that organization.
- `/try`: guest mode (public). The board is kept in this browser's `localStorage` (`board:guest:v1`), not in Convex or Liveblocks. Save and Share open Clerk's sign-in pop-up; after sign-in the board is copied into a new personal board and opened. Share then offers to move it into a team.
- `/view/[token]`: a read-only link (public, no sign-in). Shows the board as last saved, read once from Liveblocks' REST API, so viewers don't join the room or count as Liveblocks users. Pan, zoom and export only. Turned on and off from "Read-only link" in the board menu; turning it off and on again makes a new link.
- `POST /api/guest-board`: saves a guest board for the signed-in user (creates the Convex board, then the Liveblocks room with its content).

`proxy.ts` decides which routes are public. Clerk and Convex providers live in `app/(app)/layout.tsx`, so the landing page ships none of their code.

## Workspaces

A board's `orgId` is its workspace: a Clerk organization id, or `user:<userId>` for a personal board (`convex/workspace.ts`). You can always use your personal boards; an organization's boards only while that organization is active.

To share a personal board, its owner moves it into one of their organizations ("Share with a team" in the board menu, or Share on `/try`). The app switches to that organization first, because `board.moveToOrg` only accepts the organization that is active in the caller's token; Convex has no other way to check membership. The board then belongs to the organization and leaves the owner's personal boards.

## Canvas storage

`components/canvas/` draws a board through the `BoardStore` interface (`lib/board-store/`), which has two implementations:

- `liveblocks-store.tsx`: real-time boards (`/board/[boardId]`), with presence and shared history.
- `local-store.tsx`: the guest board, kept in `localStorage`, with its own undo history.

Guest data is checked with `lib/board-store/validate.ts` when it is loaded and again on the server before it is saved. Read-only links use the local store too, seeded from the saved board and never written to `localStorage`.

## Images and comments

Saved boards only; on `/try`, adding an image asks you to sign in.

- Images (Image tool, drag and drop, or paste) are uploaded to Convex file storage (`convex/images.ts`: PNG, JPEG, GIF or WebP, up to 5 MB) and listed in `boardImages`, so they are deleted with the board.
- Comments (Comment tool, C) are threads pinned to a spot on the board (`convex/comments.ts`). Anyone who can use the board can reply or resolve; only the author can delete a thread. Resolved threads are hidden.

## Canvas controls

- Drawing: pick a shape tool and drag; Shift keeps squares, circles and 45° arrows. A click places the default size. New shapes go on top. Rectangles and ellipses start as hand-drawn outlines with a see-through inside (rectangles with round corners); notes start yellow with the date they were made in the corner. After a text or note is placed you can type straight away. Text and notes keep their font size when resized and grow so every line stays visible; a note first makes its text 2px smaller before it grows. Drag an arrow's end handles to move them.
- Layout: the tools sit in one compact row at the top center, starting with the logo (back to the boards); on narrow screens the row moves to the bottom. At the top right are the board menu with the board's name, who else is on the board, Share and the sidebar button. Undo and redo sit next to the zoom bar at the bottom right.
- Share (live boards): live collaboration (team boards: copy the link, everyone in the team can edit; personal boards: share with a team) or a read-only link.
- Sidebar (button at the top right, or Mod+F for search): search the text of text layers and sticky notes (Enter / Shift+Enter step through results, each shown and outlined on the board); a personal library, kept in this browser, to save the selection and add it to any board; and every comment of the board (live boards), each one opening its thread on the board. Pin it to keep it open; otherwise a click on the board closes it.
- Style panel (`components/canvas/properties-panel.tsx`): selecting something opens a panel at the left, like Excalidraw's, with only what applies to the selection: stroke (or text) color, background (transparent or a color; for notes, the paper), sloppiness (architect, artist, cartoonist: clean to wobbly lines, drawn with rough.js), edges (sharp or round), font family (hand-drawn, normal, code), font size (S/M/L/XL or step by step), text align, opacity, layer order and duplicate/delete. The last swatch in a color row opens a picker for any color. Every style field is optional, so shapes saved before the panel keep their old look.
- Zoom: Ctrl/⌘ + scroll or a trackpad pinch, two-finger pinch on touch screens, or the zoom bar (bottom right: zoom out, level, zoom in, fit to screen). Scroll pans, and so does dragging with the middle mouse button; on touch screens, two fingers pan.
- Export (download button, bottom right): PNG or SVG of the selection, or of the whole board when nothing is selected. Text uses a system font in exports (Kalam, Inter or a monospace font when installed).
- Shortcuts (`components/canvas/use-canvas-shortcuts.ts`; "Mod" is Ctrl, or ⌘ on a Mac). They are off while typing in a text layer or a field.

| Keys | Action |
| --- | --- |
| V, T, N, R, O, A, P | Select, text, sticky note, rectangle, ellipse, arrow, pen |
| I / C | Add an image / comment (saved boards) |
| Delete / Backspace | Delete the selection |
| Mod+A | Select all |
| Mod+D | Duplicate |
| Mod+C / Mod+X / Mod+V | Copy, cut, paste (within this tab, also between boards); pasting an image adds it |
| Mod+] / Mod+[ | Bring forward, send backward (one step) |
| Mod+Shift+] / Mod+Shift+[ | Bring to front, send to back |
| Mod+Shift+> / Mod+Shift+< | Larger, smaller text (text and notes) |
| Mod+Z, Mod+Shift+Z or Mod+Y | Undo, redo |
| Mod+= / Mod+- / Mod+0 | Zoom in, zoom out, 100% |
| Shift+1 | Fit to screen |
| Mod+F | Search the board's text (sidebar) |
| Escape | Stop editing text, leave the tool, clear the selection |

- A board holds at most 100 shapes (`MAX_LAYERS`). From 90 the zoom bar shows the count, and adding past the limit shows a message instead of failing silently.

## Scripts

- `pnpm dev`: development server
- `pnpm build`: production build
- `pnpm lint`: ESLint
- `npx tsc --noEmit` and `npx tsc -p convex/tsconfig.json --noEmit`: type checks for the app and for `convex/` (the root config does not cover `convex/`)

## CI

`.github/workflows/ci.yml` runs on every push and pull request: install with `--frozen-lockfile`, both type checks, lint and a production build with placeholder environment variables.

## Deployment

Deployed on Vercel with the build command `npx convex deploy --cmd 'npm run build'`. Set `CONVEX_DEPLOY_KEY` and the variables above in the Vercel project, and `LIVEBLOCKS_SECRET_KEY` in the production Convex deployment.
