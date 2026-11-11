# 4. Data model

Two stores hold a board:

- **Convex**: the board *record* (title, workspace, author, thumbnail, last editor, share token), favorites, comments, uploaded files.
- **Liveblocks**: the board *content* (layers) and live presence. Room id = board id.

## Convex tables (`convex/schema.ts`)

### `boards`
| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Trimmed, max 60 chars |
| `orgId` | string | The **workspace**: Clerk org id `org_...`, or `user:<userId>` for a personal board (`convex/workspace.ts`) |
| `authorId`, `authorName` | string | Creator |
| `imageUrl` | string | Old placeholder image (from the original build); cards now prefer the thumbnail |
| `shareToken` | string? | Secret of the read-only link `/view/<token>` |
| `thumbnailId` | Id<"_storage">? | Small picture of the board |
| `lastEditedAt`, `lastEditorId`, `lastEditorName` | ? | Set when a thumbnail is uploaded after the user's own edit |
| `activityAt` | number? | Sort key of "Last edited": creation time, then the time of each edit |
| `titleKey` | string? | Sort key of "Name": the lowercased title (`convex/sort.ts`) |

Indexes: `by_org [orgId]`, `by_org_activity [orgId, activityAt]`, `by_org_title [orgId, titleKey]`, `by_share_token [shareToken]`, search index `search_title` (search `title`, filter `orgId`).

### `userFavorites`
`orgId` (same format as `boards.orgId`), `userId`, `boardId`. Indexes `by_board`, `by_user_org`, `by_user_board`, `by_user_board_org`.

### `boardImages`
`boardId`, `storageId`. Index `by_board`. Lets `board.remove` delete a board's uploaded images.

### `commentThreads`
`boardId`, `x`, `y` (canvas coordinates), `resolved`, `authorId`. Index `by_board_resolved`.

### `comments`
`threadId`, `boardId`, `authorId`, `authorName`, `authorImage?`, `body`. Indexes `by_thread`, `by_board`.

## Convex functions

