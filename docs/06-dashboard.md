# 6. Dashboard, landing page and theme

## Dashboard (`app/(app)/dashboard/`)

| File | Role |
| --- | --- |
| `layout.tsx` | Flex column: sidebar + navbar + content; the board area scrolls inside itself. Server-rendered, no `<AuthGate>`: the shell and the list skeleton are in the first HTML (see "Loading without a spinner") |
| `_component/org-sidebar.tsx` | Org dropdown (personal account, orgs, create organization), "Team boards" / "Favorite boards" nav with `aria-current`. The old vertical strip of org icons was removed (the dropdown does the job) |
| `_component/navbar.tsx` | Search, invite button (teams only; icon-only on phones), theme toggle, user button. Phone: small logo linking home, search on its own row |
| `_component/search-input.tsx` | Debounced search, builds the URL from the current path and keeps `favorites` |
| `_component/board-list.tsx` | Grid (`grid-cols-2 sm:3 md:4 xl:5 2xl:6`), paginated query, `SORTS`, `SortMenu`, `LoadMore`, phone `ListTabs`, empty states |
| `_component/board-card/*` | Card with thumbnail, footer (title, "Edited by …" or "Created by …", favorite), overlay, actions |
| `_component/new-board-button.tsx`, `empty-*.tsx`, `invite-button.tsx` | |

### Board list query

The list is **paginated** (Phase 6): `usePaginatedQuery(api.boards.list, { orgId, search?, favorites?, sort? }, { initialNumItems: 24 })`. Each page has 24 boards with `isFavorite` and `thumbnailUrl`. The next page loads when the "Load more boards" button at the end of the list scrolls near the screen (an `IntersectionObserver` in `LoadMore`), or when it is pressed.

- Favorites are **batched**: one read of the user's favorites in the workspace (`by_user_org`) per page, not one lookup per board.
- `api.boards.access({ orgId })` says whether the token already allows the workspace. Right after an org switch the token still names the old org, so the list is only asked for once `access` is true (and Convex has the session at all: `useConvexAuth`). Until then the grid skeleton shows.
- Three views: the plain list (sortable), favorites (most recently favorited first) and search (best match first; search inside favorites filters each page of matches, so a page can be short). The sort menu only shows for the plain list.

### Sorting

`?sort=` in the URL (`parseSort`): `edited` (default), `newest`, `oldest`, `name` (A–Z). Sorting is done **on the server**, because only the server sees all pages. Each order reads an index:

| Sort | Index | Key |
| --- | --- | --- |
| `edited` | `by_org_activity` desc | `activityAt`: set on create and on every edit (thumbnail upload) |
| `newest` / `oldest` | `by_org` desc / asc | `_creationTime` |
| `name` | `by_org_title` asc | `titleKey`: the lowercased title, set on create and rename |

Boards created before these keys existed get them from `migrations:backfillBoardSortKeys` (see [07-development-and-deploy.md](07-development-and-deploy.md)); until then they sort last under "Last edited" and first under "Name".

### Loading without a spinner

The dashboard used to show a full-screen pulsing logo until Convex had the Clerk token. Now the layout is server-rendered without `<AuthGate>`: sidebar, navbar, search box and a skeleton grid are in the first HTML. Clerk's own components (org switcher, user button) have skeleton placeholders (`<ClerkLoading>`), the page title is a skeleton until the workspace is known, and only the board list waits for the session.

### Thumbnails

