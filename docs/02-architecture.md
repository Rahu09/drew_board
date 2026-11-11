# 2. Architecture

## Stack

| Layer | Technology | Used for |
| --- | --- | --- |
| Framework | **Next.js 16.4** (App Router, Turbopack), **React 19.3** with the **React Compiler**, TypeScript ~6.0 | Pages, API routes, server rendering |
| Auth | **Clerk 7** (`@clerk/nextjs`) | Sign-in, users, organizations (teams), JWT for Convex |
| Data | **Convex 1.49** | Board metadata, favorites, comments, image and thumbnail files, search |
| Realtime | **Liveblocks 3** | The live canvas: layers storage, presence (cursors, selections, laser, view), shared undo history |
| UI | **Tailwind CSS 4** (configured in `app/globals.css`, no tailwind.config), shadcn/ui on Radix, `tw-animate-css`, lucide-react icons, sonner toasts | Styling and components |
| Drawing | **roughjs 4.6.6** (hand-drawn shapes), **perfect-freehand** (pen strokes) | Canvas rendering |
| State | **zustand 5** (modals, rename, guest store), `usehooks-ts` | Client state |
| Theme | **next-themes 0.4** | Light / dark / system |
| Misc | date-fns, nanoid, query-string, convex-helpers | |
| Tooling | pnpm 12.18 (pinned in `packageManager`), Node 24, ESLint 9 flat config | |

Why these:
- **Liveblocks for the canvas, Convex for everything else.** Liveblocks gives conflict-free shared storage, presence and multi-user undo out of the box, which is the hard part of a whiteboard. Convex holds the things that need queries, indexes and access rules (lists, search, favorites, comments, files).
- **Clerk organizations** give teams without building membership management. Convex trusts Clerk's JWT (`convex` template with `org_id`, `org_role`).

## How the pieces talk

```
Browser
 ├─ Landing page (/)            server-rendered, no Clerk/Convex/Liveblocks JS
 ├─ App routes (dashboard, board, try, view)
 │    ClerkProvider ─ ConvexProviderWithClerk   (app/(app)/layout.tsx)
 │        │                     │
 │        │  JWT "convex"       │ queries / mutations (websocket)
 │        ▼                     ▼
 │      Clerk                Convex  ──(internal action)──► Liveblocks REST (delete room)
 │
 └─ Board page: <Room> (LiveblocksProvider, authEndpoint=/api/liveblocks-auth)
          │ POST /api/liveblocks-auth
          ▼
     Next.js route: Clerk auth() → ConvexHttpClient(board.get as the user) → Liveblocks prepareSession
```

