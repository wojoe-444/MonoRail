---
audience: ai
summary: How Remote access works: the 127.0.0.1 server behind Tailscale serve, login allowlist, device pairing, the phone-safe policy and the files it keeps.
---

# Remote access

Optional, off by default: use MonoRail from a phone over the PC's private
Tailscale address. The person-facing guide is
[use MonoRail from your phone](guide/setup/remote-access.md). With it off the
app behaves exactly as without it: no server, no port, no Tailscale command,
no single-instance lock, closing the window quits.

## Pieces

| File | Role |
| --- | --- |
| `electron/remote/service.cjs` | One per process: state, start/stop, Tailscale checks every 5 minutes, pairing codes. `readEnabledSync` for `main.cjs` before ready. |
| `electron/remote/server.cjs` | The HTTP server on `127.0.0.1:<port>` (default 5170): host, login and device checks, pairing page, the [bridge](#the-bridge), static files from `dist/`. No Electron dependency. |
| `electron/remote/policy.cjs` | `REMOTE_METHODS` classifies each built-in backend method. `remoteRefusal` enforces phone access. |
| `electron/remote/store.cjs` | `settings.json`, `devices.json`, `audit.jsonl`. |
| `electron/remote/tailscale.cjs` | `tailscale status --json`, `tailscale serve status --json`, and the one write, `tailscale serve --bg http://127.0.0.1:<port>` (the person's "Set it up" button). |
| `electron/modules/remote.cjs` | The `remote` backend for Settings > Remote access (`src/modules/remote`). |

## Request checks, in order

1. **Host** is the tailnet name (`<pc>.<tailnet>.ts.net`, with or without
   `:443`) or loopback with the port, else 421.
2. **Tailscale login**: the `Tailscale-User-Login` header that Tailscale
   serve adds must be in `allowedLogins`, else 403. The first check that finds
   the PC's login fills the list once, if nobody has set it yet. Removing the
   last login keeps the list empty across checks and restarts.
3. `/__remote/pair` is the only path without a device: GET shows a form, POST
   checks the Origin (`https://<tailnet name>`), takes the one-time code
   (2 minutes, single use, only the newest counts), adds a device and sets
   the `monorail_device` cookie (HttpOnly, Secure, SameSite=Strict, 400
   days). Only the key's sha-256 is stored.
4. Everything else needs a paired device's cookie, else 401. `lastSeen` is
   written at most once a minute.

Every response carries a strict CSP (`script-src 'self'`,
`frame-ancestors 'none'`), `nosniff`, `no-referrer`. Static files never
leave `dist/`. `index.html` gets `<script src="/__bridge/client.js">`, which
defines `window.commandHub` with `remote: true`, so `hasLocalScreen()`
(`src/modules/client.ts`) is false on the phone.

## The bridge

The phone server uses the shared JSON and Origin-checked
`POST /__bridge/invoke` handler. Only methods explicitly listed under `phone`
in `REMOTE_METHODS` can run. A backend's `desktopOnly` declaration still
takes priority. Refusals go in the activity log. The test compares the
classification with the actual module, app and built-in Extensions registries
and requires exactly one decision for every method. An unclassified method
or module is refused at runtime.

### Phone coverage

The phone serves the same renderer. A visible control can still receive a
server refusal. `hasLocalScreen()` hides some PC actions, and the extension
store hides extension app and module contributions on the phone.

| Surface | Available from a paired phone | Requires the PC |
| --- | --- | --- |
| Agents and Flows | Read Chat and catalog data, create or resume chats, manage chat state, edit and run flows, and save ordinary prompt templates | Change allowed folders, system prompts, spending settings, built-in subagents and PR reviewer settings. Run or retry a PR review |
| Data tools | Explore metadata, preview BigQuery tables and dry-run SQL, view jobs, read SQLX files, browse ingestion status and logs. Configured MetricFlow and Malloy queries use their existing settings | Run arbitrary BigQuery SQL or cancel jobs, write SQLX files or change projects, change OpenMetadata descriptions or sync BigQuery metadata, and configure or run ingestion |
| Workspace apps | Manage notes, flashcards and Tracker records, work with connected mail accounts and Tasks, and browse and work with issues in recent or MonoRail-linked GitHub+ repos | Configure accounts or mail write access, link new repositories, initialize repos, manage Jira trigger templates or local project setup, change bookmarks or manage GitHub+ backups |
| PC and settings | View selected status, schedules, storage information and extension inventory | Files, Developer Mode, Remote access, desktop dialogs, system links, installation and update actions, account and access changes, storage scans, and scheduled or backup actions |

Extension backend calls, including the `extensions.call` wrapper, stay on the
PC. The phone bridge does not receive extension push events. The token-protected
local Vite dev bridge retains its existing backend and event access.

The server supplies `ctx.remoteLimits.askOnly` from the current setting. Chat
refuses coordinator and Agent turns in Ask-only mode. Flows checks the saved
graph before it starts any steps, and each turn checks the live setting again in
Chat. The [spending limit](guide/setup/spending-limit.md) applies to both.

### Desktop renderer

Vite emits `desktop.html` with a CSP for Electron's local file renderer. Scripts
and bundled fonts are local, styles can use inline values, and renderer
requests use IPC. The policy allows data and blob images, extension frames
and icons, email's sandboxed HTML with its image opt-in, and Chat's sandboxed
HTTP(S) preview. Vite hot reload uses its development entry. Remote access
loads `index.html` and applies its own HTTP policy.

`renderer-security.cjs` guards window and frame navigation, including
redirects. The main frame stays on its configured app document, including its
hash routes. Extension frames stay on their own origin. External HTTP(S)
pop-ups open in the system browser. Electron webview attachment is disabled.
The `module:invoke` IPC handler accepts calls only from the current main
window's main frame at its app document.

## Funnel and the address

`tailscale serve status` is parsed for a web handler whose `/` proxies to
MonoRail's port (`serve: ok | missing | other`). When any of those hosts has
`AllowFunnel`, the server stops (`blocked: 'public'`) until a later check
finds it private. MonoRail never turns Funnel on and never replaces another
program's serve config (`other`).

## Files

Machine scope ([profiles](profiles.md#two-scopes-profile-and-machine)):
`<data folder>\modules\remote\`, declared in `electron/cache/declared.cjs`.

- `settings.json`: `{ enabled, port, allowedLogins, allowedLoginsInitialized, agentFromPhone }`.
  An existing non-empty list counts as initialized.
- `devices.json`: `[{ id, name, agent, keyHash, pairedAt, lastSeen }]`;
  `agent` is "Chrome on Android", never the raw user agent.
- `audit.jsonl`: device, module, method, outcome, ms, refusal reason. Never
  arguments or results. Reads and polls are logged only when refused or
  failed. Trimmed to the last 1000 lines past 512 KB.

A damaged settings or devices file is never overwritten: Remote access stays
off or no device connects, and the page says which file to delete.

## Tray and single instance

While on, closing the window keeps MonoRail in the tray (Open, Turn off
Remote access and quit, Quit). A second launch then hands over to the
running copy (`requestSingleInstanceLock`, taken only while on). Turning it
off stops the server and revokes every device.

## Tests

`electron/remote/remote.test.cjs`: pairing over real HTTP, every refusal
(host, login, cookie, origin, revoked), desktop-only and denied methods,
the Ask-only limit, path traversal, code expiry, damaged files, Tailscale
parsing and Funnel detection.