- Made in the browser by `app/(app)/board/[boardId]/_components/thumbnail-sync.tsx`, mounted on the board page.
- It subscribes to the room's **history** (`room.subscribe("history")`), i.e. only *your own* edits trigger it, then waits **2 s** (debounce). It also syncs on unmount (leaving the board), and generates one on open if the board has content but no thumbnail (`missing`). A content key avoids uploading the same picture twice.
- `boardToThumbnail` (`components/canvas/export.ts`) renders the board at **400px** to WebP (browsers that can't encode WebP, like Safari, return PNG instead; the server accepts both).
- Upload: `thumbnails.generateUploadUrl` → POST → `thumbnails.set({ id, storageId, edited: true })`, which validates type/size (PNG/WebP ≤512 KB), deletes the previous file and records `lastEditedAt` / `lastEditorName`. An empty board sets `storageId: null`.
- Cards show the image with `unoptimized` (Convex URLs), or the old placeholder SVG when there is none.

### Optimistic updates (`hooks/use-board-mutations.ts`)

Convex `withOptimisticUpdate` on every loaded page of the `boards.list` queries (`updateLists`), so the UI changes instantly and rolls back automatically if the server refuses:

| Hook | Effect |
| --- | --- |
| `useFavoriteBoard` / `useUnfavoriteBoard` | Toggle `isFavorite`; unfavorite also removes it from the Favorites list |
| `useRenameBoard` | New title immediately |
| `useRemoveBoard` | Card disappears |
| `useCreateBoard` / `useCreateAndOpenBoard` | Temporary card with an id prefixed `OPTIMISTIC_ID_PREFIX`, on top of the first page of the lists that show the newest first (`addCreatingBoard` is module-level because the React purity lint rule forbids `Date.now()` inside the updater) |

### Inline rename

`store/use-rename.ts` (zustand: which board is being renamed) + `components/inline-title.tsx` (`InlineTitleInput`). Used on cards (Actions → Rename) and the board title (click it, or Menu → Rename). Enter or blur saves, Escape cancels. The old rename modal was removed.

Gotcha: when rename is started from a Radix dropdown, the closing menu steals focus back. Start the rename in the menu's `onCloseAutoFocus` (`runAfterMenuClose` in `main-menu.tsx`, same idea in `components/actions.tsx`).

### Accessibility

- The whole card is a **stretched `Link`** (`z-[1]`, first in the DOM), so it's one keyboard stop and a real link (middle-click works). Controls sit above it.
- Favorite is a labelled button with `aria-pressed`.
- Hidden hover controls also appear with `group-focus-within`.
- Sidebar nav uses `<nav>` and `aria-current`.

## Landing page (`app/page.tsx`, `app/_landing/`)

- Server component; `auth()` decides the buttons (signed in: "Go to dashboard"; signed out: "Start drawing, no sign-up" → `/try`, and "Sign in").
- `canvas-demo.tsx`: one SVG, animated without JavaScript (two fake users: one underlines the title with the pen, one moves around), still image for reduced motion. It mirrors the **current** board UI: white canvas, toolbar on top, menu and board name top left, avatars, Share and sidebar button top right, zoom and undo pills bottom left, sticky notes, a hand-drawn rectangle and ellipse joined by an arrow, a comment pin. The rectangle and ellipse come from the canvas's own `shapePaths` (`components/canvas/rough-shape.ts`), which runs on the server here, so rough.js is not sent to the browser. In dark mode it gets the same invert filter as the real board. **When the board UI changes, update this picture too.**
- `features.tsx`: nine cards (live cursors and follow, hand-drawn shapes, pen/eraser/laser, comments, images and export, personal and team boards with read-only links, no sign-up, phone and dark mode, shortcuts and dashboard). Keep them in step with what the app does.
- `site-header.tsx` (with the theme toggle), `site-footer.tsx`, `cta-buttons.tsx`, `fonts.ts` (Kalam for the hand-drawn look).
- Ships **no** Clerk/Convex/Liveblocks (or rough.js) JavaScript. Check after a build: `.next/server/app/page_client-reference-manifest.js` must not mention them.
- Metadata: `lib/site.ts`, `app/opengraph-image.tsx`, `app/apple-icon.tsx`, `app/icon.svg`.

## Theme

- `providers/theme-provider.tsx` in the **root** layout: next-themes, `storageKey="board:theme"`, `defaultTheme="light"`, system allowed, `attribute="class"`.
- Dark CSS variables in `app/globals.css`; `components/theme-toggle.tsx` is the sun/moon menu (dashboard navbar and landing header).
- Board routes (`/board`, `/try`, `/view`) are forced light; the canvas applies its own dark mode (`html.board-dark` invert filter) from the same stored choice (`components/canvas/theme.ts`).
- Clerk components get a dark appearance in dark mode (`providers/convex-client-provider.tsx`).
- `viewport.themeColor` follows the system scheme on phones.
