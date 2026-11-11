# Manifest reference (`monorail.json`)

Every extension has a `monorail.json` at its root. MonoRail validates it when
you install, update or reload. If anything is wrong, nothing is installed and
the error names the field, e.g. `contributes.modules[0].id must be kebab-case`.
The rules live in `electron/extensions/manifest.cjs`, and this page follows them.

Fields not listed here are ignored. That lets newer manifests load on older
MonoRail versions, so set `engines.monorail` to the API version that has every
feature you use.

## A complete example

```json
{
  "manifestVersion": 1,
  "id": "minecraft-bot",
  "name": "Minecraft Bot",
  "version": "0.3.0",
  "description": "Runs a bot on your server and shows its chat.",
  "publisher": "Example Publisher",
  "repository": "example-org/minecraft-bot",
  "engines": { "monorail": "^1.1.0" },
  "icon": "icon.svg",
  "ui": "ui",
  "contributes": {
    "modules": [
      { "id": "status", "title": "Bot status", "entry": "index.html#/status", "nav": { "section": "Minecraft", "order": 10 } }
    ],
    "apps": [
      { "id": "console", "title": "Bot console", "description": "Live chat and commands.", "entry": "index.html#/console" }
    ]
  },
  "backend": { "main": "backend/index.cjs", "activation": "startup" },
  "permissions": {
    "network": ["*.mojang.com", "localhost:25565"],
    "process": ["java"],
    "filesystem": { "read": ["~/.minecraft"], "pickFolders": true }
  },
  "settings": [
    { "key": "server", "type": "string", "title": "Server", "default": "localhost", "required": true },
    { "key": "port", "type": "number", "title": "Port", "min": 1, "max": 65535, "default": 25565 },
    { "key": "password", "type": "secret", "title": "Account password" }
  ]
}
```

## Top level

