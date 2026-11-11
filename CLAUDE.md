# CLAUDE.md

Real-time collaborative whiteboard (Next.js 16 + Clerk + Convex + Liveblocks). Repo `Rahu09/drew_board`, branch `main`, deployed on Vercel.

## Before doing anything in a session

1. Read [docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md): working rules, roadmap and status, decisions, past problems and fixes, open items.
2. Read [docs/README.md](docs/README.md), then the doc for the area you'll touch:
   - [docs/01-overview.md](docs/01-overview.md): what the app is, glossary
   - [docs/02-architecture.md](docs/02-architecture.md): stack, folders, providers, security model
   - [docs/03-routes-and-flows.md](docs/03-routes-and-flows.md): routes, sign-in, guest, sharing, org switch
   - [docs/04-data-model.md](docs/04-data-model.md): Convex tables/functions, Liveblocks storage/presence, layer types
   - [docs/05-canvas.md](docs/05-canvas.md): canvas, store layer, modes, touch/phone, WebKit rules
   - [docs/06-dashboard.md](docs/06-dashboard.md): dashboard, thumbnails, optimistic updates, theme
   - [docs/07-development-and-deploy.md](docs/07-development-and-deploy.md): setup, env, checks, CI, deploy

## Rules (short version; details in PROJECT_HISTORY.md)

- Phases go in order; don't start the next phase until the owner says so.
- After changes run: `npx tsc --noEmit`, `npx tsc -p convex/tsconfig.json --noEmit`, `pnpm lint`, `pnpm build`; then test in the built-in browser against `pnpm dev` (port 3000). Never sign the owner out.
- Convex: `npx convex dev --once` (dev only). Never touch the production Convex deployment directly.
- Don't delete `.next` while the dev server runs; build in a scratch copy instead.
- Don't commit or push unless asked. Never print secret values (`.env.local`, env vars).
- Known lint warning `convex/auth.config.js` (anonymous default export) is fine.
- Don't touch the owner's own boards; delete test boards you create.
- New layer fields stay optional; `LayerType` is append-only.
- Keep HTML inside SVG `<foreignObject>` (text, notes) free of filter, shadow, opacity, position and transform (WebKit/iPhone bug).

## At the end of a session

Update [docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md) (new session entry, problems and fixes, roadmap status, open items) and any doc whose area changed.
