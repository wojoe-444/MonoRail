# MonoRail extensions: plan and design

MonoRail is the app people install. Extensions are what they add on top of it
for their own situation: modules (pages inside the hub) and apps (full-screen
experiences) that are built and released in **their own repositories** and
installed into a running MonoRail, without rebuilding MonoRail.

The first real one will be the Minecraft bot: its own repo, built as a
MonoRail extension, released on GitHub, and installed from Settings >
Extensions.

## Status

| Step | What | State |
| --- | --- | --- |
| 1 | Runtime: manifest + versioned API, install/update/remove, sandboxed UI and backend, Settings > Extensions | [PR #13](https://github.com/wojoe-444/MonoRail/pull/13) |
| 2 | SDK (`packages/extension-sdk`), starter/sample extension (`extensions/hello-monorail`), packaging script, release workflow for extension repos, CI checks | Next PR |
| 3 | Minecraft bot moved into its own repo as an extension | After step 2 |
| Later | Ideas below, as real extensions need them | Not started |

## How it fits with modules and apps

| | Built-in module / app | Extension |
| --- | --- | --- |
| Lives in | this repo (`src/modules`, `src/apps`) | its own repo |
| Ships with | every MonoRail release | its own GitHub releases |
| UI | React in the hub's renderer | static files in a sandboxed iframe |
| Backend | main process, full access | its own process, only what the user approved |
| Nav, routes, hub bar | registries | the same registries (`allModules()`, `allApps()`) |

Routes: an extension module is `/x/<extension>/<module>`; an extension app is
`/apps/<extension>.<app>` and gets the standard hub bar with "Back to
MonoRail".

## The package

A folder or `.zip` with `monorail.json` at its root:

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
  "permissions": {
    "network": ["*.mojang.com", "localhost:25565"],
    "process": ["java"],
    "filesystem": { "read": ["~/.minecraft"], "pickFolders": true }
  }
}
```

- `ui` is a folder of built static files (any framework; the starter uses
  Vite + React + Tailwind with MonoRail's design tokens).
- `backend.main` is a Node module exporting `{ methods, start?, stop? }`.
  `activation: "startup"` starts it with MonoRail (for bots and schedulers);
  `onDemand` starts it on the first call.
- Icons are single-color SVGs; MonoRail tints them like its own nav icons.

## Versioned API

The extension API is versioned with semver and is currently **1.0.0**. It
covers three things that change together: the manifest format, the backend
`ctx`, and the page bridge protocol. An extension states the range it was
built for in `engines.monorail`.

- Minor versions only add things, so an extension built for `^1.0.0` keeps
  working on every 1.x MonoRail.
- A major version may break extensions. Those stay installed but are not
  loaded, with a message to update.

### Page API (`monorail-sdk/client.js`)

```js
import { monorail } from '../monorail-sdk/client.js'

const info = await monorail.ready()            // { extension, contribution, theme, apiVersion }
const status = await monorail.invoke('getStatus')
monorail.on('chat', (line) => { /* pushed by the backend */ })
const folder = await monorail.pickFolder({ write: true })   // user picks; backend gains access
await monorail.openExternal('https://minecraft.wiki')
```

The client also keeps the page in light/dark with MonoRail and, for module
pages, sizes the frame to the content.

### Backend API

```js
module.exports = {
  async start(ctx) { /* connect the bot, start timers */ },
  async stop(ctx) { /* clean up */ },
  methods: {
    async getStatus(ctx, args) { return { online: true } },
  },
}
```

`ctx` gives `dataDir` (private, writable, kept across updates),
`extensionDir`, `folders` (user-granted), `permissions`, `log/warn/error`
(shown under "Backend logs"), and `emit(channel, payload)` to push events to
open pages.

## Security model

Extensions may come from anyone, so they get no access by default and the
user approves anything more when installing.

**Pages** run in a sandboxed iframe on their own origin
(`monorail-ext://<id>/`) with a strict Content Security Policy: no inline
scripts, no remote scripts or images, and no network at all. They can't see
MonoRail's window, its data, or other extensions. The only way out is the
bridge, and the hub only forwards three things: call the extension's own
backend, ask the user for a folder, open an https link.

**Backends** run in their own process, never inside MonoRail's main process,
under Node's permission model:

| Access | Default | With permission |
| --- | --- | --- |
| Own files | read | |
| Own data folder | read + write | |
| Other files | none | `filesystem.read` / `write` paths under `~`, or folders the user picks |
| Network | none | `network`: listed hosts (optionally with port), or `true` for any |
| Run programs | none | `process`: listed programs, or `true` (full trust) |
| Environment variables | minimal set, no secrets from the user's environment | |
| Workers, native addons, WASI | none | |

Node's permission model doesn't cover the network, so MonoRail adds a guard
in the backend process that checks every outgoing connection (net, TLS,
HTTP(S), fetch, WebSocket), UDP and DNS against the declared hosts.

Running programs is labeled **full trust** in the UI: a started program is
not sandboxed. A backend that crashes three times in a minute is stopped until
the user reloads it.

## Install, update, remove

From Settings > Extensions:

- **From a GitHub release**: `owner/name`; MonoRail downloads the
  `*.monorail.zip` attached to the latest release. The package's
  `repository` must match the repo it came from.
- **From a .zip** or **from a folder** (copied in).
- **Load a folder for development**: read in place, with a Reload button,
  for extension authors.

Every install is staged and validated first (manifest, unsafe zip paths, size
limits). Nothing runs until the user reviews a consent dialog listing what the
extension adds and what it will be able to access, with risk levels.

- **Updates**: "Check for updates" compares GitHub releases with installed
  versions; updating shows the consent dialog again and highlights new
  permissions. If an update or reload asks for more access, the extension is
  turned off until approved.
- **Turn off / on** without uninstalling.
- **Remove** deletes the extension's files; its data is kept unless the user
  ticks "Also delete its data".

Where things live (always under MonoRail's AppData folder, never in a repo):
`extensions/<id>` (installed files), `extensions/state.json` (enabled,
source, granted permissions and folders), `extension-data/<id>` (the
extension's own data).

## Building an extension (step 2)

1. Start from the template:
   `npx degit wojoe-444/MonoRail/extensions/hello-monorail my-extension`
2. Edit `monorail.json` (id, name, repository, permissions) and the UI and
   backend.
3. `npm run dev` previews the UI in a browser with sample data; in MonoRail,
   use **Load a folder for development** and **Reload** after each build.
4. `npm run pack` builds and writes `release/<id>-<version>.monorail.zip`.
5. Push a `v<version>` tag: the template's release workflow attaches the zip
   to a GitHub release, and users install or update from `owner/name`.

## Later (not planned in detail yet)

- A catalog of known extensions in Settings, so users don't need to type a
  repo name.
- Signed packages / publisher verification.
- Per-extension settings UI generated from the manifest.
- Letting extensions read selected MonoRail data (e.g. agents) through
  explicit, permissioned host APIs.
- Native addon support behind its own permission.
