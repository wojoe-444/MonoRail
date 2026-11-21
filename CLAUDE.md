# CLAUDE.md

MonoRail is a Windows desktop workspace for agents, developer tools and data
catalogs. The app is in [apps/command-hub](apps/command-hub): React, TypeScript,
Vite, Tailwind, shadcn/ui and Electron. The owner reviews the Windows installer
locally, so keep `npm run dist:win` working.

## Private data and compatibility

- This repository is public. Keep settings, credentials, emails, run history
  and logs out of the checkout. Use fictional samples. Review the final diff
  for personal data and keep the secret exclusions in `.gitignore`.
- Use the [profile layout](docs/profiles.md) for private data. Give each data
  folder a scope in `electron/profiles/index.cjs`. Use `ctx.dataDir` for a
  backend's own folder and `ctx.layout.folder(...)` or `appLayout()` to reach
  other scoped folders. Use `src/lib/prefs.ts` for per-profile UI preferences.
  Profiles organize local data and share the same OS account.
- Preserve backward compatibility with existing installations.
  `electron/userData.cjs` opens the first existing data-bearing folder in
  this order: `MonoRail`, `MonoHub`, `command-hub`, `Command Hub` in
  `%APPDATA%`. If none holds data, use the first existing folder or
  `MonoRail` on a clean machine. Leave folders in place and get the resolved
  root through `app.getPath('userData')`.
