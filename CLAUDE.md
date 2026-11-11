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

## Profiles: whose data a backend reads

A **profile** is one person's settings and data (docs: `docs/profiles.md`,
code: `electron/profiles/index.cjs`). No passwords, no sign-in, not a security
boundary. Today there is one, the **default profile**, and its folder IS the
data folder above: existing data is read in place and nothing is moved,
renamed or copied to make it so. Every folder has a scope in `SCOPES`
(`profile`: appearance, connections, backups, Flashcards, Jira+, GitHub+,
Email, Chat state, Agent access; `machine`: updates, installed extensions,
Claude Stats' report of this computer's logs, Storage, `profiles.json`); a
test fails when a backend or declared data folder has none. Later profiles
live in `<data folder>\profiles\<id>\`. Backends reach other folders with
`ctx.layout.folder('<folder>')` (main-process singletons: `appLayout()`),
never `app.getPath('userData')`; pages keep per-person preferences with
`prefs` (`src/lib/prefs.ts`) instead of `localStorage`, which keeps the old
keys for the default profile. `profiles.json` is written only when the user
changes a profile (Settings > Profile), never over a damaged file. Copying data
into a new profile must be user-started and per item, never automatic.

**Developer Mode** (Settings card `src/components/dev/DeveloperModeCard.tsx`,
self-contained so it can move; guide `docs/guide/setup/developer-mode.md`):
off by default, kept in the machine-wide `commandHub.devMode` key (not
`prefs`, so it survives the test profile). It adds the element inspector
(`components/dev/Inspector.tsx`, `inspect.ts`: names the React components
above a hovered element from its fiber; production builds keep names via
rolldown `output.keepNames` in `vite.config.ts`), F12 for Chromium DevTools
(`electron/modules/developer.cjs`) and the hidden **New User** profile
(`new-user`): switching restarts the app and `resetBlankProfile()` wipes only
`profiles\new-user` at that start (docs/profiles.md). A top-bar chip with the
way back shows whenever New User is open.

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
The settings backend also checks on its own (`start()`: 30 s after startup,
then every 4 hours), and `src/modules/settings/UpdateToast.tsx` shows a
lower-right pop-up when an update is available: "Download and Restart",
"Ignore for six hours" (kept in `commandHub.updateSnoozeUntil`) and X (hidden
until the next check). It is self-contained, so it moves with Settings.

**Release notes.** Each release's body is its "What's new" list, written by
`scripts/release-notes.cjs` in the publish step from the PRs merged since the
previous release (format and parser: `electron/release-notes.cjs`). Every PR
description therefore gets a `## What's new` section (see
`.github/pull_request_template.md`): one bullet per user-visible change,
`- **Short title**: one plain sentence`, written for people using the app, not
developers (no file names, no internals); without it the PR title is used.
Release notes are public: no personal paths, names or test-user details (the
script also strips home-folder paths and emails). When an update is
available, the settings backend reads the public release list once
(api.github.com) and keeps every release between the installed and the latest
version (`changes`); `src/modules/settings/WhatsNew.tsx` shows them in Settings
and, briefly, in the pop-up. The "Release notes" workflow (manual) rewrites
older releases' notes.

## Code layout (`apps/command-hub/src`)

- `components/ui/` shadcn/ui primitives. These are owned source, edit freely.
  Add new ones in the same style (Radix primitives from `radix-ui`, `cva`,
  `cn()`); the shadcn CLI registry may not be reachable from every
  environment.
- `components/layout/` app shell: `SideNav`, `TopBar`, `PageHeader`, and
  `nav.ts` (the single list of navigation items).
- `pages/` built-in pages (Home and placeholders).
- `modules/` feature modules (see below). `modules/registry.ts` lists them.
- `apps/` apps with their own look: Workspace pages or full screen (see below). `apps/registry.ts` lists them.
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
  Settings "Appearance" card, the only place to pick them.

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
   (`%APPDATA%\MonoRail\modules\<id>` for the default profile); keep caches
   and settings there. Give the folder a scope in `SCOPES`
   (`electron/profiles/index.cjs`).
4. In the page, call it with `useModuleQuery(id, method)` or
   `invokeModule(id, method, args)` from `src/modules/client.ts`. In the
   browser dev server there is no backend (`isDesktop()` is false), so ship
   fictional sample data for that case.