1. **Clerk** signs the user in. A JWT template named `convex` carries `org_id` and `org_role` of the active organization.
2. **Convex** receives that token on every call. `convex/access.ts` checks that a board's workspace is either the caller's personal workspace or their active org.
3. **Liveblocks** room access is granted by `app/api/liveblocks-auth/route.ts`: it asks Convex `board.get` *as the user* (per-request `ConvexHttpClient` with the user's token), and only if the board is visible does it give the user FULL_ACCESS to that room. So Liveblocks access follows exactly the same rule as Convex.
4. The Liveblocks **room id is the Convex board id**.
5. Deleting a board (`board.remove`) deletes favorites, images, comments, the thumbnail, and schedules `liveblocks.deleteRoom` (an internal action using the `LIVEBLOCKS_SECRET_KEY` Convex env var).

## Folder layout

```
app/
  layout.tsx              root: <html>, Inter font, ThemeProvider, metadata. No auth providers.
  page.tsx, _landing/     public landing page (server component, checks session with auth())
  globals.css             Tailwind 4 + theme tokens (light/dark CSS variables)
  icon.svg, apple-icon.tsx, opengraph-image.tsx   generated metadata images
  (app)/                  route group for everything that uses Clerk + Convex
    layout.tsx            ConvexClientProvider (Clerk + Convex), Toaster, ModalProvider
    dashboard/            board list (see 06-dashboard.md)
    board/[boardId]/      live board page, info bar, share dialog, comments, thumbnail sync
    try/                  guest board
    view/[token]/         read-only board
  api/
    liveblocks-auth/      grants Liveblocks room access
    guest-board/          saves a guest board as a personal board
components/
  canvas/                 the whole canvas (see 05-canvas.md)
  ui/                     shadcn/ui primitives
  auth/                   AuthGate (requires sign-in client-side), Loading
  modals/                 share modal (move to team), share-link modal (read-only link)
  actions.tsx             board actions dropdown (dashboard card and board menu)
  inline-title.tsx        inline rename input
  room.tsx                LiveblocksProvider + RoomProvider for a board
  theme-toggle.tsx        sun/moon menu
convex/                   backend (see 04-data-model.md)
hooks/                    use-board-mutations (optimistic), use-media-query, use-workspace, uploads
lib/
  board-store/            BoardStore interface + Liveblocks and local implementations, validation
  canvas-geometry.ts      geometry helpers
  shortcuts.ts            shortcut labels (Mod = Ctrl/⌘)
  site.ts                 site name/url/description
providers/                convex-client-provider, theme-provider, modal-provider
store/                    zustand stores: rename, share dialog, share modal, share-link modal
types/canvas.ts           Layer types, CanvasMode, Camera, Color...
liveblocks.config.ts      global Liveblocks types (Presence, Storage, UserMeta) + hook re-exports
proxy.ts                  Clerk middleware (Next 16 renamed middleware.ts to proxy.ts): public routes
next.config.mjs           Clerk image host, redirects of old "/?favorites" links to /dashboard
.github/workflows/ci.yml  CI
```

## Providers and layouts

- `app/layout.tsx` (every page): `ThemeProvider` only. It is here so the landing page follows the same theme choice.
- `app/(app)/layout.tsx` (dashboard, board, try, view): `ConvexClientProvider` = `ClerkProvider` (with a dark appearance when the theme is dark) + `ConvexProviderWithClerk`, plus the toaster and modal provider. It does **not** require sign-in by itself.
- `components/auth/auth-gate.tsx`: renders its children once Convex has the Clerk token, and a `fallback` until then. The board layout uses it with the board's own skeleton as fallback, so the server-rendered page already has the board's layout (no full-screen spinner). The dashboard doesn't use it: its shell is server-rendered and only the board list waits for the session (see [06-dashboard.md](06-dashboard.md)). `/try` and `/view` need no user.
- `providers/theme-provider.tsx`: next-themes with `storageKey="board:theme"`, `defaultTheme="light"`, system allowed. On `/board`, `/try`, `/view` the page is **forced light**, because the canvas does its own dark theme with an inverting filter (a dark page under it would be inverted back to light).

Why the landing page is outside `(app)`: so its JavaScript contains no Clerk, Convex or Liveblocks code. It is fast and was verified by searching the build output.

## Security model

- **Every Convex function checks access** (`convex/access.ts`):
  - `requireIdentity`: must be signed in.
  - `canAccessWorkspace(identity, workspaceId)`: the personal workspace `user:<subject>`, or the org in the token's `org_id`. Nothing else, so a user can only see boards of their *active* org.
  - `getAccessibleBoard` returns `null` for missing boards and boards the caller can't use, deliberately indistinguishable.
- **Convex can't list a user's org memberships**, only the active one in the token. That's why moving a board into a team, and opening a board link of another team, first switch the active org in Clerk (see flows).
- **Liveblocks access** goes through Convex (`/api/liveblocks-auth`), same rule.
- **Read-only links**: the random `shareToken` in the URL is the permission. `/view/<token>` reads board content once from Liveblocks REST on the server, so viewers never join the room.
- **Guest data is untrusted**: `lib/board-store/validate.ts` checks it when loading from localStorage and again on the server in `/api/guest-board` (size limit 2 MB, title length, layer shapes, max 100 layers).
- **Text is plain text**: text and note layers are stored and rendered as plain text (`components/canvas/plain-text-editable.tsx`), never as HTML, so a layer value can't inject markup. Old HTML values are converted to text safely when shown.
- **Uploads**: images (PNG/JPEG/GIF/WebP, ≤5 MB) and thumbnails (PNG/WebP, ≤512 KB) are checked in Convex after upload; wrong files are deleted.
- **Proxy**: `proxy.ts` makes `/`, `/try`, `/view`, sign-in pages and metadata images public; everything else (dashboard, boards, API routes) requires sign-in.
- **Secrets** live in `.env.local` (git-ignored), Vercel env vars and Convex env vars. Never print them.

## Rendering model of the canvas (short)

The canvas is one `<svg>`; each layer is an SVG element. Text and sticky notes are HTML inside `<foreignObject>` so they can be edited (contenteditable). See [05-canvas.md](05-canvas.md), including the WebKit `foreignObject` caveat that broke iPhones.
