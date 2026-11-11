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

## Scripts

- `pnpm dev`: development server
- `pnpm build`: production build
- `pnpm lint`: ESLint

## Deployment

Deployed on Vercel with the build command `npx convex deploy --cmd 'npm run build'`. Set `CONVEX_DEPLOY_KEY` and the variables above in the Vercel project, and `LIVEBLOCKS_SECRET_KEY` in the production Convex deployment.