| Field | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `manifestVersion` | number | yes | | Must be `1`. |
| `id` | string | yes | | Kebab-case: lowercase letters, digits and single dashes, starting with a letter (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`), at most 40 characters. **Never change it**: it is the extension's identity, its data folder name and its origin (`monorail-ext://<id>`). |
| `name` | string | yes | | At most 60 characters. Shown in the menu, the Apps page and Settings. |
| `version` | string | yes | | Semver, e.g. `1.2.0` or `1.2.0-beta.1`. Updates compare it. |
| `engines.monorail` | string | yes | | The extension API range you need: `^1.1.0`, `~1.1.0`, `>=1.1.0`, `1.1.0`, `1`, `1.x`, `1.1.x` or `*`. If MonoRail's API version is outside it, the extension stays installed but is not loaded ("Incompatible"). |
| `description` | string | no | `""` | At most 300 characters. |
| `publisher` | string | no | `""` | At most 60 characters. Shown in the consent dialog. |
| `repository` | string | no | | GitHub `owner/name` (a full `https://github.com/...` URL is shortened). **Required to install from GitHub**: it must match the repository the release came from. |
| `icon` | path | no | a puzzle icon | A single-color SVG. MonoRail tints it like its own icons (it is used as a mask, so only its shape counts). |
| `ui` | path | no | `"ui"` if there are contributions | The folder of built static files that MonoRail serves to your pages. |
| `contributes` | object | see below | | `modules` and `apps`. |
| `backend` | object | no | | See [Backend](#backend). |
| `permissions` | object | no | nothing | See [Permissions](#permissions). |
| `settings` | list | no | `[]` | API 1.1. See [Settings](#settings). |

An extension must contribute something: at least one module, one app or a
backend. A backend alone is allowed, e.g. a bot with no UI.

**Paths** (`icon`, `ui`, `entry`, `backend.main`, contribution `icon`) are
relative to the extension folder, use forward slashes, and may not start with
`/`, a drive letter or contain `..`.

## Contributions

`contributes.modules` and `contributes.apps` are lists. All ids in both lists
together must be unique.

| Field | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `id` | string | yes | | Kebab-case, at most 40 characters. |
| `title` | string | yes | | At most 60 characters. The page title, menu label or app card title. |
| `description` | string | no | `""` | At most 200 characters. The module page's subtitle, or the app card's text. |
| `entry` | string | yes | | An HTML file inside `ui`, optionally with a `#hash`: `index.html`, `index.html#/status`. At most 300 characters. Several contributions can share one HTML file and pick their view from the hash. |
| `icon` | path | no | the extension's icon | Single-color SVG. |
| `nav.section` | string | no (modules only) | `"Extensions"` | The menu section the module appears under. At most 40 characters. |
| `nav.order` | number | no (modules only) | `100` | Sort order within the section, lowest first. |

## Backend

| Field | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `backend.main` | path | yes | | The backend's entry file: `.cjs` (CommonJS) or `.mjs` (ES module), exporting `{ methods, migrate?, start?, stop?, settingsChanged? }`. See [Backend API](backend-api.md). |
| `backend.activation` | string | no | `"onDemand"` | `"onDemand"`: started by the first call from a page. `"startup"`: started when MonoRail starts (and after install, enable, reload), for bots and schedulers. |

The backend can only read files inside the extension folder. Bundle its
dependencies into the folder of `backend.main` (or add `--include
node_modules/<pkg>` to `pack.mjs`).

## Permissions

Everything is off by default. Unknown keys are refused, e.g.
`Unknown permission "networking"`. Every permission appears in the consent
dialog, with a risk level. See [Permissions and security](permissions.md) for
exactly how each one is matched.

| Field | Value | Consent line (risk) |
| --- | --- | --- |
| `network` | `true` | "Connect to any server on the internet or your network" (medium) |
| `network` | list of hosts: `"api.example.com"`, `"*.example.com"`, `"localhost:25565"` | "Connect to api.example.com" (low), one line each |
| `process` | `true` | "Run any program on this computer" (high, full trust) |
| `process` | list of program names: `"git"`, `"java"` | "Run the program "git"" (high, full trust), one line each |
| `filesystem.read` | list of paths starting with `~/` | "Read files in ~/.minecraft" (medium) |
| `filesystem.write` | list of paths starting with `~/` | "Read and change files in ~/x" (high) |
| `filesystem.pickFolders` | `true` | "Ask you for access to folders you choose" (low) |

Rules:

- Host entries match `^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:port)?$`, so no
  schemes, paths or IP ranges. IPv4 addresses like `127.0.0.1` are allowed.
  The list is lower-cased, de-duplicated and sorted.
- Program names match `^[A-Za-z0-9._-]+$`: a name, not a path. `java`,
  `java.exe` and `JAVA.EXE` are the same program.
- Filesystem paths must start with `~/` (the user's home folder) or be `~`,
  and must not contain `..`. A path in both `read` and `write` counts as write.
- `network: false`, `process: false` and an empty `filesystem` are the same as
  leaving them out.

If an update or a development reload asks for permissions the user hasn't
approved yet, the extension is turned off ("Needs approval") until they approve.

## Settings

API 1.1. A list of fields that MonoRail turns into a form under **Settings >
Extensions > Settings**. MonoRail stores and validates the values. Your backend
reads them with [`ctx.settings.get()`](backend-api.md#ctxsettings), and your
pages with [`monorail.getSettings()`](page-api.md#settings). At most 50 fields.

| Field | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `key` | string | yes | | Starts with a letter, then letters, digits and `_`, at most 40 characters. Unique. |
| `type` | string | no | `"string"` | `string`, `text` (multi-line), `number`, `boolean`, `select`, `secret`. |
| `title` | string | yes | | At most 60 characters. The field's label, also used in error messages. |
| `description` | string | no | `""` | At most 300 characters. Help text under the field. |
| `default` | matches `type` | no | `null` (`false` for `boolean`) | Must itself be valid for the field. Not allowed for `secret`. |
| `required` | boolean | no | `false` | Not for `boolean`. A required field with no value shows "Needs setup" on the Extensions page. |
| `placeholder` | string | no | | `string`, `text`, `secret`. At most 100 characters. |
| `maxLength` | integer | no | 1000 (`text`: 10000, `secret`: 65536) | `string`, `text`, `secret`. Capped at those values. |
| `min`, `max`, `step` | number | no | | `number` only. |
| `options` | list | yes for `select` | | 1 to 50 entries, each `"value"` or `{ "value": "...", "label": "..." }`. |

How values behave:

- A field the user never set reads as its `default` (or `null` / `false`).
- Clearing a field in the form resets it to the default.
- If a stored value no longer fits after you change the field in a new version
  (e.g. a removed `select` option), it reads as the default.
- `secret` fields are encrypted with the operating system's key store and
  never sent to pages. Pages only learn whether a value is set.
- Changing `settings` in an update needs no approval: settings are not
  permissions.