The renderer stays sandboxed: `electron/preload.cjs` exposes only
`window.commandHub.invoke(moduleId, method, args)`, `on(channel, cb)` for
the two extension push channels and `window:fullscreen`, and
`toggleFullScreen()` / `isFullScreen()` (`electron/window-fullscreen.cjs`:
F11 or the top-bar button toggles the window's full screen mode).

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
an estimate. Effort comes from Claude Code's per-response `effort`
field and pi's `thinking_level_change` entries (followed along the branch);
thinking tokens from Claude Code's `output_tokens_details.thinking_tokens`
and Gemini's `thoughts`. pi logs no thinking count, so its count is estimated
from the thinking text (~4 characters a token) and shown with "~".
The page charts both: spend, output and effort mix over time by level, cost per
model call and per million output by model and level, and thinking share of
output by model (`effort.ts`, `components/EffortCards.tsx`). Levels are ordinal,
so they share one hue in steps of strength; "Not logged" is the Other grey.
Only sessions that log on this computer are counted: cloud sessions (Claude
project threads, Claude Code on the web) keep their transcripts on Anthropic's
servers, there is no public API for their usage, and the page header says so.

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

**Sending** (Claude for now): each message runs one turn in a worker process
(`agent-chat-worker.mjs`, run with MonoRail's own executable in
`ELECTRON_RUN_AS_NODE` mode) that drives the Claude Agent SDK against the
user's own installed `claude` executable (the SDK's bundled native binary is
excluded from the installer). The job and prompt go to the worker on stdin,
never argv; `agent-chat-turns.cjs` keeps one turn per chat, kills the whole
process tree on Stop, times out after 30 minutes and logs metadata only
(session id, SDK, model, mode, outcome). The page polls `pollTurn` for events.
Options come from `agent-chat-options.cjs`: **Ask** (default) offers only
Read/Grep/Glob with no MCP servers; **Agent** uses Claude Code's normal
permission rules. Every approval prompt is denied and shown in the thread.
`assertNoBypass()` refuses any options that would bypass permissions, and the
settings overlay disables bypass mode; never weaken either. A continued chat
runs only in its own folder, re-checked against the allowed folders. The
running cost total per session is kept in `costs.json` in the module's data
folder (numbers only) so a resumed turn's own cost can be worked out.
**pi** (`agent-chat-worker-pi.mjs`) runs through the user's own pi coding
agent SDK, found behind the `pi` command (`findPiSdk`: PATH plus the usual
npm/pnpm/bun/Volta/scoop folders, reading the command's shim to find the
package; `@earendil-works/pi-coding-agent`, or `@mariozechner/...` for pi
0.x). MonoRail does not bundle it; the worker handles pi 1.x (`ModelRuntime`)
and 0.x. pi has no approval prompts, so its limits are the tool list and a
path guard: Ask gets read/grep/find/ls, Agent adds edit/write, every tool path
must resolve (real path) inside the chat's repo, the user's pi extensions are
not loaded, and no mode ever gets bash. Effort maps to pi's thinking level
(Max = xhigh). A started chat keeps its SDK; new chats pick one in the
status bar (remembered).

**System prompts** (page header "Prompts", `agent-chat-prompts.cjs`,
`system-prompts.json` in the data folder): one per agent (Claude, pi,
coordinator), either added to the built-in prompt (default) or replacing it
(the page warns that this drops Claude Code's tool guidance). The main process
reads the file when a turn starts and puts the prompt on the job, never taken
from the page's turn request, so coordinator child turns get it too. Claude
gets the SDK's `systemPrompt` (preset + append, or custom; `snapshot: true`, so
a started chat may keep its first prompt); pi gets the resource loader's
`systemPromptOverride` / `appendSystemPromptOverride` (never the plain options,
which pi reads as a file path), and an older pi that ignores them is refused.
The coordinator can only append (its instructions are `coordinator.md`).
`assertNoBypass` skips the prompt text only; a prompt never changes tools or
permissions.

**Plain / Detailed** (status bar, remembered; Plain is the default). Detailed
shows reasoning above the tool rows and, after each reply, one row per model
call (model, cost, input, cache read, cache write, output; subagent calls
counted apart) with the reply's total and call count. Reasoning is only
requested from the SDK in Detailed mode, so Plain replies never have it.
History transcripts carry `usage` per assistant message, and Claude subagent
logs (`<session>/subagents/`) supply subagent calls. A call's cost is the
logged cost when there is one (pi); otherwise the reply's cost is split by
token weight (output 5x input, cache write 1.25x, cache read 0.1x) and marked
as an estimate (`src/modules/agent-chat/cost.ts`). **Totals**: Claude's comes
from the last cost record in `costs.json` (marked incomplete if the log
changed after it), pi's is every paid entry in the file, abandoned branches
included; past the 4 MB read limit only spend since opening is counted, and
the page says so. A total never reads complete when it is not.

**List flags** (`agent-chat-state.cjs`, `chat-state.json` in the data folder,
keyed by chat id, flags and times only): unread (the log changed after the
chat was last seen, or marked by hand; an opened unread chat stays unread
until it is left; a reply that finishes while watching counts as seen),
archived, and started-here. Claude chats whose log says they were started
headless (`entrypoint` `sdk-*`) and not from this page are tagged Scheduled.
Scheduled and archived chats are hidden behind toggle buttons; the open chat
always stays listed. Right-click a chat to mark it read/unread or archive it.

