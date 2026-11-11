# CLAUDE.md

Guidance for Claude (and anyone else) working in this repository.

## What this project is

**MonoRail** is a desktop app for managing agents. The agent definitions
it manages are stored in this repository (`wojoe-444/MonoRail`) under
`agents/`. The app itself lives in `apps/command-hub/`: React 19 + Vite +
TypeScript + Tailwind CSS v4 + shadcn/ui, wrapped in Electron so it ships as a
Windows `.exe`.

The owner reviews changes by running the `.exe` locally, so keep
`npm run dist:win` working and treat "it builds and opens as an .exe" as part
of done.

### Formerly "Command Hub" (then "MonoHub"): names that must not change

The app was renamed from Command Hub to MonoHub, then to MonoRail to match
the repo. Installed copies update
themselves in place, so a few internal names keep the old spelling on
purpose. Changing any of them breaks updates or strands the user's data:

- `appId` `dev.monorail.commandhub` (electron-builder.json): the installer's
  identity. A new appId installs a second app instead of upgrading.
- `"name": "command-hub"` (package.json): sets the install folder
  (`%LOCALAPPDATA%\Programs\command-hub`) and the updater cache folder.
- The `publish` block (GitHub releases of `wojoe-444/MonoRail`) and the
  `latest.yml` asset name. Installer asset names may change, because the
  updater finds the installer through `latest.yml`.
- `window.commandHub`, `CommandHubBridge` and the `commandHub.*`
  localStorage keys are internal and were left as they are.

`electron/userData.cjs` runs before the app is ready and moves the old
data folder (`%APPDATA%\MonoHub`, or before that `%APPDATA%\command-hub`;
whichever holds data, newest name first) to `%APPDATA%\MonoRail` once, as a
whole: safeStorage's key is in that folder's `Local State`, so never move
only `modules/`. If the move fails it keeps using the old folder.

## The one hard rule: private data stays in AppData

**This repository is public.** Never commit private or user-specific data:
API keys, tokens, passwords, emails, personal settings, run history, logs, or
anything copied from the user's machine.

- At runtime that data lives in local AppData. In Electron, use
  `app.getPath('userData')` (on Windows `%APPDATA%\MonoRail`). Do not
  invent other locations, and never write it inside the repo folder.
- Sample or demo data in the repo must be fictional (see
  `apps/command-hub/src/data/sample.ts`).
- The root `.gitignore` blocks common secret files (`.env*`, `AppData/`,
  `secrets/`, `*.local.json`, keys, certificates). Do not weaken those rules.
  If a new kind of private file appears, add a rule for it.
- Before committing, check `git status` and the diff for anything personal.

## Commands

Run from `apps/command-hub/`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server in the browser |
| `npm run desktop` | Electron window pointed at the dev server (hot reload) |
| `npm run build` | Type-check and build the web bundle to `dist/` |
| `npm run lint` | oxlint |
| `npm test` | Node tests for backends (`electron/**/*.test.cjs`) |
| `npm run dist:win` | Build the installer `release/MonoRail-Setup-<version>.exe` |
| `npm run dist:win:portable` | Build a portable `.exe` (cannot self-update) |

CI (`.github/workflows/ci.yml`) builds and lints on every PR and produces the
installer on a Windows runner as a downloadable artifact. On every push to
`main` it stamps the version as `<major>.<minor>.<run number>` and publishes a
GitHub release; the Settings page (`modules/settings`, backed by
`electron-updater`) checks those releases and installs updates in place. Bump
major/minor in `package.json` by hand; never publish from a local machine.

## Code layout (`apps/command-hub/src`)

- `components/ui/` shadcn/ui primitives. These are owned source, edit freely.
  Add new ones in the same style (Radix primitives from `radix-ui`, `cva`,
  `cn()`); the shadcn CLI registry may not be reachable from every
  environment.
- `components/layout/` app shell: `SideNav`, `TopBar`, `PageHeader`, and
  `nav.ts` (the single list of navigation items).
- `pages/` built-in pages (Home and placeholders).
- `modules/` feature modules (see below). `modules/registry.ts` lists them.
- `apps/` full-screen apps (see below). `apps/registry.ts` lists them.
- `extensions/` the renderer half of installed extensions (store, frame host, contributions).
- `components/charts/` data-viz primitives: series palette, `StatTile`,
  `Legend`, `ChartTooltipContent`. Charts use Recharts.
