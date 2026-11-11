# Board documentation

Everything you need to understand what this project does, how it is built and why it is built that way.

Start with the overview. If you are picking up work (human or AI), also read [PROJECT_HISTORY.md](PROJECT_HISTORY.md): it records the decisions, the work done so far, the problems hit and how they were solved, and the rules for working on this repo.

| File | What it covers |
| --- | --- |
| [01-overview.md](01-overview.md) | What the app is, who it is for, the main features, a glossary |
| [02-architecture.md](02-architecture.md) | Stack, folder layout, providers, how the services fit together, security model |
| [03-routes-and-flows.md](03-routes-and-flows.md) | Every route and the main user flows (sign-in, guest, saving, sharing, read-only links, org switching) |
| [04-data-model.md](04-data-model.md) | Convex tables and functions, Liveblocks storage and presence, file storage, layer types |
| [05-canvas.md](05-canvas.md) | The canvas: store layer, modes, tools, rendering, styles, text, touch and phone layout, export, shortcuts |
| [06-dashboard.md](06-dashboard.md) | Dashboard: board list, thumbnails, optimistic updates, rename, sorting, theme, landing page |
| [07-development-and-deploy.md](07-development-and-deploy.md) | Local setup, env vars, scripts, checks, CI, deployment, troubleshooting |
| [PROJECT_HISTORY.md](PROJECT_HISTORY.md) | Roadmap and status, decisions, change log, problems and fixes, working rules, open items |

The root [README.md](../README.md) is the short user-facing summary (setup, routes, controls, shortcuts table).

## Keeping these docs current

- When a feature changes, update the file that describes it.
- After every working session, add an entry to [PROJECT_HISTORY.md](PROJECT_HISTORY.md): what was asked, what was decided, what changed, problems and fixes, and what is still open.