**Side panels** (page header buttons): **Changes** runs `git status` and
`git diff HEAD` for the chat's folder (`agent-chat-changes.cjs`; read-only,
folder from the main process, external diff/textconv/fsmonitor off, diff cut
at 1 MB). **Browser** shows any http(s) address in a sandboxed iframe, with
"Open in new tab" going to the system browser.

**Coordinator** (pinned above the chat list): opens the latest coordinator
chat or starts one. It runs the user's `coordinator` subagent
(`~/.claude/agents/coordinator.md`, found by `findCoordinator`) with the
`agent` option, or, when there is none, MonoRail's built-in definition
(`BUILTIN_COORDINATOR`, passed as the SDK's `agents` option; never when the
user has their own), in the module's own `coordinator` folder in its data folder,
with `dontAsk`, built-in tools limited to `Agent` and `Workflow`, and one
MCP server: MonoRail's in-process chat tools (`agent-chat-coordinator.cjs`,
served by the worker as `mcp__monorail__*`: list_chats, read_chat,
send_to_chat, start_chat, wait_for_reply). Those run child turns through
Chat's own `startTurn`, so the allowed folders, Ask/Agent and
`assertNoBypass` all apply; coordinator chats are never targets, a chat whose
log changed in the last minute is refused, and child turns stop when the
coordinator's turn ends. Other agents reach it through the MCP server's
`ask_coordinator` write tool (consent per agent, logged). A lock file per
chat (`agent-chat-locks.cjs`, `turn-locks/` in the data folder, pid and time
only) keeps one turn per chat across the app, coordinator workers and the
MCP server, which also breaks loops. `coordinatorToolsNote` warns when the
subagent's own `tools:` line would hide the chat tools. Claude only: pi has
no subagents, so a coordinator job on pi is refused. Its chats are listed
apart, first. The entry is greyed out only when Claude Code is missing.
Subscription logins are fine here: MonoRail drives the user's own unmodified
`claude` executable, signed in through Anthropic's own flow, and never
handles the token.

The **Agents** page (`/agents`, `src/pages/agents/`) is the overview over
Runs, Library and Chat. Its backend (`electron/modules/agents.cjs`) keeps no
files: it reuses Agent Chat's session list, composer info and running turns
in process, reads the Claude Stats summary (never builds a report), and lists
agent definitions (`agents-definitions.cjs`: Claude Code subagents in
`.claude/agents`, skills in `.claude/skills/*/SKILL.md`, pi skills in
`~/.pi/agent/skills` / `.pi/skills`, from the home folder and each allowed
repo; frontmatter only, bodies on demand by id, never a path). Archived chats
are left out. Quick launch and "Open" hand over to Chat with
`openInChat()` (`src/modules/agent-chat/handoff.ts`, in memory only); a
handed-over prompt is prefilled in the composer, never sent by itself.

**Mochi crew** (`src/components/mochi/`, docs: `docs/mochi-crew.md`): agent
characters in the K1 Mochi app-icon family (dough body, dot eyes, never a
mouth, never a robot). A character is a role (layers of static SVG in
`characters.ts`: body, eyes, headwear, held props, tile props) times a flavor
(`flavors.ts`: 42 flavors of three OKLCH numbers each, expanded with a 3:1
accessory contrast check; `Classic` is the icon's own palette and belongs to
the Coordinator). Layers use only the flavor's CSS variables, except the fixed
props listed in the docs. `AgentMochi` picks the role from the name (last word
first) and then the description (`match.ts`), and the flavor from the role
default or a hash of the name. Nothing is stored. The SVG is inserted as
markup, so only repo-authored strings may go into it, never agent or user text.
Shown on Agents definitions, Chat's Agent/Task tool rows and the Coordinator
entry; Agents > Characters is the gallery.

