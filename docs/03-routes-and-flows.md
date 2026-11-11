# 3. Routes and flows

## Routes

| Route | Public? | What it is | Main files |
| --- | --- | --- | --- |
| `/` | yes | Landing page. Server-rendered; checks the session with `auth()` to show "Go to dashboard" or "Start drawing, no sign-up" + "Sign in". Animated SVG canvas demo, feature cards, footer. No Clerk/Convex/Liveblocks JS | `app/page.tsx`, `app/_landing/*` |
| `/dashboard` | no | Boards of the current workspace. `?favorites=true`, `?search=...`, `?sort=...` | `app/(app)/dashboard/*` |
| `/board/[boardId]` | no | A live board. `?share=1` opens the share dialog on arrival | `app/(app)/board/[boardId]/*` |
| `/try` | yes | Guest board in `localStorage` (`board:guest:v1`). `?intent=save` / `?intent=share` after sign-in saves it | `app/(app)/try/*` |
| `/view/[token]` | yes | Read-only board from a share link. `noindex` | `app/(app)/view/[token]/*` |
| `POST /api/liveblocks-auth` | signed in | Grants Liveblocks room access | `app/api/liveblocks-auth/route.ts` |
| `POST /api/guest-board` | signed in | Saves a guest board as a new personal board | `app/api/guest-board/route.ts` |
| `/opengraph-image`, `/apple-icon` | yes | Generated metadata images | `app/opengraph-image.tsx`, `app/apple-icon.tsx` |

- `proxy.ts` (Clerk middleware) lists the public routes; everything else calls `auth.protect()` (signed-out visits go to Clerk's hosted sign-in page and come back).
- `next.config.mjs` redirects old links `/?favorites=...` and `/?search=...` to `/dashboard` (the dashboard used to be at `/`).

## Flow: sign in and pick a workspace

1. Clerk-hosted sign-in (or the pop-up on `/try`). After sign-in Clerk falls back to `/dashboard`.
2. The dashboard shows the **active workspace**: the personal account or the active org. Switching happens in the org dropdown in the dashboard sidebar ("Personal account", each org, "Create organization").
3. Clerk refreshes the `convex` JWT with the new `org_id`. Right after a switch, Convex may still have the old token; `boards.access` is false while the org in the token doesn't match yet; the dashboard waits for it before asking for the list and shows the skeleton meanwhile.

## Flow: create and open a board

1. "New board" calls `board.create` with the current workspace id (`useCreateAndOpenBoard` in `hooks/use-board-mutations.ts`). The card appears instantly (optimistic) and the board opens.
2. The board page (`app/(app)/board/[boardId]/page.tsx`) loads the board with `api.board.get`. If it is `null`, `BoardOrgSwitch` takes over (next flow).
3. `<Room>` (`components/room.tsx`) connects to Liveblocks; `LiveblocksProvider` calls `/api/liveblocks-auth`, which checks the board through Convex as the user before granting access.
4. The canvas renders with the Liveblocks store (`lib/board-store/liveblocks-store.tsx`).
5. `ThumbnailSync` watches the room history and uploads a thumbnail after your edits (see [06-dashboard.md](06-dashboard.md)).

## Flow: opening a board of another team (org auto-switch)

`app/(app)/board/[boardId]/_components/board-org-switch.tsx`

1. `board.get` returned `null`: the board is not in the active workspace.
2. The client lists the user's Clerk memberships and asks `board.findOrg({ id, orgIds })`. Convex returns the board's org only if it is in that list.
3. If found, it calls Clerk `setActive({ organization })`. **Only when the tab has focus**: Clerk only writes the active org to its cookies from a focused tab, so a background tab (middle-click) would change the org in memory only and Convex would keep the old token forever. The switch waits for focus.
4. The board page then picks the board up once the new token reaches Convex. Otherwise "Board not found" (`board-not-found.tsx`).

## Flow: guest board (`/try`)

1. `/try` renders the canvas with the **local store** (`lib/board-store/local-store.tsx`), loaded from `localStorage["board:guest:v1"]` and validated (`validate.ts`). It has its own undo history. No Convex, no Liveblocks.
2. Images and comments are not available (they need a saved board); trying shows "Sign in and save the board to add images".
3. **Save** / **Share** when signed out open Clerk's sign-in **pop-up** (`mode="modal"`) with `forceRedirectUrl=/try?intent=save` (or `share`). The intent is in the URL so it survives full redirects (Google/GitHub OAuth).
4. Back on `/try` signed in with an intent, `use-save-guest-board.ts` posts the snapshot to `POST /api/guest-board`:
   - validates the body again on the server (≤2 MB, title ≤60 chars, layer schema),
   - `board.create` in the user's **personal workspace**,
   - creates the Liveblocks room (`createRoom(boardId, { defaultAccesses: [] })`) and writes the content with `initializeStorageDocument` (the document is built by `toStorageDocument`).
5. The guest storage is cleared and the browser goes to `/board/<id>` (share: `/board/<id>?share=1`, which opens the "share with a team" dialog).
6. An empty board doesn't save: "Add something to the board first, then save it."
7. Signed-in visitors on `/try` see their account button (sign-out lives there).

## Flow: sharing

Share dialog on a live board (`share-dialog.tsx`), two parts:

**Live collaboration**
- **Team board**: copy the board link. Everyone in the team can open and edit it.
- **Personal board**: "Share with a team" (`components/modals/share-modal.tsx`). It lists the user's orgs plus "Create a team".
  1. Picking a team first switches the active org to it (`setActive`), because `board.moveToOrg` only accepts the org that is **active in the caller's token** (Convex can't check membership otherwise). If the token isn't updated yet, the mutation throws `ConvexError(ORG_NOT_ACTIVE)` and the client retries.
  2. `board.moveToOrg`: only the owner, only from their personal workspace, only into the active org. Favorites move with the board.
  3. A toast offers "Invite people".

**Read-only link** (`components/modals/share-link-modal.tsx`)
1. `board.setShareLink({ id, enabled })` creates a random `shareToken` (or clears it). Turning it off and on again makes a new link; the old one stops working.
2. `/view/<token>`: the server page asks Convex `board.getShared(token)` and reads the content **once** from Liveblocks REST (`getStorageDocument(boardId, "json")`). Viewers don't join the room, so they don't count as Liveblocks users and see no live updates.
3. The page renders the canvas with the local store seeded from that snapshot, never written to localStorage. Pan, zoom, search and export only.
4. A disabled link shows "not found" (HTTP 200, because of how the app layout loads).

## Flow: deleting a board

`components/actions.tsx` → `useRemoveBoard` (optimistic: the card disappears immediately) → `board.remove`:
- deletes favorites, images (`boardImages` + files), comment threads and comments, the thumbnail file,
- schedules `internal.liveblocks.deleteRoom` (Liveblocks REST, `LIVEBLOCKS_SECRET_KEY` Convex env var).
If you delete the board you're on, you're taken back to `/dashboard`.

## Flow: comments

Comment tool (C) on a saved board: click a spot, type, Enter → `comments.createThread`. Pins show a reply count; replies with `comments.reply`, resolve with `comments.resolve` (resolved threads are hidden), delete with `comments.removeThread` (author only). The sidebar's Comments tab lists all threads with their replies; clicking one moves the view there and opens it.

## Flow: images

Image tool (I), drag and drop or paste on a saved board → `hooks/use-upload-board-image.ts` → `images.generateUploadUrl` → upload → `images.addImage` checks type/size, records it in `boardImages`, returns the URL → an Image layer is inserted with `src`. Files are deleted with the board.
