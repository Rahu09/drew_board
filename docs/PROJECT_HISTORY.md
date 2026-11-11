# Project history, decisions and working context

This file is the **hand-off context** between working sessions (human or AI). Read it before starting work, and add to it at the end of every session: what was asked, what was decided, what changed, problems and fixes, and what is still open.

Last updated: 2026-11-12.

---

## 1. Working rules (agreed with the owner)

1. **Phases go in order.** Don't start the next phase until the owner says so.
2. **After every change run all checks**: `npx tsc --noEmit`, `npx tsc -p convex/tsconfig.json --noEmit`, `pnpm lint`, `pnpm build`. Then test in the browser against the dev server (`pnpm dev`, port 3000). The owner is signed in in the Claude desktop built-in browser: **never sign them out**.
3. **Convex**: push to dev only, with `npx convex dev --once`. **Never touch the production Convex deployment directly.**
4. **Don't delete `.next` while the dev server runs** (it uses `.next/dev`). Build in a separate folder or a scratch copy of the repo, or ask first.
5. **Don't commit or push unless asked.** When asked, the owner usually commits themself; pushing has been done on request.
6. **Never print secret values** (`.env.local`, Convex/Vercel env vars). When listing env vars, print names only and watch out for commented-out lines.
7. **Known lint warning**: `convex/auth.config.js` (anonymous default export). Leave it.
8. **Don't touch the owner's own boards** ("testing" team board, personal "Untitled"). Create throwaway test boards and delete them (and their rooms) after testing.
9. New layer/style fields are always **optional**, so old boards keep their look. `LayerType` values are only appended.
10. Shell gotcha (AI sessions): Bash heredocs containing apostrophes break the tool wrapper; write scripts to a file with the Write tool instead.

## 2. Roadmap and status

| Phase | Scope | Status |
| --- | --- | --- |
| Upgrade | All libraries to latest (Next 16, React 19, Clerk 7, Convex 1.49, Liveblocks 3, Tailwind 4, TS 6, pnpm 12, Node 24) | Done (before 2026-11-11, commit `0e84722`, `cc5f3cc`) |
| Phase 0 | Bugs and security: server-side org checks on every Convex board function; delete removes favorites + Liveblocks room; favorites ignore deleted boards; users without a name can create boards; trimmed rename; search keeps favorites; search inside favorites; "Board not found" page; redirect after deleting the board you're on | Done (`84a0960`, `9967195`) |
| Phase 1 | Safety net: CI; `/` landing + `/dashboard`; sign-in moved out of the root layout; metadata/icons; org auto-switch for board links | Done 2026-11-11 (`737076b`) |
| Phase 2 | Server-rendered landing page with no Clerk/Convex/Liveblocks JS: hero, animated canvas demo, features, CTAs | Done 2026-11-11 (`7ac7111`) |
| Phase 3 | Board store layer (Liveblocks + local); `/try` guest mode; personal boards; save guest board after sign-in; share = move personal board into a team | Done 2026-11-11 (`bceb9d8`) |
| Phase 4 | Canvas UX: zoom, shortcuts, tooltips, selection toolbar placement, 100-shape notice, touch. Optional: arrows, PNG/SVG export, images, comments, read-only links. Plus the Excalidraw-style redesign the owner asked for | Done 2026-11-11 (in `87e8188`) |
| Phase 5 | Dashboard UX: thumbnails, optimistic updates, inline rename, sorting, "Edited by", dark mode, accessibility, phone layout. Plus Excalidraw-style phone layout for the board | Done 2026-11-11 (`87e8188`) |
| Mobile fixes | Touch fixes and the iPhone text/note fix | Done 2026-11-11/12 (`1395208`, `6b38c78`); **iPhone not yet confirmed by the owner** |
| Phase 6 | Performance: React Compiler (measured, on), server-rendered layouts (no full-screen auth spinner), paginated board lists/search, batch favorites (not one query per board), faster selection net. Plus the iPhone Safari top-bar fix | Done 2026-11-12 (**not committed**; production needs the one-time `backfillBoardSortKeys` run after deploy) |
| Phase 7 | Production: Clerk production instance (needs a domain; update `convex/auth.config.js`), Sentry, Vercel Analytics, Playwright e2e with `@clerk/testing` in CI | **Next, not started** |

