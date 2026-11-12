# 8. Phase 7: production readiness (planned, not implemented)

**Status:** deliberately not built yet. This file records what Phase 7 would contain, how each part would be done in *this* codebase, what it would buy, what it costs, and how to talk about it. It is written so the project can be explained in an interview: "here is what I would do next and why."

Costs and free-tier limits below are from memory and **must be checked against each vendor's current pricing page** before relying on them.

## The one-paragraph pitch

The app works and is deployed, but it is still running like a demo: sign-in goes through Clerk's *development* instance, nobody is told when something breaks for a user, there are no numbers about real usage, and the only automated checks are type-check, lint and build. Phase 7 closes those four gaps: **a production Clerk instance, error monitoring (Sentry), usage and performance analytics (Vercel), and end-to-end tests (Playwright) in CI.** None of it adds a feature. All of it moves the project from "works on my machine and for testers" to "safe to hand to real users and to change without fear."

## Summary table

| Part | Problem today | What changes | Main benefit | Needs |
| --- | --- | --- | --- | --- |
| Clerk production instance | Real users sign in through a development instance (usage limits, a warning in the browser console, shared dev domain, dev and prod users mixed in one place) | Separate production Clerk instance on your own domain; live keys; Convex trusts the production issuer | Safe to launch publicly, your own branded sign-in, no dev limits, dev and prod data separated | A domain name |
| Sentry | Failures are only found when someone tells us (the iPhone text bug was found by the owner's own phone) | SDK in the Next.js app captures errors with browser, page and release | Know about bugs before users report them, with a stack trace | Free Sentry account |
| Vercel Analytics and Speed Insights | No data on visits, pages used, or how fast pages are on real devices | Two small components in the root layout | Evidence for decisions, real Core Web Vitals instead of numbers from one dev machine | Vercel project (already have) |
| Playwright e2e in CI | Sign-in, creating, sharing, drawing are only tested by hand each session | Automated browser tests run on every pull request | Catch regressions before deploy; refactor with confidence | Test users, CI secrets |

Suggested order: **Playwright, Sentry, Analytics, then Clerk production** (the domain-dependent step last, since the others need nothing). Clerk production is the only one that is a hard blocker for a real public launch.

---

## 1. Clerk production instance

### Today
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are a development instance's keys (`pk_test_`, `sk_test_`), also used by the Vercel production deployment.
- `convex/auth.config.js` hard-codes the development issuer (`https://maximum-bream-63.clerk.accounts.dev`) with `applicationID: "convex"`. Convex validates every token against it.
- The browser console prints "Clerk has been loaded with development keys…" on every page.

### What would be done
1. **Buy a domain** and attach it to the Vercel project (also set `NEXT_PUBLIC_APP_URL` so metadata and the Open Graph image use it, see `lib/site.ts`).
2. In the Clerk dashboard **create the production instance**, which asks for the domain and gives DNS records (a Frontend API subdomain such as `clerk.<domain>`, plus mail records). Add the records at the domain registrar and wait for verification.
3. In the production instance **recreate the JWT template named `convex`** with `{ "org_id": "{{org.id}}", "org_role": "{{org.role}}" }` (the template is per instance; `convex/access.ts` depends on `org_id`), and re-enable Organizations and the sign-in methods. Social logins (Google, GitHub) need their own OAuth credentials in production; Clerk's shared dev credentials do not carry over.
4. **Make the Convex issuer configurable instead of hard-coded.** Change `convex/auth.config.js` to read `process.env.CLERK_JWT_ISSUER_DOMAIN` and set that variable on the dev deployment (the current dev URL) and on the production deployment (the new `https://clerk.<domain>`). One file then serves both without edits at deploy time. This also keeps the rule "never touch the production Convex deployment by hand": production picks up the change through the Vercel build (`npx convex deploy`).
5. **Swap the keys in Vercel's Production environment** to `pk_live_` / `sk_live_`; keep the test keys in Preview and Development.
6. **Migrate existing data deliberately.** Boards are keyed by Clerk ids (`authorId`, `lastEditorId`, `userFavorites.userId`, personal workspaces `user:<id>`, org ids). Production instance users get *new* ids, so existing boards would no longer belong to anyone. Options: (a) start production clean (fine while there are only test users), or (b) export users from the dev instance and import them (Clerk supports user import and keeping external ids is limited), then remap ids in Convex with a one-off migration like `convex/migrations.ts`. Decide this before launch, not after.
7. Smoke test: sign up, create an org, invite a member, open a board link of another org (the auto-switch flow), guest board saved after sign-in.

### Benefits
- **Launch-ready:** development instances have strict usage limits and are not meant for production traffic.
- **Trust and branding:** sign-in on your own domain, your own emails, no vendor test domain in front of users.
- **Separation:** test users and experiments no longer share a user pool with real people.
- **Security hygiene:** live keys live only in the Production environment; leaking a dev key no longer endangers production.

### Risks and what to say about them
- The JWT template is easy to forget; symptom is Convex rejecting everything or `org_id` missing (boards load as "not found"). The smoke test in step 7 catches it.
- Switching issuers invalidates existing sessions: everyone signs in once more.
- DNS verification can take time; plan the cut-over for a quiet moment.

### Interview answer
"We ran on Clerk's development instance, which is fine to build on but has usage limits and shares a domain. For launch I'd create a production instance on our own domain, recreate the `convex` JWT template, make the Convex auth issuer an environment variable so dev and prod share one config file, and plan the user-id migration up front because every board references Clerk ids. The benefit is we can take real traffic and keep dev and prod users separate."

---

## 2. Sentry (error monitoring)

### Today
Errors in the browser or on the server are invisible unless a user reports them. Real examples from this project: the iPhone foreignObject bug (text misplaced) and touch problems were found only because the owner tested on a phone.

### What would be done
1. `npx @sentry/wizard@latest -i nextjs` (or add `@sentry/nextjs` by hand). It creates `instrumentation.ts` / `instrumentation-client.ts` (client, server, and edge runtime for `proxy.ts`), wraps `next.config.mjs` with `withSentryConfig`, and adds `app/global-error.tsx` to report React render errors.
2. **Environment variables:** `NEXT_PUBLIC_SENTRY_DSN` (public by design), and `SENTRY_AUTH_TOKEN` (secret, build time only, in Vercel, used to upload source maps so stack traces show real file names and lines).
3. **Release tracking:** tag errors with the Vercel git commit so each error says which deploy introduced it.
4. **Sampling:** capture all errors; performance tracing at a low sample rate (for example 10%) to stay inside the free quota. Session replay is optional and off by default for privacy.
5. **Privacy:** this app holds users' drawings and board titles. Configure `beforeSend` to strip anything that could contain board content (URLs of `/view/<token>` share links are secrets, so scrub them from breadcrumbs and request URLs), and send only the Clerk user id, never name or email. Do not log Liveblocks storage.
6. **Useful extras here:** report failures of the Convex mutations that already show a toast ("Failed to create board" etc. in `use-board-mutations.ts`), the `/api/guest-board` 502 path (the half-saved board cleanup), and `/api/liveblocks-auth` denials. Add a tag for `isPhone` / user agent so mobile-only bugs stand out.
7. **Alerts:** an email or Slack alert for a new issue or a spike after a release.
8. Do **not** let Sentry's browser SDK into the landing page bundle if it hurts the "no auth/data JS" rule; the landing page is static and server-rendered. Measure the bundle (`page_client-reference-manifest.js`) before and after; load the client SDK lazily if needed.

### Benefits
- Find bugs **before** users complain, with browser, OS, page and stack trace.
- Know which **release** broke something, and roll back with evidence.
- Group duplicates so one noisy bug is one issue, not a hundred emails.
- Cheap to start: a free tier covers a small app (verify the monthly event limit).

### Risks
- Extra client JavaScript (a few tens of KB compressed; measure it).
- Noise: browser-extension errors and bots; use `ignoreErrors` and an allowed-URLs list.
- Privacy if configured carelessly (see step 5).

### Interview answer
"I'd add Sentry with source maps and release tracking so every error says which commit caused it, scrub board content and share-link tokens before sending, and alert on new issues. Concretely it would have caught the iPhone Safari rendering bug without anyone having to notice it on a phone."

---

## 3. Vercel Analytics and Speed Insights

### Today
There are no numbers on visits, which pages are used, or how fast pages are for real people. The Phase 6 performance measurements (selection net, React Compiler) were taken on one development machine.

### What would be done
1. Enable Analytics and Speed Insights in the Vercel project settings.
2. `pnpm add @vercel/analytics @vercel/speed-insights`, then render `<Analytics />` and `<SpeedInsights />` once in `app/layout.tsx` (client components that load a small script; the landing page stays light).
3. Optional **custom events** for the product funnel, with no personal data: `try_started`, `guest_saved`, `board_created`, `board_shared`, `table_created`. These show whether the guest-to-account path actually converts, which was the point of Phase 3.
4. Add a short note to a privacy page: Vercel Analytics is cookieless, but say what is collected.

### What it tells us
- **Visits and top pages**, referrers, device split (is the phone layout worth the effort?).
- **Core Web Vitals on real devices** (LCP, INP, CLS): checks the Phase 2 and Phase 6 claims ("fast landing page", "no spinner") against reality and by route, so a regression on `/board/[id]` shows up.
- **Funnel:** landing, `/try`, sign-in, saved board.

### Benefits
- Decisions backed by data (what to build or fix next).
- Real-user performance, not lab numbers.
- Almost no work and no cookies banner needed (confirm for your jurisdiction).

### Risks
- Free allowance limits and retention are plan dependent (verify).
- Adblockers hide some visitors, so counts are a floor.

### Interview answer
"Analytics because performance work needs real-user evidence. I measured the selection net and the React Compiler locally; Speed Insights would tell me whether real phones see the same, and a couple of custom events would show whether guest users actually sign in and save."

---

## 4. Playwright end-to-end tests with `@clerk/testing`, run in CI

### Today
CI (`.github/workflows/ci.yml`) runs type-check (app and Convex), lint, and build. Whether sign-in, creating a board, drawing or sharing *works* is verified by hand in each session. A broken flow can reach production if the types and build are fine.

### What would be done
1. **Tooling:** `@playwright/test` and `@clerk/testing`. `@clerk/testing` handles Clerk's bot protection in automated browsers (a testing token) and can sign a test user in programmatically, so tests never type a password through the real UI.
2. **Test environment:** a separate Clerk *test* instance (the current development instance can serve) with a dedicated test user and test organization, and a Convex **dev** deployment (never production). Secrets in GitHub Actions: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, test user credentials, Convex URL, Liveblocks key.
3. **Global setup** calls `clerkSetup()` once; tests call `setupClerkTestingToken({ page })` and sign in with the `clerk` helper, saving the signed-in state to a file so each test starts logged in.
4. **First tests (smoke set, fast and valuable):**
   - Landing page renders, has the two calls to action, and `/` ships no Clerk/Convex/Liveblocks code (assert on network requests).
   - `/try`: draw a rectangle, reload, it is still there (local storage); sign-in prompt appears on Save.
   - Signed in: create a board, rename it inline, favorite it, search for it, delete it (and assert that the card disappears and a "Board not found" page appears for the old URL).
   - Board: draw, undo, redo; add a table, type `=1+2` in a cell, expect `3`; export dialog opens.
   - Sharing: create a read-only link, open `/view/<token>` in a fresh browser context (no session), assert it renders and is not editable; turn the link off.
   - Access control: a second user cannot open the first user's personal board (the server rules in `convex/access.ts`).
   - **Realtime:** two browser contexts open the same board; a shape drawn in one appears in the other. This is the heart of the product and the hardest to test by hand.
5. **CI job:** a second job in `ci.yml` (or a separate workflow) that installs browsers (`npx playwright install --with-deps chromium`), builds, starts the app (`next start`), runs tests, and uploads the Playwright report and failure traces as artifacts. Run Chromium on every pull request and add WebKit (Safari engine) nightly, since the project's worst bug was WebKit-only.
6. **Data hygiene:** tests create boards with a recognizable prefix and delete them afterwards; a nightly cleanup removes strays (the same rule as the manual "delete test boards you create").
7. **Keep it fast and not flaky:** a handful of focused tests, `test.describe.parallel` where independent, web-first assertions (auto-waiting) instead of sleeps, retries only in CI.

### Benefits
- **Regression safety:** a change to the canvas, auth or Convex rules is checked against real flows before deploy.
- **Confidence to refactor** (Phase 6 changed pagination, optimistic updates and layouts; this would have verified them automatically).
- **Documentation by example:** the tests describe how the product is supposed to behave.
- **Security rules get a test:** access control and share links are checked continuously, not once.

### Risks and trade-offs
- Maintenance cost, and flaky tests if written with timeouts or tied to markup details. Mitigation: stable `aria-label` / role selectors (the app already has many), few but meaningful tests.
- Canvas drawing is pointer-event heavy; use dispatched pointer events or `page.mouse` with fixed viewport sizes.
- Needs secrets and a dedicated test tenant; never point tests at production data.
- CI time grows; keep the smoke set under a few minutes.

### Interview answer
"Right now CI proves the code compiles, not that the product works. I'd add Playwright with `@clerk/testing` so tests sign in without the UI, covering the money paths: guest drawing, create/rename/favorite/delete, a read-only share link opened without a session, an access-control check, and a two-browser realtime test. They run on every PR against a Convex dev deployment, with WebKit nightly because our worst bug was Safari-only. The benefit is I can refactor, like the pagination change, and know the flows still work."

---

## Definition of done for Phase 7

- [ ] Production Clerk instance on the project's domain; `convex/auth.config.js` reads the issuer from `CLERK_JWT_ISSUER_DOMAIN`; Vercel Production uses live keys; console warning gone.
- [ ] A decision recorded on what happens to existing dev users and boards.
- [ ] Sentry receiving client and server errors with readable stack traces and release names; share-link tokens and board content scrubbed; one alert rule.
- [ ] Analytics and Speed Insights showing data; funnel events (no personal data) in place.
- [ ] Playwright smoke suite green in CI on every pull request, with report artifacts, plus WebKit nightly.
- [ ] `07-development-and-deploy.md` (env vars, CI, testing approach) and `PROJECT_HISTORY.md` updated; this file's status changed from "planned" to "done".

## Cost summary (verify before quoting)

| Item | Cost |
| --- | --- |
| Domain name | The one definite cost: roughly $10–15 per year for a `.com` |
| Clerk production | Free plan exists, but it requires a domain |
| Sentry | Free plan with a monthly error limit |
| Vercel Analytics, Speed Insights | Free allowance on the Hobby plan |
| Playwright, `@clerk/testing` | Free software; GitHub Actions minutes are free for public repositories, allowance-based for private ones |

Beyond the free tiers: Vercel's Hobby plan is for non-commercial use, so earning money from the app would require a paid plan.

## Questions an interviewer might ask, with short answers

- **Why not do this before building features?** Features proved the product; production work only pays off once something is worth protecting. It was ordered last on purpose, and the plan is written down.
- **What would you do first?** Playwright smoke tests: they need no domain and make every later change safer. Sentry second. The Clerk switch is the launch blocker, so it comes right before going public.
- **What is the riskiest part?** The Clerk user-id migration, because every board references Clerk ids. Decide clean-start versus import before cutting over.
- **How do you keep secrets safe?** Different keys per environment in Vercel and GitHub secrets, only public keys prefixed `NEXT_PUBLIC_`, `SENTRY_AUTH_TOKEN` build-time only, and never printing env files (a real incident in this project's history, recorded in `PROJECT_HISTORY.md`).
- **How do you know the monitoring is not leaking user data?** Scrub in `beforeSend`, send ids not emails, strip share-link tokens from URLs, review the first events by hand.
- **What would you measure to know it worked?** Fewer user-reported bugs than Sentry-detected ones, time from deploy to detecting a regression, Core Web Vitals trend per route, and the test suite catching at least one regression before production.
- **What would you not do?** Add every tool at once. Each part is independently shippable, so each can be done, verified and documented on its own.
