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

`electron/userData.cjs` picks the data folder before the app is ready: the
existing one that holds data, newest name first (`%APPDATA%\MonoRail`, then
`MonoHub`, `command-hub`, `Command Hub`), or a new `MonoRail` folder on a
clean machine. It **never moves, renames or copies** a data folder: an earlier
version renamed the old folder on startup and caused trouble for a test
user. Always reach the folder through `app.getPath('userData')` /
`ctx.dataDir`; the paths below say `%APPDATA%\MonoRail`, but older installs
keep their original folder.

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
| `npm run dev:browser` | Browser tab at http://localhost:5199 with real backends: a window-less Electron process (`electron/dev-bridge.cjs`) serves them over a token-guarded local bridge. Own data folder (`%APPDATA%\MonoRail Dev`), so it runs beside the installed app. Extension UIs (`monorail-ext://`) don't load in the browser. |
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
- `index.css` design tokens (light and dark defaults = the "Sand & Ink"
  palette), fonts, chart series.
- `lib/palettes.ts` the color schemes; `lib/theme.ts` applies the chosen
  palette and light/dark mode; `components/theme/ThemePicker.tsx` holds the
  top-bar picker, the mode toggle and the Settings "Appearance" card.

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
`asarUnpack`) for Claude Code's daily API-equivalent cost, and
`electron/modules/claude-stats-scan.cjs` reads the raw logs of every source
it knows (Claude Code, Gemini CLI, pi; one reader each, a missing source is
reported as not found) into day x session x model x role x 50K context-step
rows, plus per-turn prompt sizes, compactions and session phases (driver
model + subagent models; new phase on driver change or a 2-hour idle gap).
Both go into one cached JSON report in its data folder (cache
`claude-stats.usage`: opening the page only reads it; it is rebuilt every 15
minutes while the app runs, retried an hour after a failure, or on Refresh). List prices, with
prompt-size tiers, live in one table, `claude-stats-prices.json`, shared by
the backend and the page (`src/modules/claude-stats/pricing.ts`); a test
fails if a model in the local logs has no row. The page turns the report into
priced facts in `facts.ts`: Claude Code rows are scaled to ccusage's cost per
day and model, pi's logged per-token-type cost is used as logged, anything
else is priced from the table, and any split that is not logged is labelled
an estimate.

**Caches** go through the shared primitive in `electron/cache/` (rules and
examples: `docs/caching.md`). Every cache, and every other file a backend keeps
in its data folder, is declared in `electron/cache/declared.cjs` with its tier,
version, time limits and content policy; opening an undeclared cache throws and
a test fails on an undeclared `*_FILE`. Cache files are written atomically, a
lock file lets one build run at a time, a failed build backs off and keeps the
last good result, and pages only read a cache on open: slow builds run from a
Refresh button or the background schedule (`cache.schedule` from `start(ctx)`).
After each build a module may write a small summary file; Home reads only those
(`home.getSummaries`). Pages show `CacheStatusBadge` for cached data.