All public functions require sign-in and check the workspace (see `convex/access.ts` and [02-architecture.md](02-architecture.md#security-model)).

| File | Function | What it does |
| --- | --- | --- |
| `boards.ts` | `list({ orgId, search?, favorites?, sort?, paginationOpts })` query | The dashboard list, a page at a time: the workspace's boards in the chosen order, the favorites, or a title search. Each card gets `isFavorite` (one batched favorites read per page) and `thumbnailUrl`. An empty page when the token's org doesn't match |
| | `access({ orgId })` query | Whether the token already allows the workspace; the dashboard waits for it before listing (after an org switch) |
| `sort.ts` | helpers (no server imports, used by the app too) | `boardSort` validator, `BoardSort`, `titleSortKey` |
| `migrations.ts` | `backfillBoardSortKeys` internal mutation | Fills `activityAt` / `titleKey` on older boards, in batches; safe to re-run |
| `board.ts` | `create({ orgId, title })` | New board with a random placeholder image (`/placeholders/N.svg`) |
| | `remove({ id })` | Deletes board, favorites, images, comments, thumbnail; schedules Liveblocks room deletion |
| | `update({ id, title })` | Rename |
| | `favorite` / `unfavorite({ id })` | |
| | `get({ id })` query | Never throws; `null` for missing, malformed or inaccessible boards. Also used by `/api/liveblocks-auth` |
| | `findOrg({ id, orgIds })` query | Returns the board's org if it's in the caller's list (org auto-switch) |
| | `moveToOrg({ id, orgId })` | Move a personal board into the **active** org; owner only; throws `ConvexError("ORG_NOT_ACTIVE")` if the token isn't updated yet |
| | `setShareLink({ id, enabled })` | Create / clear `shareToken` |
| | `getShared({ token })` query | Public: board id and title for a read-only link |
| `thumbnails.ts` | `generateUploadUrl({ id })` | Upload URL for a board the caller can use |
| | `set({ id, storageId \| null, edited })` | Accepts PNG/WebP ≤512 KB (else deletes the file), replaces and deletes the old thumbnail. With `edited`, records the caller as last editor and `lastEditedAt` |
| `images.ts` | `generateUploadUrl`, `addImage` | Image layers: PNG/JPEG/GIF/WebP ≤5 MB, recorded in `boardImages` |
| `comments.ts` | `list`, `createThread`, `reply`, `resolve`, `removeThread` | Comment pins and replies; only the author deletes a thread |
| `liveblocks.ts` | `deleteRoom` internal action | Calls Liveblocks REST with `LIVEBLOCKS_SECRET_KEY` |
| `access.ts` | helpers | `getActiveOrgId`, `canAccessWorkspace`, `requireIdentity`, `requireWorkspaceAccess`, `getAccessibleBoard`, `requireBoard` |
| `workspace.ts` | helpers (no Convex imports, used by the app too) | `personalWorkspaceId`, `isPersonalWorkspaceId`, `ORG_NOT_ACTIVE` |
| `auth.config.js` | | Clerk issuer for Convex. Has a known harmless lint warning (anonymous default export). Must change for a Clerk production instance |

`convex/tsconfig.json` is separate from the root one; type-check it with `npx tsc -p convex/tsconfig.json --noEmit` (the root check doesn't cover `convex/`, which once caused a production failure).

## Liveblocks (`liveblocks.config.ts`)

### Storage (persistent, per room)
```ts
{
  layers: LiveMap<string, LiveObject<Layer>>,  // id → layer
  layerIds: LiveList<string>,                  // drawing order, last = on top
  background?: string,                         // canvas color "#rrggbb"; none = white
}
```
In Liveblocks v3, `useStorage` returns plain JSON: `root.layers[id]` (object), arrays for lists. `toImmutable()` is gone; use `toJSON()`.

### Presence (live, per user)
| Field | Meaning |
| --- | --- |
| `cursor` | Canvas point or null |
| `selection` | Selected layer ids (others see an outline in the user's color) |
| `pencilDraft`, `penColor` | The pen stroke being drawn, so others see it live |
| `view` | `{ x, y, scale }` of what the user is looking at, so others can follow them |
| `laser` | Laser pointer trail points |

### UserMeta
`id` and `info: { name, picture }`, set by `/api/liveblocks-auth` from Clerk (`firstName` or "Teammate").

The "Powered by Liveblocks" badge (free plan) sits bottom-right (`badgeLocation` in `components/room.tsx`).

## Layers (`types/canvas.ts`)

`LayerType` enum is **stored in boards: only append, never reorder**: `Rectangle, Ellipse, Path, Text, Note, Arrow, Image`.

Common to all: `x, y, width, height, fill: Color {r,g,b}, value?, opacity? (0–100)`.

| Layer | Extra fields |
| --- | --- |
| Rectangle | `fillStyle?: "solid" \| "none"`, `backgroundColor?`, `roughness?: 0\|1\|2`, `edges?: "sharp" \| "round"` |
| Ellipse | `fillStyle?`, `backgroundColor?`, `roughness?` |
| Path (pen) | `points: [x, y, pressure][]` relative to x/y |
| Text | `fontSize?`, `fontFamily?: "hand" \| "sans" \| "mono"`, `textAlign?` |
| Note | `fillStyle?` (paper see-through), `textColor?`, `roughness?`, `edges?`, `fontSize?`, `fontFamily?`, `textAlign?`, `createdAt?` (date shown in the corner) |
| Arrow | `points: [[x1,y1],[x2,y2]]` relative to x/y |
| Image | `src` (https URL from Convex storage) |

**Rule: every style field is optional.** Boards saved before a field existed have none of it and must keep their old look (e.g. no `fillStyle` = solid; no `fontSize` = text scales with its box until first resized).

A board holds at most **100 layers** (`MAX_LAYERS` in `lib/board-store/types.ts`).

## Browser storage keys

| Key | Where | What |
| --- | --- | --- |
| `board:guest:v1` | localStorage | Guest board snapshot (`/try`) |
| `board:theme` | localStorage | next-themes choice (light/dark/system), shared by dashboard, landing and the canvas theme |
| `board:library:v1` | localStorage | Personal shape library (`components/canvas/library.ts`), works on any board |

## Board file format

Menu → Save to… / Open (`components/canvas/board-file.ts`) saves and loads a `.board` JSON file (`{ type, version, ...snapshot }`); it is validated with `lib/board-store/validate.ts` on open.
