# 7. Development, CI and deployment

## Requirements

- Node.js **24** (`engines.node: 24.x`)
- pnpm **12.18** (pinned in `packageManager`; `pnpm-workspace.yaml` has `allowBuilds: esbuild: true`, needed because pnpm 12 blocks unapproved install scripts and Convex depends on esbuild)
- Windows 11 is the main dev machine (PowerShell and Git Bash).

## Environment variables

Never print or commit their values. `.env*.local` is git-ignored.

| Variable | Where | Purpose |
| --- | --- | --- |
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` (written by `npx convex dev`) | Convex **dev** deployment |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | `.env.local`, Vercel | Clerk (currently a *development* instance, also used in production) |
| `LIVEBLOCKS_API_KEY` | `.env.local`, Vercel | Liveblocks secret key, used by `/api/liveblocks-auth`, `/api/guest-board`, `/view/[token]` |
| `LIVEBLOCKS_SECRET_KEY` | Convex env vars (dev and prod) | `convex/liveblocks.ts` deletes rooms |
| `CONVEX_DEPLOY_KEY` | Vercel | `npx convex deploy` during the Vercel build |
| `ENABLE_EXPERIMENTAL_COREPACK=1` | Vercel | Lets Vercel use pnpm 12 |

Clerk setup: a JWT template named **`convex`** with `{ "org_id": "{{org.id}}", "org_role": "{{org.role}}" }`.

## Running locally

```bash
pnpm install
```

```bash
npx convex dev
```

```bash
pnpm dev
```

The dev server runs on port 3000 and uses `.next/dev`. **Don't delete `.next` while it runs**; build into a separate folder or a scratch copy instead.

Push Convex changes to the dev deployment only:

```bash
npx convex dev --once
```

Never deploy to the production Convex deployment by hand; production gets Convex changes through the Vercel build.

## React Compiler

`next.config.mjs` has `reactCompiler: true` (with the `babel-plugin-react-compiler` dev dependency): components are memoized at build time. The lint rules of `eslint-config-next` already check that code follows the compiler's rules. Measured in Phase 6 on production builds of `/try` with 100 layers (300 pointer moves, median of 7 runs): the selection net took about 360–460 ms with the compiler against 500–545 ms without (roughly a quarter less work per move); moving 100 selected layers was the same (about 2.4 s; that time is the store updates and the layers redrawing). Cost: client JavaScript +3.5% (1.68 MB to 1.74 MB uncompressed, all routes together), build about 3 s slower. To turn it off, remove the line.

## Checks (run all after a change)

```bash
npx tsc --noEmit
```

```bash
npx tsc -p convex/tsconfig.json --noEmit
```

```bash
pnpm lint
```

```bash
pnpm build
```

- `pnpm lint` has one known, accepted warning: `convex/auth.config.js` (anonymous default export).
- `next build` no longer runs lint (Next 16), hence the separate step.
- To build without touching the running dev server's `.next`, build a clean copy of the repo in a scratch folder with placeholder env vars (that's also what CI does).

## CI (`.github/workflows/ci.yml`)

On every push and pull request, with pnpm 12 and Node 24:
1. `pnpm install --frozen-lockfile`
2. `npx tsc --noEmit`
3. `npx tsc -p convex/tsconfig.json --noEmit`
4. `pnpm lint`
5. `pnpm build` with placeholder environment variables

## Deployment

- **Vercel**, build command `npx convex deploy --cmd 'npm run build'` (deploys Convex functions/schema to production, then builds Next.js with the production Convex URL).
- Repo: GitHub `Rahu09/drew_board`, branch `main`. Pushing `main` deploys.
- Production Convex needs `LIVEBLOCKS_SECRET_KEY`.
- Schema changes must stay backward compatible (new fields optional), because existing production documents are validated against the new schema at deploy.
- **One-time step after the Phase 6 deploy** (owner): boards created before Phase 6 have no sort keys. Fill them in on production once, after the Vercel deploy has finished:

  ```bash
  npx convex run --prod migrations:backfillBoardSortKeys
  ```

  It only adds `activityAt` and `titleKey`, is safe to run again, and was already run on the dev deployment.

## Testing approach

- No automated test suite yet (Playwright with `@clerk/testing` is planned for Phase 7).
- Changes are tested by hand in the Claude desktop built-in browser against `pnpm dev` (the user is signed in there; never sign them out). Touch is tested with simulated pointer events and phone-size viewports; real iPhone behavior has to be checked by the user on a device.
- Server rules can be tested with `npx convex run --identity '<json>' <function> '<args>'` against the dev deployment.
- Create throwaway test boards for testing and delete them afterwards. Don't touch the user's own "testing" / "Untitled" boards.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `pnpm install` fails on esbuild build script | pnpm 12 needs `allowBuilds: esbuild: true` in `pnpm-workspace.yaml` (already there) |
| Board keeps loading after an org switch from a background tab | Clerk only persists `setActive` from a focused tab; `BoardOrgSwitch` waits for focus |
| Dashboard briefly loading after switching org | `boards.access` is false until Convex gets the new token; expected |
| Old boards at the end of "Last edited" or the start of "Name" | Their sort keys are missing: run `migrations:backfillBoardSortKeys` on that deployment (see Deployment) |
| next-themes "script tag" warning, half-dark landing page | ThemeProvider must be in the root layout (it is) |
| `git push` hangs | Happened twice with a large push; retrying worked. `git push -v origin main` shows where it stops (maybe a hidden Git Credential Manager window) |
| Text/notes misplaced or unscaled on iPhone | WebKit foreignObject bug; keep the HTML inside `<foreignObject>` free of filter/shadow/opacity/position/transform (see [05-canvas.md](05-canvas.md)) |
| Canvas stops reacting to touch after a while | Ghost finger in the `touches` map; fixed by clearing it on primary pointer down |
| Root type check passes but Convex fails in production | `convex/` has its own tsconfig; always run the second `tsc` |