`jira` is the second worked example: one tracker over two sources. Team
tickets go through the Jira Cloud REST API (`electron/modules/jira-cloud.cjs`,
API token encrypted with `safeStorage` in the module's data folder). Personal
projects are a git repo in `<dataDir>/local-repo` (`jira-local.cjs`, via
`isomorphic-git`, one JSON file per ticket, one commit per change). That repo
never gets a remote; do not add push or sync to it.

`agent-chat` (**Chat**, under Agents) lists every local Claude Code
(`~/.claude/projects`, `~/.config/claude` or `CLAUDE_CONFIG_DIR`) and pi
(`~/.pi/agent/sessions` or `PI_CODING_AGENT_DIR`) session and shows one as a
read-only transcript (`electron/modules/agent-chat.cjs`). Logs are read in
place, never copied or cached to disk, and the page only names a session by
the id the backend handed out, never a path. pi sessions are trees; the
transcript follows the branch ending at the last entry. **Allowed folders**
(`agent-chat-folders.cjs`): a chat is listed, opened or run only if its
folder resolves (real path, following symlinks and junctions) into a git repo
directly under the Repos folder (default `~/Repos`) or a repo added in the
page's Folders dialog; folders are picked in the system dialog, and every
request re-resolves them. Read limits: the list reads the 300 newest logs and
keeps 60 chats; a history is at most the last 4 MB and 300 messages, and the
page says when it was cut.

Nav items may have one level of indented subpages (`NavItem.children` in
`nav.ts`); a module nests under an item with `nav.parent: '<path>'`.

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
layout and in-app routing. **Apps** is a single nav item right under Home; it
opens the Apps page (`src/pages/AppsPage.tsx`), which shows every app, built
in or from an extension, as a card. The contract is `AppDefinition` in `src/apps/types.ts`.

The one thing an app never owns is the **hub bar**: `src/apps/AppFrame.tsx`
renders a 48px bar above every app, in the drawer colors of the current
color scheme, with a "Back to MonoRail" button (filled like the active nav
item), the app's icon and name, and an "App" chip.
That is how users leave any app; do not hide, restyle or duplicate it inside
an app. Leaving returns to the hub page the user came from, and reopening an
app from the Apps page resumes where it was left (`src/apps/session.ts`). An error
boundary keeps the bar on screen if an app crashes.

To add an app:

1. `src/apps/<id>/index.ts` exports an `AppDefinition` (id, title,
   description, icon, `path: '/apps/<id>'`, lazy `component`).
2. Add it to `src/apps/registry.ts`. The Apps page and router pick it up.
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

GitHub+ also has **local issues** (Issues tab, `issues.cjs`): create, edit,
comment, close and reopen, with Markdown. They are stored inside each repo,
never in AppData: one JSON file per issue in the tree of a commit that
`refs/local-issues` points at, written with git plumbing (`hash-object`,
`mktree`, `commit-tree`, `update-ref` with the old value as a guard), so the
working tree and index are never touched, every change is a commit, backups
carry them and a normal push does not. Keep that ref out of commit feeds
(`--exclude=refs/local-issues --all`).

`email` (**Email**) is the second app: mail through pluggable **inbox
connectors**. The connector contract is documented at the top of
`electron/apps/email/connectors/index.cjs` (config fields, `signIn`,
`createSession` returning folders/threads/modify/send); the backend
(`electron/apps/email/index.cjs`) knows no provider. Gmail
(`connectors/gmail.cjs`) is the first connector: Google sign-in via OAuth
2.0 with PKCE and a loopback redirect (`oauth.cjs`, RFC 8252) and the Gmail
REST API with the `gmail.modify` scope, plain `fetch`, no Google SDK. The
user brings their own Google Cloud "Desktop app" OAuth client and pastes the
client ID and secret into the app's setup screen (steps are on that screen).
The secret and each account's refresh token are encrypted with safeStorage
in `%APPDATA%\MonoRail\apps\email` (`store.cjs`, which refuses to save
secrets when encryption is unavailable); never commit a client ID, secret or
token. Mail is fetched on demand and never written to disk. HTML mail renders
in a sandboxed iframe without scripts, with remote images blocked until the
user asks. IMAP or other providers go in as new connector modules. The app is
self-contained (only `src/apps/email` and `electron/apps/email`) so it can
move into an extension later. Tests live in `email.test.cjs`.

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

**SDK and starter.** `packages/extension-sdk` is the source of truth for what
every extension carries in its `monorail-sdk/` folder: `client.js` (page
bridge), `backend.d.ts`, `theme.css` (generated from `src/index.css`) and
`pack.mjs` (zero-dependency packer to `<id>-<version>.monorail.zip`).
`extensions/hello-monorail` is the starter and working sample (Vite + React +
Tailwind page and app, notes backend, release workflow); new extension repos
start with `npx degit wojoe-444/MonoRail/extensions/hello-monorail`. After
changing the SDK or the design tokens run `node packages/extension-sdk/sync.mjs`;
`npm test` fails if the copies are stale, and CI builds and packs the sample.
The plan and author guide is `docs/extensions.md`.

## Design guidance

The visual direction is **the Bot Dashboard from `wojoe-444/MC-Player`**
(`dashboard/web` there): shadcn/ui components, MUI-style page composition,
and its palette suite with a theme picker. When in doubt, match that app.
Build everything with shadcn/ui. Do **not** add MUI (or any second component
library) as a dependency; borrow MUI's conventions, not its code.

### Component look

Clean, quiet components: cards rest flat on a hairline ring
(`ring-1 ring-foreground/10`, no shadow), generous radius (`--radius` 10px),
subtle focus rings, restrained typography. Type is Inter Variable (bundled
via `@fontsource-variable`, so it works offline in the .exe), code and
numbers in JetBrains Mono Variable (`font-mono`). Use the primitives in
`components/ui/` rather than hand-rolled one-off styles.

### Layout, spacing, hierarchy

- **8px grid.** Spacing values come from multiples of 8 (Tailwind `2`, `4`,
  `6`, `8`, ...). Page gutters 24px (32px on large screens), gaps between
  cards 24px, page sections 32px apart.
- **App frame.** Permanent left drawer (256px, collapses to a 72px icon
  rail) + a 64px top bar. The drawer header (brand tile, "MonoRail",
  "Agent hub") is the same height as the top bar and has a bottom border;
  the drawer footer shows the version and a desktop / browser badge.
- **Top bar.** Drawer toggle, a divider, a `Section > Page` breadcrumb, and
  on the right the color scheme picker and the light/dark toggle. Nothing
  else lives there unless it is page-wide status (the Bot Dashboard puts
  live pills there).
- **Navigation.** Items grouped into sections with small uppercase overline
  labels; 40px rows on soft pills (`bg-sidebar-accent`); the active item is
  filled with `bg-sidebar-primary` and a soft colored shadow. Count badges
  are amber. Every destination lives in `nav.ts`.
- **Page structure.** Every page starts with `PageHeader`: overline
  (optional), 24px semibold title, one-line subtitle, actions aligned right.
  Content sits in a centered container (max 1536px).
- **KPI tiles.** `StatTile` (or the same markup): uppercase xs label, 30px
  tabular value, a colored delta line with an arrow (green good, amber bad),
  and an optional `Sparkline` on the right. 4-up on desktop.
- **Content hierarchy.** Responsive grids (1 / 2 / 3-4 columns). Cards have
  a header (title + description + action), a divider, then content. Lists
  use dividers and hover states.
- **Elevation.** Cards are flat. Use `shadow-elevation-2/3` for raised and
  overlay surfaces (menus, dialogs, hover lift), never ad-hoc shadows.

### Color system: palettes

Colors are OKLCH CSS variables mapped to Tailwind via `@theme inline` in
`src/index.css`. Use tokens, never raw hex values in components.

- **Palettes.** `src/lib/palettes.ts` holds the 28 color schemes ported from
  the Bot Dashboard (Set 1, Set 2, Neutrals). Each is a few numbers (primary
  hue/chroma, neutral hue/chroma, drawer style dark/light/bold) that
  `tokens()` expands into every token for light and dark. `lib/theme.ts`
  writes them on `<html>`; the choice is kept in `commandHub.palette`, the
  mode in `commandHub.theme`. **Defaults: Sand & Ink, light mode.** The
  values in `index.css` are Sand & Ink so the first paint matches; change a
  scheme in `palettes.ts`, not there.
- **Primary:** the palette's primary (Sand & Ink: deep khaki-brown) for
  primary actions, active nav and links. `primary-soft` for tinted tiles.
- **Highlight:** the palette's complementary hue, for secondary emphasis.
- **Semantic:** `success`, `warning`, `info`, `destructive` keep the same
  hues in every palette. Each has a solid (`bg-success`) and a soft variant
  (`bg-success-soft text-success-soft-foreground`). Prefer soft variants for
  badges, status chips, and icon tiles; save solid colors for primary
  actions and small indicators.
- **Sidebar:** `--sidebar-*` follows the palette's drawer style (white for
  light-drawer palettes like Sand & Ink, near-black or brand-colored for the
  others). The app frame's hub bar uses the same tokens.
- **Charts** do not follow the palette: `--series-*` stay fixed (see Charts).
- Check new UI in light and dark, and in at least one dark-drawer palette
  (e.g. Indigo Ink) besides Sand & Ink.