- `lib/router.ts` tiny hash router (`useRoute`, `navigate`); hash routes work
  with Electron's `file://` loading.
- `data/` fictional sample data only.
- `index.css` all design tokens (light and dark).

## Modules: the main building block

New features ship as **modules**. A module owns one nav entry, one route, one
page and, optionally, a backend that reads local data in the Electron main
process. The contract is `ModuleDefinition` in `src/modules/types.ts`.

To add a module:

1. `src/modules/<id>/index.ts` exports a `ModuleDefinition` (id, title,
   description, icon, `path`, `nav.section`, lazy `component`).
2. Add it to `src/modules/registry.ts`. The nav, router and top bar pick it up.
3. If it needs local data, write `electron/modules/<id>.cjs` exporting
   `{ id, methods: { name: async (ctx, args) => result } }` and add it to
   `electron/modules/index.cjs`. `ctx.dataDir` is the module's private folder
   (`%APPDATA%\MonoRail\modules\<id>`); keep caches and settings there.
4. In the page, call it with `useModuleQuery(id, method)` or
   `invokeModule(id, method, args)` from `src/modules/client.ts`. In the
   browser dev server there is no backend (`isDesktop()` is false), so ship
   fictional sample data for that case.

The renderer stays sandboxed: `electron/preload.cjs` exposes only
`window.commandHub.invoke(moduleId, method, args)` and `on(channel, cb)` for
the two extension push channels.

`claude-stats` is the reference module: its backend runs the bundled
`ccusage` binary (native packages are unpacked from the asar via
`asarUnpack`), caches the JSON report in its data folder, and the page
normalizes it into day x project x model facts in `transform.ts`. Session
partners come from `electron/modules/claude-stats-phases.cjs`, which reads
the raw Claude Code logs and splits each session into phases (driver model +
subagent models; new phase on driver change or a 2-hour idle gap). Phase
cost is priced from ccusage's per-session, per-model cost per output token.

`jira` is the second worked example: one tracker over two sources. Team
tickets go through the Jira Cloud REST API (`electron/modules/jira-cloud.cjs`,
API token encrypted with `safeStorage` in the module's data folder). Personal
projects are a git repo in `<dataDir>/local-repo` (`jira-local.cjs`, via
`isomorphic-git`, one JSON file per ticket, one commit per change). That repo
never gets a remote; do not add push or sync to it.

### Charts

Follow the data-viz rules already encoded in `components/charts/`: series
colors come from `--series-1..6` in fixed order (never cycled; extra series
fold into "Other"), rank entities on the full dataset so filters never
repaint them, one y-axis per chart, a legend for 2+ series, a table view
beside every chart, thin marks (bars <= 24px, 2px lines), and one hero
figure per page.

## Apps: full-screen experiences inside the hub

An **app** is the second building block, next to modules. Where a module is
one page inside the hub's drawer and top bar, an app takes over the whole
window and may look and feel like its own product: its own colors, fonts,
layout and in-app routing. Apps are listed in the **Apps** nav section, right
under Home. The contract is `AppDefinition` in `src/apps/types.ts`.

The one thing an app never owns is the **hub bar**: `src/apps/AppFrame.tsx`
renders a 48px bar above every app, in the hub's dark drawer color, with a
"Back to MonoRail" button, the app's icon and name, and an "App" chip.
That is how users leave any app; do not hide, restyle or duplicate it inside
an app. Leaving returns to the hub page the user came from, and reopening an
app from the nav resumes where it was left (`src/apps/session.ts`). An error
boundary keeps the bar on screen if an app crashes.

To add an app:

1. `src/apps/<id>/index.ts` exports an `AppDefinition` (id, title,
   description, icon, `path: '/apps/<id>'`, lazy `component`).
2. Add it to `src/apps/registry.ts`. The nav and router pick it up.
3. The root component receives `basePath` (`/apps/<id>`). Everything under
   that hash path belongs to the app, so it can run its own router, e.g.
   react-router's `<HashRouter basename={basePath}>`.
4. Scope all of the app's CSS under one root class (GitHub+ uses `.ghp` with
   CSS nesting) so nothing leaks into the hub after the app is closed. Avoid
   class names that are Tailwind utilities (`container`, `hidden`, ...).
   Tailwind preflight still applies, so restore browser defaults you rely on
   (heading sizes, list bullets) inside the scope.