## 3. Key decisions (and why)

| Decision | Why |
| --- | --- |
| Landing page outside the `(app)` route group; Clerk/Convex providers in `app/(app)/layout.tsx`, not the root | Landing page ships no auth/data JS (fast, Phase 2 requirement) |
| `<AuthGate>` per page instead of `<Authenticated>` in the root | `/`, `/try`, `/view` must work signed out |
| **Personal boards** (workspace `user:<userId>`) instead of forcing a default org | Simpler for new users; the guest board saves into the personal workspace |
| Guest storage is **local only** (localStorage), not anonymous Liveblocks rooms | No Liveblocks monthly-active-user cost, no abuse |
| A `BoardStore` interface under the canvas, built before more canvas features | Same canvas for live, guest and read-only boards |
| Sharing a personal board = **moving it into a team** | Convex only knows the *active* org in the token, so the client switches org first, then `board.moveToOrg` checks it |
| Read-only links read Liveblocks REST once on the server | Viewers don't join the room or count as Liveblocks users; no live updates for them (accepted) |
| Text/note values are **plain text**, not HTML (`react-contenteditable` removed) | Prevents HTML injection from other users or crafted guest boards |
| Excalidraw as the UI reference (owner's screenshots) | White canvas, left style panel, top toolbar, menu top-left, zoom/undo bottom-left, sidebar with search/library/comments, phone layout |
| Rough.js for sloppiness, seed from layer id | Hand-drawn look identical for everyone and on every redraw |
| New rectangles/ellipses are outlines with see-through inside; new notes always yellow | Matches Excalidraw; avoids near-black notes with the dark palette |
| Dark theme on the board = CSS invert filter on `<html>` (`html.board-dark`); board routes force the page theme to light | One consistent theme everywhere; a dark page under the invert would turn light again |
| Theme stored as `board:theme`, ThemeProvider in the root layout | One choice shared by landing, dashboard and board |
| Thumbnails made in the browser after the user's own edits (2 s debounce, on leave) | No server-side rendering of boards needed; only editors upload |
| Dashboard logo goes to the homepage; board logo goes to the dashboard | Dashboard → dashboard would do nothing |
| Removed the dashboard's org icon strip | Org dropdown covers it; owner found it cluttered |
| Phone board UI: style panel as a sheet behind a palette button; "Go to boards" in the menu; no zoom buttons | Keep the canvas clear on small screens (owner allowed improvements over the screenshot) |
| Keep HTML inside `<foreignObject>` plain (no filter/shadow/opacity/position) | WebKit (all iPhone browsers) misplaces such content |
| Board lists are sorted **on the server** with stored sort keys (`activityAt`, `titleKey`) and one index per order | A paginated list can only be sorted where all pages are known; `lastEditedAt ?? _creationTime` and a case-insensitive title can't be indexed directly |
| Favorites and search results are not sortable (most recently favorited / best match first) | Sorting them would mean reading every favorite's board, or every match, on each request: what pagination is there to avoid |
| A separate `boards.access` query instead of `boards.get` returning `null` | A paginated query must return a page; the dashboard waits for `access` before listing after an org switch |
| Dashboard shell without `<AuthGate>`, with narrow `<Suspense>` boundaries around everything that reads the query string | The first HTML is the real layout with skeletons; one wide boundary made the whole page fall back to the logo |
| React Compiler on | Measured: about a quarter less work per pointer move in the selection net, nothing slower, +3.5% client JS (numbers in `07-development-and-deploy.md`) |
| Selection net reads the layers once per drag | `getSnapshot()` copies the whole board (Liveblocks `toJSON`); layers moved by others during one drag are an accepted edge case |
| Canvas sized with `h-full`, never `100vh` | iPhone Safari's `100vh` is taller than the visible page |

## 4. Change log by session

### Before 2026-11-11 (earlier session)
Library upgrades (incl. Liveblocks v3 API change: `useStorage` returns plain JSON; Next 16 `middleware.ts` → `proxy.ts`; page `params` are Promises; Vercel "Node 18 discontinued" fixed with `engines: 24.x`) and Phase 0 fixes. Tested in the browser and with `npx convex run --identity`.

### Session 2026-11-11 → 2026-11-12 (long session, phases 1–5 + mobile)

In order of the owner's requests:

1. **Phase 1**: CI workflow; routes moved into `app/(app)/` with `git mv`; `/` placeholder landing; links/redirects to `/dashboard` (`next.config.mjs` redirect for `/?favorites=`); AuthGate; `proxy.ts` public routes; metadata, OG image, apple icon; org auto-switch (`board.findOrg`, `BoardOrgSwitch`).
2. **Phase 2**: landing page (hero "Sketch it out, together", CSS-animated SVG demo with two fake users, six feature cards, CTA, footer); verified the landing JS has no Clerk/Convex/Liveblocks code.
3. **Phase 3**: board store layer, `/try`, personal workspaces, `/api/guest-board`, sign-in pop-up with `?intent=save|share` redirect, auto-save after sign-in.
4. **Security fix (owner said "Yes, fix it")**: plain-text editor for text/notes.
5. **Owner feedback**: sign-in pop-up worked but `/try` had no sign-out → added the account button there; implemented "Share with a team" (move personal board into an org).
6. **Removed the org icon strip**; logo routing decided (dashboard → home).
7. **Phase 4** required items, then (owner request) Excalidraw-style drag-to-create, shapes on top, outline shapes, and all optional items (arrows, export, images, comments, read-only links).
8. **Owner bug reports**: shapes flashed at default size before dragging (fixed: nothing appears until the pointer moves); text size grew with the box (fixed: fixed `fontSize`, box grows to fit); notes got a date.
9. **Notes**: fixed font size, date in the corner, shrink 2px then grow on overflow, size controls for text and notes.
10. **Note text over the date** (screenshot) → fixed with a separate date strip.
11. **Canvas UI redesign #1**: whiter canvas, Excalidraw-style left style panel (stroke, background, sloppiness via rough.js, edges, font, opacity, layers, actions), color picker.
12. **Redesign #2**: compact top toolbar with logo, menu+name/Share/sidebar top-right, Share dialog, right sidebar (search, library, comments), no scrollbar in the sidebar, share dialog animation from the right.
13. **Redesign #3**: export moved into the menu (Export image dialog), menu+name top-left, comment replies visible in the sidebar, zoom/undo flat pills bottom-left, "More tools" dropdown (hand, eraser, laser) with the temporary tool slot, full menu (open/save `.board`, command palette, find, help, reset, theme, canvas background), collaborator avatars with follow.
14. **Phase 5** + board phone layout from the owner's Excalidraw phone screenshot.
15. **Home page dark theme** (ThemeProvider moved to the root layout).
16. **Push**: owner committed `87e8188`, push hung for them; pushed on request (third try worked).
17. **Mobile touch fixes** (owner couldn't type, move shapes, and the canvas stopped working after a while): ghost-finger reset, `onPointerCancel`, drag inside selection bounds, 14px finger hit radius, 8px tap slop, tap-to-place-caret, keyboard primer, `plaintext-only` fallback. Owner committed as `1395208`.
18. **iPhone 15 Plus text/note bug** (Safari and Chrome: text invisible or offset from its box, not scaling with zoom, tap misses): WebKit foreignObject fix. Owner committed as `6b38c78`.
19. **Docs**: this `docs/` folder and `CLAUDE.md`.

### Session 2026-11-12 (Phase 6 + iPhone top bar)

1. **"Execute phase 6"**:
   - **Paginated lists and search**: `boards.get` replaced by `boards.list` (Convex `paginate`, 24 per page) and `boards.access`; the dashboard uses `usePaginatedQuery` with a "Load more boards" button that also loads by itself when scrolled near. Sorting moved to the server: new optional `boards.activityAt` / `titleKey`, indexes `by_org_activity` / `by_org_title`, kept up to date by `board.create`, `board.update`, `thumbnails.set`; `convex/migrations.ts` backfills old boards (run on dev: 17 boards). Sort menu hidden for favorites and search.
   - **Batch favorites**: one `by_user_org` read per page instead of one `userFavorites` lookup per board.
   - **Optimistic updates** rewritten for paginated results (`hooks/use-board-mutations.ts`).
   - **No full-screen auth spinner**: dashboard layout without `<AuthGate>` (shell + skeleton grid server-rendered, Clerk skeletons, list waits for `useConvexAuth` + `boards.access`); board layout uses `<AuthGate fallback={<Loading />}>` (the board skeleton).
   - **Selection net**: layers read once per drag; selection only set when it changes.
   - **React Compiler**: measured on two production builds, then turned on.
2. **Owner (mid-session): on an iPhone 15 Plus in Safari the menu and sidebar buttons at the top are half hidden** (screenshot). Cause: the canvas `<svg>` was `h-screen` (100vh), taller than the visible page on iPhones, so the page could scroll up under the status bar. Fixed with `h-full` + `overflow-hidden` on `<main>`, scroll lock on `<html>` too, and a scroll reset. Checked at phone size in the built-in browser (page height equals the viewport, nothing scrolls); **not yet confirmed on the real iPhone**.
3. Tested in the built-in browser with 30 throwaway boards (all deleted): paging 24 → 32, all four sorts, search, favorites, optimistic favorite/unfavorite, org workspace; selection net and drawing/typing on `/try` (dev and both production builds); a throwaway live board. Checks: both `tsc`, lint, `pnpm build` (in scratch copies).
4. **"Update the landing page"**: the page still showed the pre-redesign board (gray dotted canvas, toolbar on the left, filled shapes) and six early features. Redrew the animated demo to match today's canvas (see `06-dashboard.md`), rewrote the feature cards (nine, covering arrows, comments, images/export, personal boards, read-only links, guest mode, phone, dark mode, shortcuts), and updated the hero text and the site description (`lib/site.ts`). Checked light, dark and phone width; a production build confirms the landing page still sends no Clerk/Convex/Liveblocks/rough.js code.

## 5. Problems faced and how they were solved

| Problem | Cause | Resolution |
| --- | --- | --- |
| pnpm 12 install failed in CI dry-run | esbuild install script (Convex dependency) not approved | `allowBuilds: esbuild: true` in `pnpm-workspace.yaml` |
| A Liveblocks `sk_prod_` key printed into the session output | A commented-out line in `.env.local`; the "names only" filter only hid `NAME=value` lines | Owner advised to rotate the key and delete the line. Lesson: never cat env files; filter carefully |
| Org auto-switch: board loaded forever from a background tab | Clerk only persists `setActive` from a focused tab | `BoardOrgSwitch` waits for `document.hasFocus()` / focus event |
| Couldn't test signed-in pages | Built-in browser had no Clerk session | Owner signed in; rule: never sign them out |
| Guest Share/Save panel covered the Clear button on narrow screens | Layout | Labels collapse to icons below `sm` |
| HTML injection risk in text/notes | Values rendered as HTML (react-contenteditable) | `plain-text-editable.tsx`; old HTML converted to text safely |
| Owner couldn't reach the signed-out sign-in pop-up | `/try` had no sign-out | Account button on `/try` |
| Comment box lost focus right after opening | Focus handling during pointer events | Fixed during Phase 4 testing |
| Shapes flashed at default size before a drag | Pointer-down treated as a click | Draw only after the pointer moves |
| Text font grew with the box; first line cut off | Font size derived from box height | Fixed `fontSize` + auto-grow + top alignment on overflow |
| Note text ran over the date | Bottom *padding* isn't counted as overflow by the browser | Separate fixed strip for the date |
| Rename input lost focus when started from a menu | Radix returns focus to the trigger on close | Start rename in `onCloseAutoFocus` (`runAfterMenuClose`) |
| Purity lint error on `Date.now()` in the optimistic updater | React lint rule | Moved to module-level `addCreatingBoard` |
| Toolbar `useRef` lint error | React compiler lint rules on refs | `document.getElementById("canvas-image-input")` |
| Phone toolbar overflowed (426px > 373px) | Fixed-width buttons | Buttons `flex-1 min-w-0 max-w-11` |
| next-themes "script tag" warning; landing page half dark | ThemeProvider only in the `(app)` layout | Moved to the root layout |
| Test boards created in the wrong workspace | CLI identity lacked the active org | Use an identity with the `org_id` claim; all test boards deleted |
| `git push` hung twice | Large upload or a hidden credential window | Third attempt worked; `git push -v origin main` to diagnose |
| Touch: canvas stopped working after a while | Missed finger-lift left a ghost in `touches`, so every touch looked like a pinch | Clear on primary pointer down; `onPointerCancel` |
| Touch: couldn't move shapes, only resize | Had to hit the thin outline exactly | Drag anywhere inside selection bounds; 14px finger radius; 8px tap slop |
| Touch: couldn't type in new text | iOS opens the keyboard only for focus inside the tap; older iOS lacks `plaintext-only` (field became read-only) | Hidden input keyboard primer; `contenteditable="true"` fallback with plain paste; tap places caret |
| iPhone: text/notes misplaced, not zooming, taps miss | WebKit bug with styled HTML inside `<foreignObject>` (filter, shadow, opacity, position) | Paper/shadow as SVG rect behind; date in a flex strip faded with `color-mix`; outlines as SVG rects; no drop shadow on text |
| iPhone Safari: top buttons half hidden under the status bar | Canvas `<svg>` was `100vh`, taller than the visible page, so the page scrolled | `h-full` canvas, `overflow-hidden` on `<main>` and `<html>`, scroll reset in `use-disable-scroll-bounce.ts` |
| Production dashboard still showed the full-screen logo although dev showed the shell | In a production prerender `useSearchParams` / `use(searchParams)` suspend up to the nearest `<Suspense>`, which was the app layout's (logo fallback). Dev mode doesn't do this | Own `<Suspense>` with look-alike fallbacks around the page, the search box and the sidebar links. **Check server HTML on a production build, not on `pnpm dev`** |
| Paginated query can't say "token not ready" by returning `null` | `usePaginatedQuery` needs a page | `boards.access` query; the list is skipped until it is true |
| Old boards would sort wrong after adding sort keys | Existing documents have no `activityAt` / `titleKey` | `migrations:backfillBoardSortKeys` (dev done; production is an owner step) |
| Bash heredoc with an apostrophe failed again and half a command ran | Rule 10 | Scripts written with the Write tool, then run |
| Dev server slow for a few seconds after turning on the compiler | Next restarts and recompiles after a `next.config.mjs` change | Wait; pages load normally afterwards |

## 6. Open items / to verify

- **After deploying Phase 6 (owner, once)**: `npx convex run --prod migrations:backfillBoardSortKeys`, so older production boards sort correctly. Harmless to run twice.
- **Owner to confirm on iPhone 15 Plus (Safari)** that the menu and sidebar buttons at the top are fully visible now, also after typing in a text or note. The same screenshot showed text drawn outside its box ("So this is new nicee…"): still the open text/note item below.
- Phase 6 and the landing page update are **not committed** yet.
- Favorites and search results can't be sorted any more (see decisions); say so if that is missed.
- **Owner to confirm on iPhone 15 Plus** that text and notes now render, zoom and select correctly. If not: try light theme (the dark theme's page-wide invert filter could trigger the same WebKit bug) and opacity <100 (uses transparency).
- Real-device typing on phones (simulated touches can't confirm focus/keyboard).
- Rotate the Liveblocks `sk_prod_` key that leaked from a comment in `.env.local`, and delete that line (owner action, if not done yet).
- Read-only link that is turned off returns HTTP 200 "not found" instead of 404.
- The "Powered by Liveblocks" badge (bottom-right) slightly covers the sidebar's bottom corner when the sidebar is open.
- Exports use system fonts (Kalam/Inter/monospace only if installed).
- Phase 7 (see roadmap).

## 7. How to add a session entry

Append under section 4 a new `### Session YYYY-MM-DD` with numbered requests and results, add rows to section 5 for new problems, update the roadmap table in section 2 and the open items in section 6. Keep the "Last updated" date current.