`connections` (**Connections**, under Configure) is the one place for the
accounts MonoRail signs in with. Connectors live in `electron/connections/`
(contract at the top of `index.cjs`): fields, a `status()` returning
`ok | expired | needs-setup | error | unavailable`, actions such as "Sign in
again" that run as polled jobs, and an optional `credentials()`. **Opt-in, always:** a
connector runs nothing (no `status()`, action, process, file probe or network
call) until the user sets it up; test users must never have MonoRail probing
tools or accounts they did not ask about. `createConnections` enforces it
centrally (a check of a connector that is not added returns a "not set up"
status without calling `status()`, `runAction` and `getCredentials` refuse,
`claudeAccount()` is undefined), there is no startup check, and the page
checks only added connections (on open, Check, Check all, and on window focus
only after a sign-in started there). New connectors need nothing extra, but
must not run code outside `status()`, actions, `credentials()`, `afterSave`
and `afterRemove`. Other
backends get credentials with `require('../connections/index.cjs').getCredentials(kind)`
in the main process; the page never receives secrets. Secret fields are
encrypted with safeStorage in `%APPDATA%\MonoRail\modules\connections`
(saving refuses without encryption). Connectors so far: `gcloud` (detects
the CLI login and Application Default Credentials; sign-in runs
`gcloud auth login` then `gcloud auth application-default login`),
`atlassian` (site + email + API token, pasted or read each time from a named
generic credential in Windows Credential Manager via PowerShell CredRead,
never copied; Jira+ uses it) and `claude` (Claude Code / Agent SDK
login read from `~/.claude/.credentials.json` without exposing tokens; sign-in
opens a terminal running `claude auth login`). The Claude connector also sorts
the login into an **account type** (Subscription, API, Enterprise, Unknown)
from `claude auth status --json` (falling back to the credentials file and
which auth environment variables are set, never their values), shown as a
badge; its one setting, `accountType`, overrides the detection. Signing in
through claude.ai does not mean a subscription: Enterprise logins bill at API
prices. Anything that shows Claude costs uses it (`claudeAccount()` in
`electron/connections/index.cjs`, `useClaudeAccount()` and
`ClaudeAccountBadge` in `src/modules/connections`; Claude Stats shows it, Home
reads it from `connections.summary`). `pi` detects the pi coding agent with
Chat's `findPiSdk` (either npm package name), its version, and the providers
in pi's `auth.json` (names and login kind only; credential values are dropped
on parse). Its one setting is **scoped models** (default
`anthropic/claude-haiku-5-5, anthropic/claude-sonnet-5-5,
anthropic/claude-opus-5-5`): saving the connection (connector `afterSave`) or
its "Apply scoped models" action writes them as `enabledModels` in pi's global
`settings.json` (`PI_CODING_AGENT_DIR` or `~/.pi/agent`), as pi's own
`/scoped-models` does, under pi's `settings.json.lock` and keeping every other
key; the check flags when pi's list has drifted. **openai** covers an OpenAI API key (OPENAI_API_KEY variable, pasted and
encrypted, or a Credential Manager entry read each time) and the Codex CLI.
Its check starts no program and makes no request: variables are checked for
presence only, `codex` is found on PATH by file (version from its npm
package.json), and Codex's `auth.json` (`CODEX_HOME` or `~/.codex`) yields only
the login mode and ChatGPT plan claim; a keyring login is reported, not read.
The one request, `GET /v1/models`, is the user's "Test API key" action (result
kept in memory, keyed by a hash of the key). Connectors must not probe for
accounts the user has not added. Connectors may be **subconnectors**
(`parent: '<kind>'`), drawn inside the parent's card under "Add-ons". The
first is **pi > Playwright browser** (`connectors/pi-playwright.cjs`): pi's
`pi-playwright` skill package drives the user's own Chrome or Edge tabs via
`@playwright/cli attach --extension`, which opens the Playwright Extension's
connect page (extension id `mmlmfjhmonkocbjadbfplnigmagldckm`) where the user
picks a tab. The check reads pi's `packages` list and the installed
package.json files, and in the browser's user data folder only the last-used
profile name and which profile folders have the extension. It reports whether
`PLAYWRIGHT_MCP_EXTENSION_TOKEN` is set, never its value. Settings: browser,
profile folder, and "Teach pi", which writes a MonoRail-marked
`use-my-browser` skill to pi's skills folder (never overwrites a foreign one;
removed when off or on removal). Actions: install in pi (terminal), get the
extension (store page in the chosen browser), and Test connection (attach then
detach, run with MonoRail's executable as Node, no shell). **github** is the github.com account GitHub+ uses
(`connectors/github.cjs`, client `electron/connections/github-api.cjs`): the
user's own GitHub CLI login (default; MonoRail runs `gh api` with fixed
arguments, request bodies on stdin, and never reads the token), a pasted token
(encrypted) or a Credential Manager entry read each time. `credentials()`
returns `{ via: 'gh' }` or `{ via: 'token', token }`; only api.github.com is
called. `hasConnection(kind)` in `index.cjs` says whether a connection is
added without running anything. `git` stores nothing and
reports the version, global `user.name` / `user.email` and the credential
helper's name; it never runs `git credential`. Command-line tools only get
fixed arguments (`run.cjs`). Tests: `electron/connections/connections.test.cjs`.