5. If it needs local data, write `electron/apps/<id>/index.cjs` exporting
   `{ id, methods }` (same shape as a module backend) and add it to
   `electron/apps/index.cjs`. Call it with `invokeApp(id, method, args)` from
   `src/apps/client.ts`. `ctx.dataDir` is
   `%APPDATA%\MonoRail\apps\<id>`. As with modules, ship fictional
   sample data for the browser dev server. A module or app backend may also
   export `start(ctx)`, called once at startup, for work that runs without
   its page open (GitHub+ uses it for its backup scheduler).

`github-plus` (**GitHub+**) is the reference app, a port of
`wojoe-444/Local-Repo-UI`: a GitHub-style, read-only browser for local git
repositories (code, README, file viewer, history, commits with diffs,
branches, compare). Its backend (`electron/apps/github-plus/git.cjs`) only
runs the local `git` CLI, validates refs and paths from the renderer, disables
repo-configured textconv/external diff, and only serves repos the user opened.
Recent repo paths are kept in its data folder, never in the repo. It makes no
network requests: remote images in READMEs are blocked and external links do
nothing. Tests live in `git.test.cjs`.

GitHub+ also has **scheduled backups** (Backups tab, `backup.cjs`): per repo,
"X times per hour/day/week" into a folder the user picks (e.g. one OneDrive
already syncs). Each backup is a verified `git bundle --all` file, written as
`.partial` and renamed when complete, with the newest N kept. The scheduler
runs inside MonoRail (checks every minute and at startup, so a backup
missed while the app was closed runs once when it opens; failures retry after
15 minutes). Schedules live in the app's data folder (`backups.json`).

## Extensions: modules and apps from other repositories

The third building block. An **extension** is a module and/or app built and
released in its own repository and installed into a running copy of the app
without rebuilding it (e.g. a Minecraft bot as its own repo). Built-in modules
and apps stay in this repo; anything user- or situation-specific should be an
extension. The user-facing name is MonoRail.

**Package.** A folder or `.zip` with `monorail.json` at its root:

```json
{
  "manifestVersion": 1,
  "id": "minecraft-bot",
  "name": "Minecraft Bot",
  "version": "0.3.0",
  "publisher": "wojoe-444",
  "repository": "wojoe-444/minecraft-bot",
  "engines": { "monorail": "^1.0.0" },
  "icon": "icon.svg",
  "ui": "ui",
  "contributes": {
    "modules": [{ "id": "status", "title": "Bot status", "entry": "index.html#/status", "nav": { "section": "Minecraft" } }],
    "apps": [{ "id": "console", "title": "Bot console", "entry": "index.html#/console" }]
  },
  "backend": { "main": "backend/index.cjs", "activation": "onDemand" },
  "permissions": { "network": ["*.mojang.com", "localhost:25565"], "process": ["java"], "filesystem": { "read": ["~/.minecraft"], "pickFolders": true } }
}
```

Rules live in `electron/extensions/manifest.cjs` (with tests). Routes are
`/x/<ext>/<module>` for modules and `/apps/<ext>.<app>` for apps; the nav,
router and `AppFrame` pick them up through `allModules()` / `allApps()` in
the registries, fed by `src/extensions/store.ts`.

**Versioned API.** `API_VERSION` in `manifest.cjs` (currently 1.0.0) covers
the manifest, the backend `ctx`, and bridge protocol 1. Extensions declare
`engines.monorail`; a non-matching extension stays installed but is not loaded.
Adding things is a minor bump; changing or removing anything an extension can
see is a major bump. Keep all three in step with `packages/extension-sdk`.

**UI isolation.** Extension pages are static files served from the
extension's `ui` folder over `monorail-ext://<id>/` (registered in
`main.cjs` before ready) into a sandboxed iframe (`src/extensions/ExtensionFrame.tsx`).
Each extension is its own origin with a strict CSP: no inline scripts, no
network (`connect-src 'self'`), no remote assets, and `will-frame-navigate`
keeps frames on their origin. A page only reaches the hub through
postMessage, and the hub only forwards: call its own backend, ask the user for
a folder, open an https link. Module pages sit under a hub `PageHeader` and
report their height; apps fill the window under the hub bar.