- Keep the installer `appId` (`dev.monorail.commandhub`), npm package name
  (`command-hub`), GitHub publish destination (`wojoe-444/MonoRail`), and
  `latest.yml` stable. Keep `window.commandHub`, `CommandHubBridge` and
  existing `commandHub.*` storage keys stable. Keep the legacy Tasks
  identifiers and data paths in the [GitHub+ and Tasks reference](docs/contributing/git-workspace.md#tasks).
- Treat damaged user files as errors. Keep the last usable data when a write
  fails. [Local database](docs/local-database.md) migrations are additive and
  require a backup before upgrading a database with rows.
- Debug first-run behavior with [Developer Mode's New User profile](docs/profiles.md#new-user-developer-modes-test-profile).
  Only that profile's folder is reset. Creating a profile copies data only at
  the user's request, item by item.

## Commands

Run these in `apps/command-hub/` with Node 22 as in CI.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install locked dependencies |
| `npm run dev` | Vite browser preview with fictional data |
| `npm run dev:browser` | Browser at localhost:5199 with a token-guarded Electron bridge and a separate dev data folder |
| `npm run desktop` | Electron and Vite with hot reload |
| `npm run desktop:prod` | Build and open the desktop app |
| `npm run lint` | Run oxlint with warnings treated as failures |
| `npm test` | Run backend and frontend tests |
| `npm run test:backend` | Run the Node tests under `electron/` |
| `npm run test:frontend` | Run Vitest unit tests under `src/` |
| `npm run build` | Type-check and build the renderer to `dist/` |
| `npm run dist:win` | Build `release/MonoRail-Setup-<version>.exe` |
| `npm run dist:win:portable` | Build a portable executable without self-updates |

[CI](.github/workflows/ci.yml) runs checks and builds the Windows installer.
Pushes to `main` publish from CI as `<major>.<minor>.<run number>`. Set
major/minor in the app's `package.json` and leave publishing to CI. See
[updates and release notes](docs/contributing/desktop-shell.md#updates-and-release-notes).

Keep the React lint rules active. Explain a necessary local exception
and name its rule. Fast Refresh exceptions in `.oxlintrc.json` name the
individual helper exports and their files.

Follow the [PR template](.github/pull_request_template.md). For changes users
will notice, use `## What's new` with `- **Short title**: one plain sentence`
per change. These bullets ship in public release notes and in the app. Keep
personal paths, names, test-user details and implementation terms out of
them. Omit the section for changes users will not notice.

## App and backend architecture

Paths in this section are relative to `apps/command-hub/`.

- `src/components/layout/` owns the shell. `nav.ts` assembles navigation.
  `src/lib/router.ts` uses hash routing so routes work under Electron's
  `file://`. Keep existing route URLs working.
- `src/modules/` holds built-in pages. Export a lazy `ModuleDefinition`
  from `src/modules/<id>/index.ts` and add it to `src/modules/registry.ts`.
  Put its optional backend in `electron/modules/<id>.cjs` and register
  `{ id, methods }` in `electron/modules/index.cjs`.
- `src/apps/` holds Workspace and full-screen apps. Export a lazy
  `AppDefinition` and register it in `src/apps/registry.ts`. Give it
  `/apps/<id>`, own its route prefix, and scope CSS to the app root.
  Register backends in `electron/apps/index.cjs`. Keep the host's
  [full-screen exit bar](docs/contributing/desktop-shell.md#workspace-and-full-screen-apps)
  visible.
- Access backends with `useModuleQuery`, `invokeModule` or `invokeApp`.
  Declare built-in methods, payloads and results in `src/ipc/modules.ts`
  or `src/ipc/apps.ts`. The phone policy and registry tests enforce
  matching method names.
  Keep the sandboxed preload bridge narrow. Use fictional data when Vite
  runs without a backend. The separate browser bridge carries backend calls
  and events. Extension pages require Electron's `monorail-ext://` scheme.
- Add actions that need this PC's screen (dialogs, Explorer, terminals,
  DevTools, restart or opening external links) to the backend's
  `desktopOnly` list. Use `hasLocalScreen()` in the renderer. Classify every
  built-in backend method in `electron/remote/policy.cjs` (`REMOTE_METHODS`).
  Keep desktop-only actions and methods that change secrets, permissions,
  accounts or MonoRail itself on the PC. The server requires an explicit
  phone classification. [Remote access](docs/remote-access.md) is optional,
  off by default and tailnet-only.
- Declare backend data files in `electron/cache/declared.cjs` with policy,
  tier and version. Use the [shared cache](docs/caching.md) with atomic
  writes, one build at a time and backoff. Opening a page reads the cache.
  Refresh or the scheduler builds it. Home reads small summaries. Show
  freshness using `CacheStatusBadge`.
- Backends may export `start(ctx)`. Register background work with
  `electron/scheduled/in-app.cjs` so it appears in Scheduled > In-App.
  List the job from existing state. Expose Run now only for jobs safe to
  start by hand. Register global backup items in `electron/backups/global.cjs`
  using the [backup contract](docs/backups.md).
- Use [Connections](docs/contributing/connections.md) for account setup and
  credentials. An unconfigured connector performs no checks or probes.
  Keep credentials in the main process, encrypt stored secrets and refuse
  to save them if encryption is unavailable.
- [Agent access](docs/mcp.md) is stdio-only. Read existing stores without
  copying private content. New write tools require per-agent consent
  (`write: true`) and an audit summary (`ctx.did()`). Extension tools need
  consent whether they read or write. Keep arguments and results out of logs.

## Feature references

Use the [developer reference index](docs/contributing/README.md) to find code
paths, compatibility rules and detailed behavior.

- [Desktop shell](docs/contributing/desktop-shell.md) covers navigation,
  Settings, command palette, onboarding and scheduled jobs. New Settings
  cards/options need a target in `src/modules/settings/search.ts`.
- [Agent Chat](docs/contributing/agent-chat.md) covers real-path repo checks,
  Claude and pi workers, permissions, spending and Coordinator. All turn
  callers go through the shared checks. Preserve the refusal of permission
  bypass and agent access to out-of-scope folders.
- [Agent usage and catalog](docs/contributing/agents.md) covers cost
  accounting, available agent definitions and Mochi. See also [Flows](docs/flows.md).
- [GitHub+ and Tasks](docs/contributing/git-workspace.md),
  [Workspace tools](docs/contributing/workspace-tools.md) and
  [Tracker](docs/tracker.md) document the apps and their local storage.
- The [MonoRail standard](docs/standard/README.md) defines all entity types
  in `src/standard/standard.json`. Preserve OpenMetadata names, meanings and
  values. Put additions in `extension` and document enum additions separately.
  Every type appears in Explore and has a generated Wiki field table.
  Run `node scripts/standard-docs.cjs` from the app after changing the
  standard. See [OpenMetadata](docs/contributing/openmetadata.md) for catalog
  routing, search, lineage and schema refresh.
- See [ingestion](docs/ingestion.md), [BigQuery metadata](docs/bigquery-metadata.md),
  [Malloy](docs/malloy.md), [MetricFlow](docs/semantic.md) and
  [Docker](docs/docker.md) for their storage, opt-in and execution contracts.

## Extensions

Use extensions for user- or situation-specific features. See the
[extension author docs](docs/extensions/README.md) for the manifest, routes,
page API, backend hooks, permissions and testing. Keep the extension frame
on its own origin and the backend in its permission-scoped child process.
`electron/extensions/runner.cjs` is self-contained and unpacked from the
asar. The sandbox can read only that app file. Treat process permission as
full trust and require consent when permissions grow.

`packages/extension-sdk/` owns the API files copied into extension repos.
Keep the manifest, backend context, bridge and SDK in step with
`API_VERSION`. Bump minor for additions and major for breaking changes.
Update reference docs with contract changes. Run
`node packages/extension-sdk/sync.mjs` from the root after editing the
SDK or design tokens. Tests check the copies.

The [sample extension](extensions/hello-monorail/README.md) builds `ui/`
locally and in CI. In its folder, run `npm ci`, `npm test` and
`npm run pack`. Build before loading a development folder in MonoRail.
Keep generated `ui/` and release ZIPs out of Git.

## Wiki and diagrams

- Every `docs/**/*.md` page starts with `audience: human`, `audience: ai`
  or `audience: human, ai` in front matter and has an H1. Add `summary:`
  for previews and `folder:` to label a folder index.
- Use relative Markdown links to related pages and headings. Link new pages
  from their folder's `README.md` and from relevant existing pages. The
  Wiki follows these links offline and shows backlinks. Keep each guide
  linked to at least four other pages.
- Update [user guides](docs/guide/README.md) with user-visible features. Keep
  code contracts and deep dives in AI reference pages. Run
  `node --test electron/docs.test.cjs` from the app to verify links, anchors,
  audience and `openWiki(id, anchor)` targets.
- For BPMN 2.0 or DMN, read `AGENTS.md` in `wojoe-444/MonoRail-Diagrams`
  (usually in `~/Repos/MonoRail-Diagrams`) before drawing. Ask for access
  if it is unavailable. Place diagrams in `docs/diagrams/<process>/` and
  link any accompanying Markdown in the Wiki.

## UI rules

- Use the owned shadcn/ui primitives and the existing [design system](docs/contributing/design-system.md).
  Match the Bot Dashboard in `wojoe-444/MC-Player` (`dashboard/web`).
  Keep shadcn/ui as the sole component library.
- Use tokenized colors, Inter Variable and the Cascadia Mono/Consolas
  stack. JetBrains Mono is banned across the app and extension theme.
  Keep layout on the 8px grid, use `PageHeader` and share `SaveBar` for
  draft forms. Review light/dark and a dark-drawer palette.
- Use `src/components/charts/` with fixed series colors, consistent
  ranking across filters, one axis, a legend for multiple series and
  a table view. Favor thin marks and one main figure per page.