`mcp` (**Agent access**, under Configure) shows how to connect agents to
MonoRail's **MCP server** (`electron/mcp`, docs: `docs/mcp.md`). Agents start
it as `MonoRail.exe --mcp`: `main.cjs` then opens no window and runs
`electron/mcp/server.cjs` in `ELECTRON_RUN_AS_NODE` mode with stdio inherited
(`launch.cjs`; the launcher's own Chromium files go to a temp folder, never a
data folder). stdio only, never a network port; stdout carries protocol
messages only (logs go to stderr, metadata only). The protocol layer
(`protocol.cjs`, no SDK dependency) and tools (`tools.cjs`) run outside
Electron, so tools read MonoRail's data folder from disk and never `require`
Electron: summary files (`claude-stats.summary`, `connections.summary`, the
latter written after every connection check), Chat's `listSessions` (allowed
folders only), GitHub+ issues for repos in its recents only, and Jira+'s local
repo (never created by a read; `apps/jira-plus/data-dir.cjs` resolves the
legacy folder). No tool returns secrets or tokens. **Write tools** (`write:
true` in `tools.cjs`: create/comment on GitHub+ and Jira+ local issues,
add Flashcards cards) are
off for every agent until the user turns each one on per agent on the page;
the server checks `access.json` on every call (`access.cjs`; the agent is the
self-reported `clientInfo.name`, recorded on first connect with nothing
allowed; only the page grants). Every call goes to `audit.jsonl` (agent, tool,
outcome, ms, a one-line `did` for writes; never arguments or results),
shown under Activity. Both files are in `modules/mcp`. `ask_coordinator` (write)
runs a coordinator turn from the server process and `check_coordinator_reply`
reads back only turns that connection started. A new write tool must
set `write: true` and call `ctx.did()`. **Extension tools** (manifest
`contributes.mcpTools`, API 1.2; `electron/mcp/extensions.cjs`) are named
`<id with _>__<name>`, always need consent (`consent: true`, whatever
`write` says), and run the extension's backend in the MCP server's own
`BackendHost` (same sandbox and data folder, `ctx.runningIn = 'mcp'`, no
secrets since safeStorage needs Electron, never `manager.init()`; refused
until the app has recorded the extension's current data version, so
`migrate()` only runs in the app). Jira+ local writes take a lock file
in its `.git` so the app and the server never commit at once. Tests:
`electron/mcp/mcp.test.cjs` (includes a real stdio run).

`storage` (**Storage**, under the **Utilities** section) is the Storage
Manager (docs: `docs/storage.md`): free/used space per drive (`fs.statfs`,
read on open) and the size of known folders (MonoRail's data, older data
folders, install and updater cache; Claude Code, Claude desktop, pi, Repos;
npm/pnpm/Yarn/Bun/pip/Playwright/Electron caches; Temp, Downloads,
hiberfil/pagefile), all built from environment folders. Folders are measured
only when the user presses Scan (45 s per folder, links and junctions never
followed). Each finished scan, and a drives-only sample every 6 hours while the
app runs (`start(ctx)`), is saved to the `storage.history` cache
(`history.json`, newest 500) for the "Over time" card and the per-folder change
since the previous scan; after a restart the last saved scan is shown. It
never deletes, moves, renames or copies anything it measures (a test greps the
backend for write calls; history goes through the cache primitive); actions only open a folder in Explorer by location id or the Windows
storage settings. Any future cleanup must be explicit, confirmed per item, and
limited to caches marked safe.

`flashcards` (**Flashcards**, under Workspace; docs: `docs/flashcards.md`) keeps
spaced repetition decks. Decks, cards (Markdown, rendered with Chat's
`ChatMarkdown`) and per-day study counts (90 days) live in one file,
`decks.json` in its data folder; nothing is cached or sent anywhere.
`flashcards-store.cjs` has no Electron dependency because the MCP server uses
it too: every change takes `decks.json.lock`, reads the file fresh and writes
it atomically, and a damaged file is never treated as empty or overwritten.
`flashcards-fsrs.cjs` is the scheduler: FSRS-5 with its default weights, learning
steps 1m/10m, relearning 10m, per-deck target recall (default 0.9) and new
cards per day (default 20); the page shows each rating's next interval from
`study`. Undo keeps the last answer per deck in memory only. Do not call it or
style it after any other product. MCP: `list_flashcard_decks`,
`list_flashcards` (read) and `add_flashcards` (write, consent per agent).

Nav items may have one level of subpages (`NavItem.children` in `nav.ts`); a
module nests under an item with `nav.parent: '<path>'`. The drawer draws them as
a collapsible tree (plain rows on a guide line, current page tinted; open/closed
per group in `commandHub.navOpen`), and on the icon rail as a menu.

### Charts

Follow the data-viz rules already encoded in `components/charts/`: series
colors come from `--series-1..6` in fixed order (never cycled; extra series
fold into "Other"), rank entities on the full dataset so filters never
repaint them, one y-axis per chart, a legend for 2+ series, a table view
beside every chart, thin marks (bars <= 24px, 2px lines), and one hero
figure per page.

## Apps: experiences with their own look inside the hub

An **app** is the second building block, next to modules. Where a module is
one page in the hub's own style, an app may look and feel like its own
product: its own colors, fonts, layout and in-app routing. The contract is
`AppDefinition` in `src/apps/types.ts`; its `placement` says where it sits.

**Workspace apps** (`placement: 'workspace'`: GitHub+, Jira+, Email) are
Workspace pages. The hub's drawer and top bar stay on screen (breadcrumb
`Workspace > <app>`) and the app fills the page body below them, scrolling on
its own (`AppBody` in `App.tsx`). Each gets a nav item under Workspace that
stays current on all of the app's routes (`matchPrefix`). Going back to one
from the nav resumes where it was left; clicking its item while in it goes to
its start page (`src/apps/session.ts`).

