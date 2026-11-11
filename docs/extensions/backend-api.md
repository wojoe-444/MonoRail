---
audience: ai
---

# Backend API

The backend is the file named by `backend.main`. MonoRail runs it in its own
process under Node's permission model (see [Permissions](permissions.md)), with
MonoRail's own Node runtime (Node 22). No separate Node install is needed.

```js
// backend/index.cjs
/** @type {import('../monorail-sdk/backend').Backend} */
module.exports = {
  async migrate(ctx, fromVersion) {},      // optional: bring ctx.dataDir up to this version
  async start(ctx) {},                     // optional: runs once when the process starts
  async stop(ctx) {},                      // optional: runs before the process is stopped
  async settingsChanged(ctx, values) {},   // optional: the user saved new settings
  methods: {
    async getStatus(ctx, args) {
      return { online: true }
    },
  },
}
```

CommonJS (`.cjs`) and ES modules (`.mjs`, `export default { methods }` or
named exports) both work. `methods` is required. Every function in it can be
called from your pages with `monorail.invoke(name, args)`.

## Hooks, in order

| Hook | When | If it throws |
| --- | --- | --- |
| `migrate(ctx, fromVersion)` | Before `start`, only when the version that last used the data folder differs from this version. See [Data across versions](#data-across-versions). | The backend doesn't start (`EXT_START_FAILED`), and migrate runs again on the next start. |
| `start(ctx)` | Once, when the process starts. | The backend doesn't start (`EXT_START_FAILED`). |
| methods | On each `monorail.invoke()`. Calls can overlap: one doesn't wait for another. | The page gets the error. See [Errors](#errors). |
| `settingsChanged(ctx, values)` | After the user saves settings, while the backend runs. Without this hook MonoRail **restarts** the backend instead, so `start()` reads the new values. | Logged. The new values are saved anyway. |
| `stop(ctx)` | Before MonoRail stops the process (turn off, remove, reload, update, a folder granted or revoked, quit). | Ignored. The process ends anyway, after at most 3 seconds. |

Loading the file, `migrate` and `start` together must finish within **20
seconds**, or the start fails. Do slow work (connecting to a server) in the
background from `start`, not awaited.

## `ctx`

| Property | Type | What it is |
| --- | --- | --- |
| `apiVersion` | string | MonoRail's extension API version, e.g. `"1.2.0"`. |
| `runningIn` | `'app'` \| `'mcp'` | API 1.2. `'mcp'` when the process was started for an agent's tool call. See [When an agent calls a tool](#when-an-agent-calls-a-tool). |
| `extension` | `{ id, name, version }` | From your manifest. |
| `dataDir` | string | Your private, writable folder: `%APPDATA%\MonoRail\extension-data\<id>`. Also the working directory. Kept across updates, reloads and a Remove that keeps the data. |
| `extensionDir` | string | Your installed files (read-only). For a development folder, the folder itself. |
| `folders` | `{ path, write }[]` | Folders the user granted through `monorail.pickFolder()`. |
| `permissions` | object | Your normalized permissions: `{ network, process, filesystem: { read, write, pickFolders } }`. |
| `log(...)`, `warn(...)`, `error(...)` | | Lines in **Backend logs** (the extension's `…` menu). `console.log` and `console.error` land there too. The last 300 lines are kept, in memory only. |
| `emit(channel, payload)` | | Push an event to open pages. See [Events](#events). |
| `fail(code, message, details?)` | never returns | Throws an error with your code. See [Errors](#errors). API 1.1. |
| `secrets` | | Encrypted secret storage. See [Secrets](#ctxsecrets). API 1.1. |
| `settings` | | The user's settings. See [Settings](#ctxsettings). API 1.1. |

The environment is minimal: `PATH`, `HOME`/`USERPROFILE`, `LANG`, `TZ` and a
few Windows basics. Nothing from the user's environment that could hold a
token is passed on. `TMP`, `TEMP` and `TMPDIR` point to `<dataDir>/tmp`.

## When an agent calls a tool

API 1.2. When an agent calls one of your [MCP tools](manifest.md#mcp-tools),
MonoRail's MCP server (a separate process the agent started, not the app)
starts your backend itself and calls the tool's method with the agent's
arguments. It is the same backend file, the same sandbox and permissions,
the same `dataDir` and granted folders, with `ctx.runningIn === 'mcp'`.
What differs:

- `ctx.secrets` rejects with `EXT_SECRETS_UNAVAILABLE`: decrypting needs the
  app. Secret [settings](#ctxsettings) read as `null`; other settings work.
- `ctx.emit` reaches no page.
- `migrate()` never runs there. A tool call is refused until the app has
  started the backend once after an install or update.
- The app and an agent can run your backend **at the same time**, on the
  same data folder. Write files atomically (write a temporary file, then
  rename it) and re-read state instead of keeping it only in memory.
- The process ends when the agent's session ends, after `stop(ctx)`.

Errors you throw (or `ctx.fail`) reach the agent as the tool's error text.

## Errors

Every failed call reaches the page as a `MonoRailError` with `code`,
`message` and, optionally, `details` (API 1.1). How the code is chosen:

1. **Your own code**: `ctx.fail('NOT_SIGNED_IN', 'Sign in first', { url })`,
   or `throw Object.assign(new Error('...'), { code: 'NOT_SIGNED_IN', details })`.
   A code is a short identifier: a letter first, then letters, digits, `_`,
   `.` or `-`, up to 64 characters. `details` must be JSON, up to 64 KB.
   Larger or non-JSON details are dropped.
2. **Node's code**, if the error has one (`ENOENT`, `ECONNREFUSED`, ...).
3. **`EXT_BACKEND_ERROR`** for anything else (a plain `throw new Error(...)`).

Stacks stay in the backend. Each failed call is also logged as a warning:
`getStatus failed: [NOT_SIGNED_IN] Sign in first`.

Codes from MonoRail itself (also exported as the `MonoRailErrorCode` type):

| Code | When |
| --- | --- |
| `EXT_BACKEND_ERROR` | Your backend threw without a usable code. |
| `EXT_UNKNOWN_METHOD` | There is no method with that name. |
| `EXT_TIMEOUT` | The call took longer than 2 minutes. |
| `EXT_NOT_ACTIVE` | The extension is turned off, needs permission approval, or is incompatible or broken. |
| `EXT_NO_BACKEND` | The manifest has no backend. |
| `EXT_START_FAILED` | Loading, `migrate` or `start` threw, or the start took longer than 20 seconds. |
| `EXT_CRASHED` | The process exited during the call, or it was stopped after crashing 3 times in a minute. |
| `EXT_BAD_PAYLOAD` | An argument, result or event payload isn't plain JSON or is too large, or an event channel is invalid or reserved. |
| `EXT_NETWORK_DENIED` | A connection to a host not in `permissions.network`. |
| `EXT_PROCESS_DENIED` | Starting a program not in `permissions.process`. |
| `EXT_FS_DENIED` | Reading or writing a file outside the folders you may use. |
| `EXT_SECRETS_UNAVAILABLE` | The system offers no encryption, so secrets can't be saved. |
| `EXT_INVALID_SECRET` | A secret name or value breaks the rules. |
| `EXT_INVALID_SETTINGS` | A settings value doesn't fit its field (`details.field` names it). |
| `EXT_HOST_ERROR` | MonoRail couldn't complete a request (e.g. picking a folder failed). |
| `EXT_NOT_IN_MONORAIL` | Page only: the page isn't running inside MonoRail. |

## Events

`ctx.emit(channel, payload)` pushes `payload` to every open page of your
extension that listens with `monorail.on(channel, cb)`.

- **Fire and forget.** Nothing is queued. With no page open, the event is
  dropped, and `emit` doesn't tell you. Keep the state in the backend and let
  pages load it with a method when they open.
- `payload` must be plain JSON under 1 MB, otherwise `emit` throws
  `EXT_BAD_PAYLOAD`. `channel` is 1 to 100 characters. Names starting with
  `monorail.` are reserved.
- Events from one backend arrive in the order they were emitted.
- You can emit from `start`, timers or callbacks, not only from methods.

## `ctx.secrets`

API 1.1. For tokens and passwords. MonoRail encrypts each value with the
operating system's key store (DPAPI on Windows) and keeps it in its own
folder, outside your sandbox. Your backend can't read the file and nobody
else's backend can reach your secrets.

```js
await ctx.secrets.set('token', token)       // string, up to 64 KB
const token = await ctx.secrets.get('token') // string, or null if not set
await ctx.secrets.delete('token')
const names = await ctx.secrets.list()       // ['token']: names only
```

- Names: 1 to 100 characters of `A-Z a-z 0-9 . _ -`. At most 100 secrets.
- If the system has no encryption, `set` (and `get` of an existing value)
  rejects with `EXT_SECRETS_UNAVAILABLE`. Nothing is ever stored as plain
  text, so tell the user instead of falling back to a file.
- Secrets survive updates and a Remove that keeps the data. "Also delete its
  data" deletes them.
- Don't write secrets to `ctx.dataDir`, logs or event payloads.

If the user should type the secret in, declare a `secret` field in
[`settings`](manifest.md#settings) instead. MonoRail then draws the input
and you read it with `ctx.settings.get()`. Use `ctx.secrets` for values your
backend obtains itself, such as an OAuth refresh token.

## `ctx.settings`

API 1.1. The values of the [settings](manifest.md#settings) your manifest
declares, as the user saved them:

```js
const { server, port, password } = await ctx.settings.get()
// every field: saved value, else default, else null (false for booleans); secret fields decrypted
```

Read them when you need them, or in `start` plus `settingsChanged`. MonoRail
validates values against your field definitions before saving, so you get the
types you declared. Required fields can still be `null` until the user fills
them in, and the Extensions page shows "Needs setup" meanwhile.

## Data across versions

`ctx.dataDir` is yours and MonoRail never changes its contents. When your
data format changes between versions, use `migrate`:

```js
async migrate(ctx, fromVersion) {
  if (fromVersion === null) return              // fresh install, or MonoRail has no record
  if (compareVersions(fromVersion, '2.0.0') < 0) await convertV1Notes(ctx.dataDir)
}
```

- MonoRail remembers which version last started successfully past `migrate`
  on this data folder. `migrate` runs whenever that differs from the current
  version: after an update, after a downgrade (`fromVersion` is newer than
  `ctx.extension.version`, so refuse or convert back), and on the first start
  (`fromVersion` is `null`).
- `null` means MonoRail has no record. That's a fresh install, or data from
  before API 1.1. Look at the folder if that matters.
- If `migrate` throws, nothing is recorded and it runs again on the next
  start. Make it safe to run twice: write to a new file and rename it.
- The record survives a Remove that keeps the data, so a reinstall migrates
  from the old version. "Also delete its data" clears it.
- A development folder whose version you don't change doesn't migrate on
  Reload.

## Limits

| What | Limit |
| --- | --- |
| Start (load + `migrate` + `start`) | 20 seconds |
| One method call | 2 minutes |
| Result | 16 MB of JSON |
| Event payload | 1 MB of JSON |
| Error `details` | 64 KB of JSON |
| Crashes | 3 in a minute stops the backend until the user reloads it |
| Logs kept | 300 lines, in memory |
