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
- `POST /api/guest-board`: saves a guest board for the signed-in user (creates the Convex board, then the Liveblocks room with its content).

`proxy.ts` decides which routes are public. Clerk and Convex providers live in `app/(app)/layout.tsx`, so the landing page ships none of their code.

## Workspaces

A board's `orgId` is its workspace: a Clerk organization id, or `user:<userId>` for a personal board (`convex/workspace.ts`). You can always use your personal boards; an organization's boards only while that organization is active.

To share a personal board, its owner moves it into one of their organizations ("Share with a team" in the board menu, or Share on `/try`). The app switches to that organization first, because `board.moveToOrg` only accepts the organization that is active in the caller's token; Convex has no other way to check membership. The board then belongs to the organization and leaves the owner's personal boards.

## Canvas storage

`components/canvas/` draws a board through the `BoardStore` interface (`lib/board-store/`), which has two implementations:

- `liveblocks-store.tsx`: real-time boards (`/board/[boardId]`), with presence and shared history.
- `local-store.tsx`: the guest board, kept in `localStorage`, with its own undo history.

Guest data is checked with `lib/board-store/validate.ts` when it is loaded and again on the server before it is saved.

## Scripts

- `pnpm dev`: development server
- `pnpm build`: production build
- `pnpm lint`: ESLint
- `npx tsc --noEmit` and `npx tsc -p convex/tsconfig.json --noEmit`: type checks for the app and for `convex/` (the root config does not cover `convex/`)

## CI

`.github/workflows/ci.yml` runs on every push and pull request: install with `--frozen-lockfile`, both type checks, lint and a production build with placeholder environment variables.

## Deployment

Deployed on Vercel with the build command `npx convex deploy --cmd 'npm run build'`. Set `CONVEX_DEPLOY_KEY` and the variables above in the Vercel project, and `LIVEBLOCKS_SECRET_KEY` in the production Convex deployment.