**Full-screen apps** (the default, and always for extension apps) take over
the whole window. **Apps** is a single nav item right under Home, shown only
while there is one; it opens the Apps page (`src/pages/AppsPage.tsx`) with a
card per full-screen app. The one thing such an app never owns is the **hub
bar**: `src/apps/AppFrame.tsx` renders a 48px bar above it, in the drawer
colors of the current color scheme, with a "Back to MonoRail" button (filled
like the active nav item), the app's icon and name, and an "App" chip. That is
how users leave the app; do not hide, restyle or duplicate it inside an app.
Leaving returns to the hub page the user came from, and reopening it resumes
where it was left. An error boundary keeps the bar (or the drawer) on screen
if an app crashes.

To add an app:

1. `src/apps/<id>/index.ts` exports an `AppDefinition` (id, title,
   description, icon, `path: '/apps/<id>'`, `placement`, lazy `component`).
2. Add it to `src/apps/registry.ts`. The nav (or Apps page) and router pick it up.
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
Recent repo paths are kept in its data folder, never in the repo. Repos other
MonoRail apps create are listed with them automatically (`linked.cjs`): so
far Jira+'s private projects repo (found with `resolveJiraDataDir`, shown as
"Jira+ projects" with a Jira+ badge, not removable, never written to
`recents.json` until opened). It is not added to Chat's allowed folders. It makes no
network requests of its own (remote images in READMEs are blocked and external
links do nothing) except through the GitHub connection below. Tests live in
`git.test.cjs`.

**GitHub repos and GitHub issues** (`github.cjs`, tests `github.test.cjs`):
once the user has added the GitHub connection on Connections (never before;
until then the page shows a "Set up GitHub" hint and nothing runs), Home lists
their github.com repos under "On GitHub": `/user/repos` with its default
affiliation (owned, collaborator, organization member), so team repos they do
not own are included. Kept in memory for 10 minutes (Refresh forces), never on
disk. Repos that are already local (matched by the github.com remote, origin
first, read with `git.remotes`) are left out of that list and get a cloud mark
instead. A listed repo can be cloned into a folder the user picks (only repos
in the fetched list, https clone URL built from the name) or opened on
github.com. **New issues stay local by default**: the New issue page offers
"Also create it on GitHub in owner/name" only when the repo has a github.com
remote, and it is off on every new issue. When on, the backend creates the
issue on the repo's own remote (never a repo named by the page), then saves
the local issue with a `github` link (`{ repo, number, url }`); later edits
and comments stay local. The MCP server's GitHub+ tools never publish.

GitHub+ speed: starting a git process is the costly part (on Windows most of
all, and Node starts each one on the main process), so every page uses as few
as it can and `git.cjs` runs at most 6 at a time. A folder lists in one
`ls-tree`; its last-commit column is a second call (`treeLastCommits`, one
`git log --name-only` walk that stops when every entry is found). Ahead/behind
is `branchDivergence`, asked for only by the Branches page (one
`for-each-ref %(ahead-behind:)` on git 2.41+, else one `rev-list` per branch).
Answers keyed by a commit sha (last commits, commit counts, ahead/behind,
parsed issues) are memoized in memory; Home reuses a repo's summary while
`refsFingerprint` is unchanged. Nothing of it is written to disk.

GitHub+ also has **scheduled backups** (Backups tab, `backup.cjs`): per repo,
"X times per hour/day/week" into a folder the user picks (e.g. one OneDrive
already syncs). Each backup is a verified `git bundle --all` file, written as
`.partial` and renamed when complete, with the newest N kept. The scheduler
runs inside MonoRail (checks every minute and at startup, so a backup
missed while the app was closed runs once when it opens; failures retry after
15 minutes). Schedules live in the app's data folder (`backups.json`).

**Global backup folder** (Settings > Backups, docs: `docs/backups.md`,
`electron/backups/`, backend module `backups`): one folder plus the same
"X times per hour/day/week, keep N" choices, saved in `modules/backups`
(`settings.json`, `state.json`). When on, it is the default root for every
page's backups, each in its own subfolder (`<folder>/github-plus/<repo>/`,
`<folder>/jira-plus/`, `<folder>/flashcards/`); `pageRoot(global, id)` builds
it. GitHub+ schedules may follow the global folder (`useGlobalFolder`) and/or
frequency (`useGlobalFrequency`), read when each backup runs; a repo's own
folder or frequency wins when its flag is off, and a schedule that follows a
global folder that was turned off pauses with a reason. Jira+'s private
projects repo (bundle) and Flashcards' `decks.json` (copy, refused when
damaged) run on the global schedule (`service.cjs`, one switch each). Changing
the folder only affects future backups: never move, copy or delete backups in
an earlier folder; pruning touches only MonoRail's own files in the folder it
writes to. New pages with backups add an entry to `PAGES` in `global.cjs`.

