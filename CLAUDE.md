# CLAUDE.md

Guidance for Claude (and anyone else) working in this repository.

## What this project is

**Command Hub** is a desktop app for managing agents. The agent definitions
it manages are stored in this repository (`wojoe-444/MonoRail`) under
`agents/`. The app itself lives in `apps/command-hub/`: React 19 + Vite +
TypeScript + Tailwind CSS v4 + shadcn/ui, wrapped in Electron so it ships as a
Windows `.exe`.

The owner reviews changes by running the `.exe` locally, so keep
`npm run dist:win` working and treat "it builds and opens as an .exe" as part
of done.

## The one hard rule: private data stays in AppData

**This repository is public.** Never commit private or user-specific data:
API keys, tokens, passwords, emails, personal settings, run history, logs, or
anything copied from the user's machine.

- At runtime that data lives in local AppData. In Electron, use
  `app.getPath('userData')` (on Windows `%APPDATA%\Command Hub`). Do not
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
| `npm run dist:win` | Build `release/CommandHub-<version>-portable.exe` |

CI (`.github/workflows/ci.yml`) builds and lints on every PR and produces the
portable `.exe` on a Windows runner as a downloadable artifact.

## Code layout (`apps/command-hub/src`)

- `components/ui/` shadcn/ui primitives. These are owned source, edit freely.
  Add new ones in the same style (Radix primitives from `radix-ui`, `cva`,
  `cn()`); the shadcn CLI registry may not be reachable from every
  environment.
- `components/layout/` app shell: `SideNav`, `TopBar`, `PageHeader`, and
  `nav.ts` (the single list of navigation items).
- `pages/` built-in pages (Home and placeholders).
- `modules/` feature modules (see below). `modules/registry.ts` lists them.
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
   (`%APPDATA%\Command Hub\modules\<id>`); keep caches and settings there.
4. In the page, call it with `useModuleQuery(id, method)` or
   `invokeModule(id, method, args)` from `src/modules/client.ts`. In the
   browser dev server there is no backend (`isDesktop()` is false), so ship
   fictional sample data for that case.

The renderer stays sandboxed: `electron/preload.cjs` exposes only
`window.commandHub.invoke(moduleId, method, args)`.

`claude-stats` is the reference module: its backend runs the bundled
`ccusage` binary (native packages are unpacked from the asar via
`asarUnpack`), caches the JSON report in its data folder, and the page
normalizes it into day x project x model facts in `transform.ts`.

### Charts

Follow the data-viz rules already encoded in `components/charts/`: series
colors come from `--series-1..6` in fixed order (never cycled; extra series
fold into "Other"), rank entities on the full dataset so filters never
repaint them, one y-axis per chart, a legend for 2+ series, a table view
beside every chart, thin marks (bars <= 24px, 2px lines), and one hero
figure per page.

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