**Backend sandbox.** Each backend runs in its own child process
(`host.cjs` forks `runner.cjs` with MonoRail's own executable in
`ELECTRON_RUN_AS_NODE` mode), never in the main process. Node's permission
model confines it: read its own files, read/write
`%APPDATA%\<app>\extension-data\<id>` (`ctx.dataDir`), plus exactly the
folders the manifest or the user granted; `--allow-child-process` only with
the `process` permission; no workers, addons or WASI. Node does not police the
network, so `runner.cjs` gates `Socket#connect` (covers net, tls, http(s),
fetch, WebSocket), UDP and DNS against `permissions.network`. The child gets
a minimal environment (no inherited tokens). `process` is full trust (a
spawned program is not sandboxed) and the UI says so. `runner.cjs` must stay
self-contained: it is `asarUnpack`ed and is the only app file the child may
read. Backends crash in isolation; 3 crashes in a minute stop it until reload.

**Install, update, remove** (`manager.cjs`, `install.cjs`). Sources: a
folder (copied), a `.zip`, the latest GitHub release of `owner/name` (the
`*.monorail.zip` asset; its manifest `repository` must match), or a
development folder loaded in place (Reload picks up a rebuild). Everything is
staged in `extensions/.staging` and validated (zip-slip, size limits) and
nothing runs until the user approves the permissions in the consent dialog.
Installed files live in `%APPDATA%\<app>\extensions\<id>`, state (enabled,
source, granted permissions and folders) in `extensions/state.json`. An
update or reload that asks for more permissions turns the extension off
(`needs-approval`) until approved. Removing keeps its data unless the user
ticks "Also delete its data". The UI is Settings > Extensions
(`src/modules/extensions`). Tests: `electron/extensions/extensions.test.cjs`
(runs the real sandbox under Node).

## Design guidance

The visual direction is **shadcn's component aesthetics + MUI's page
composition + a more expressive, professional color system.** Build
everything with shadcn/ui. Do **not** add MUI (or any second component
library) as a dependency; borrow MUI's conventions, not its code.

### From shadcn: component look

Clean, quiet components: thin borders, generous radius (`--radius` 10px),
subtle focus rings, restrained typography. Use the primitives in
`components/ui/` rather than hand-rolled one-off styles.

### From MUI: layout, spacing, hierarchy

- **8px grid.** Spacing values come from multiples of 8 (Tailwind `2`, `4`,
  `6`, `8`, ...). Page gutters 24px (32px on large screens), gaps between
  cards 24px, page sections 32px apart.
- **App frame.** Permanent left drawer (260px, collapses to a 72px icon rail
  like MUI's mini variant) + a 64px top app bar. The drawer header is the
  same height as the app bar.
- **Navigation.** Items grouped into sections with small uppercase overline
  subheaders; 40px rows; the active item gets a filled background plus a left
  indicator bar. Every destination lives in `nav.ts`.
- **Page structure.** Every page starts with `PageHeader`: overline (optional),
  h4-scale title (28px semibold), one-line subtitle, actions aligned right.
  Content sits in a centered container (max 1440px).
- **Content hierarchy.** Responsive grids like MUI `Grid`
  (1 / 2 / 3-4 columns). Cards have a header (title + description + action),
  a divider, then content. Lists use dividers and hover states.
- **Elevation.** Use the `shadow-elevation-1/2/3` tokens to express depth
  (resting card, raised element, hover/overlay) instead of ad-hoc shadows.

### Color system

Defined in `src/index.css` as OKLCH CSS variables, mapped to Tailwind via
`@theme inline`. Use tokens, never raw hex values in components.

- **Neutrals:** cool slate for backgrounds, borders, and muted text.
- **Primary:** deep indigo for primary actions, active nav, and links.
- **Highlight:** teal for secondary emphasis (the second brand color).
- **Semantic:** `success`, `warning`, `info`, `destructive`. Each has a solid
  (`bg-success`) and a soft variant (`bg-success-soft
  text-success-soft-foreground`). Prefer soft variants for badges, status
  chips, and icon tiles; save solid colors for primary actions and small
  indicators.
- **Sidebar:** a dark indigo-slate drawer (`--sidebar-*`) in both themes, which
  anchors the layout and gives the app its identity.
- Every token has a light and a dark value. Check both when adding UI.