GitHub+ also has **local issues** (Issues tab, `issues.cjs`): create, edit,
comment, close and reopen, with Markdown. They are stored inside each repo,
never in AppData: one JSON file per issue in the tree of a commit that
`refs/local-issues` points at, written with git plumbing (`hash-object`,
`mktree`, `commit-tree`, `update-ref` with the old value as a guard), so the
working tree and index are never touched, every change is a commit, backups
carry them and a normal push does not. Keep that ref out of commit feeds
(`--exclude=refs/local-issues --all`).

`jira-plus` (**Jira+**) applies the GitHub+ idea to Jira: a Jira-style
tracker (own look under `.jp`, Your work / Projects / board / list / issue
dialog) where a private local repo is a first-class project next to the
team's real Jira projects. Team issues go through the Jira Cloud REST API
(`electron/apps/jira-plus/cloud.cjs`) with the Atlassian account from
Connections (`getCredentials('atlassian')`); only shown when one is set up.
Jira+ keeps only its JQL filter (`settings.json`). A `connection.json` token
saved by older versions is still used when Connections has no Atlassian
account, until the user forgets it. Private projects are a git repo in `<dataDir>/local-repo`
(`local.cjs`, via `isomorphic-git`, one JSON file per issue, one commit per
change, the issue's git log is its History). That repo never gets a remote;
do not add push or sync to it. Jira+ started as the `jira` module, so if
`%APPDATA%\MonoRail\modules\jira` holds data and the app folder doesn't,
the backend keeps using the old folder in place. Tests live in
`jira-plus.test.cjs`.

**Task <-> repository links** (`repo-links.cjs`, `repo-links.json` in Jira+'s
data folder): any Jira+ task (local or team Jira) can be linked to local git
repos and to repos on github.com, many to many. A local repo is stored by the
root git reports plus the `owner/name` of its github.com remote (checked with
GitHub+'s `git.cjs` when linking); a GitHub-only repo by `owner/name`.
GitHub+ matches a repo by folder or remote, so a link to the GitHub copy also
shows on a local clone. Links are only ever in that file: never written to
Jira, GitHub or a repo, and the file holds keys, folders and names only (team
ticket text is fetched on demand). The issue dialog's **Repositories** card
lists them (local opens in GitHub+ via `openInGitHubPlus`, in memory only;
GitHub-only opens on github.com) and links from GitHub+'s recents, its linked
repos, the "On GitHub" list (only once GitHub is set up) or any folder.
GitHub+ reads them through Jira+'s exported `tasksForRepo` / `repoLinks`
(`<userData>\apps\jira-plus`, legacy folder resolved): a **Tasks** tab per
repo (link/unlink from that side too; tasks open in Jira+ via
`openInJiraPlus`), task counts on Home, and the tasks of a GitHub-only repo
in its "On GitHub" row. Deleting a local task drops its links.

`email` (**Email**) is the third app: mail through pluggable **inbox
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
move into an extension later. Tests live in `email.test.cjs` and
`outlook.test.cjs`.

**Outlook** (`connectors/outlook.cjs`, setup `discover`) uses the classic
Outlook already running and signed in on the PC, over COM, with no OAuth or
app registration. Each call runs `connectors/outlook.ps1` once in a hidden
Windows PowerShell 5.1 process (`helper.cjs`: script on stdin, arguments as
base64 JSON in `MONORAIL_ARGS`, never on the command line or pasted into code;
minimal environment; hard timeout; at most 3 at a time; one JSON answer). The
script attaches with `GetActiveObject` (never starts Outlook), checks Outlook
is running first (error code `not-running`, shown with Retry) and must never
read `Namespace.CurrentUser` (it raises Outlook's address-access prompt; a
test checks). New Outlook has no COM. Setup lists the stores Outlook has open;
an account is one store keyed by StoreID (`account.key`; Gmail's key is the
address), with a display name and an optional address. Shared stores start
**read-only**: the backend refuses every write method for a read-only account
(`assertWritable`), and the page hides write actions. Folders are a tree with
path ids (`Inbox\Reports`); the standard folders use INBOX, DRAFT, SENT, SPAM,
TRASH in any language; a per-account skip list (paths) hides subtrees and
keeps slow mailboxes from being walked. Message ids carry the long EntryID and
the internet message ID: when the EntryID fails (mail moved, e.g. to Archive)
the helper looks it up again and the new id is handed back; lists are
deduplicated by internet message ID. Search looks in the open folder; **All
folders** is an opt-in that stops after 60 s and returns what it found, marked.
All connectors take a days-back and unread filter, and `searchAccounts`
searches several chosen inboxes at once (`search.cjs`: merged newest first,
deduplicated across accounts, per-account errors kept apart). The Windows CI
job runs the real script (expects `not-running`), so syntax errors fail CI.

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

**Versioned API.** `API_VERSION` in `manifest.cjs` (currently 1.2.0) covers
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
API 1.1 added: `ctx.secrets` (safeStorage, stored in
`%APPDATA%\<app>\extension-secrets\<id>.json`, outside every sandbox,
`secrets.cjs`); the error contract (`errors.cjs`: every failed call carries
`code`, `message`, `details`; `EXT_*` codes are MonoRail's, `ctx.fail()` sends
the extension's own; pages call through `extensions.call`, which returns an
envelope because Electron IPC drops error fields); `migrate(ctx, fromVersion)`
before `start()` when the version that last used the data folder changed
(`state.json` `dataVersions`); `ctx.emit` is fire and forget (dropped with no
page open, JSON under 1 MB). Program names in `permissions.process` match
without `.exe`/`.cmd`/`.bat`/`.com` on both sides.
Settings (`settings.cjs`, API 1.1): the manifest's `settings` list (string,
text, number, boolean, select, secret) becomes a generated form in Settings >
Extensions (`modules/extensions/SettingsDialog.tsx`). MonoRail validates and
stores values in `extension-settings/<id>.json`, secret fields encrypted in
`extension-secrets/<id>.settings.json`; backends read `ctx.settings.get()`,
pages `monorail.getSettings()` (no secret values) and get
`monorail.onSettings` via the reserved `monorail.settings` event channel. On
save a backend's `settingsChanged(ctx, values)` runs, or it is restarted.

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
The author docs are `docs/extensions/` (README index, concepts, tutorial,
manifest, page-api, backend-api, permissions, lifecycle, testing,
troubleshooting; plans only in roadmap.md). Reference pages describe what the
code does today: update them in the same PR as any change to the manifest,
`ctx`, the bridge, permissions or error codes.

`wiki` (**Wiki**, under Help) is the in-app copy of `docs/`: every `docs/**/*.md`
is bundled at build time (`import.meta.glob` `?raw` in
`src/modules/wiki/content.ts`, so it is offline and matches the installed
version). Open a page from elsewhere with `openWiki(id, anchor)` from
`modules/wiki/store.ts` (a test checks every `openWiki('<id>')` exists).

### The wiki is a linked notebook (Obsidian-style): write docs that way

The owner wants the wiki read by **hopping between linked pages**, not by
hunting in the page list: if a reader has to use the nav panel, the docs have
failed. Treat every doc as a node in a web of knowledge:

- **Link heavily, inline.** Every time a page mentions an idea another page
  explains (a feature, a term from `docs/guide/glossary.md`, a rule, a
  setting), link it, to the heading if there is one (`page.md#heading`).
  Use normal relative Markdown links so they also work on GitHub; the wiki
  turns them into in-app links with a hover preview. Link both ways: when you
  add a page, also add links *to* it from the pages that mention its topic.
- **No orphans, no dead ends.** `electron/docs.test.cjs` fails when a doc has
  no audience tag, a link points at a missing file or heading, a doc is
  linked from nowhere, or a guide links to fewer than four other pages.
- **Folders nest to any depth.** The page list is a collapsible tree built
  from the folders under `docs/` (open state in `commandHub.wiki.open`; the
  folders around the open page always open). A folder's `README.md` is its
  index page: it introduces the section and links each page in it; the wiki
  adds an "In this section" grid below it. Give it front matter `folder:
  <short name>` for the tree. Order inside a folder is `ORDER` in
  `content.ts` (optional; unlisted pages follow by title). Prefer a new
  subfolder over a long flat folder.
- **Every page shows its neighbours**: clickable breadcrumbs (folder index
  pages), "Linked from" (backlinks) and "Links on this page", plus
  previous/next in reading order. Keep pages short and focused so they link
  rather than repeat.

**Audience tags.** Every doc starts with front matter
`---\naudience: human, ai\n---` (one or both; optional `summary:` for cards
and previews, `folder:` on a README). `human` pages are plain-language guides
anyone can follow without code; `ai` pages are dense reference for agents and
developers (exact files, contracts, rules). The wiki filters on it (People /
Agents / All, `commandHub.wiki.audience`, default People) and badges each
page. `docs/guide/` holds the human guides, in subfolders (`agents/`,
`workspace/`, `setup/`), shown as "Start here" cards (icons in `ICONS` in
`WikiPage.tsx`); Home's "Get started" cards open them. A user-facing feature
should get a guide page (or a section in one) in the same PR, linked from its
folder index and from the pages that mention it. Guides must not contain
personal paths, names or test-user details.

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
  on the right the full screen toggle (F11). Color scheme and light/dark mode
  are only in Settings > Appearance. Nothing else lives there unless it is
  page-wide status (the Bot Dashboard puts live pills there).
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

- **Palettes.** `src/lib/palettes.ts` holds the color schemes ported from
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
