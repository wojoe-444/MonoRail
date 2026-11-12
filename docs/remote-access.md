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
| `electron/remote/policy.cjs` | `REMOTE_DENY` and `remoteRefusal`, quiet methods for the log. |
| `electron/remote/store.cjs` | `settings.json`, `devices.json`, `audit.jsonl`. |
| `electron/remote/tailscale.cjs` | `tailscale status --json`, `tailscale serve status --json`, and the one write, `tailscale serve --bg http://127.0.0.1:<port>` (the person's "Set it up" button). |
| `electron/modules/remote.cjs` | The `remote` backend for Settings > Remote access (`src/modules/remote`). |

## Request checks, in order

1. **Host** is the tailnet name (`<pc>.<tailnet>.ts.net`, with or without
   `:443`) or loopback with the port, else 421.
2. **Tailscale login**: the `Tailscale-User-Login` header that Tailscale
   serve adds must be in `allowedLogins`, else 403. The first check fills the
   list with the PC's own login when it is empty.
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

The same handler as `npm run dev:browser` (`electron/bridge/server.cjs`,
`createBridgeHandler`): `POST /__bridge/invoke` and server-sent events at
`/__bridge/events`, JSON only, Origin checked. The remote invoke refuses, and
logs:

- every backend's `desktopOnly` methods (needs the PC's screen);
- `REMOTE_DENY`: settings that stay on the PC (connections, spending limit,
  system prompts, agent access, extensions, backups, updates, profiles,
  subagent definitions, Developer Mode, the `remote` backend itself);
- extension backends (`ext:*`), for now.

A test fails when a `REMOTE_DENY` entry names a method that does not exist.

`agent-chat.startTurn` from a phone always gets
`remoteLimits: { askOnly: !agentFromPhone }`, set by the server so the page
can't lift it. `startTurn` then refuses Agent mode and coordinator turns
unless the person turned on Agent mode from the phone. The
[spending limit](guide/setup/spending-limit.md) applies as everywhere.

## Funnel and the address

`tailscale serve status` is parsed for a web handler whose `/` proxies to
MonoRail's port (`serve: ok | missing | other`). When any of those hosts has
`AllowFunnel`, the server stops (`blocked: 'public'`) until a later check
finds it private. MonoRail never turns Funnel on and never replaces another
program's serve config (`other`).

## Files

Machine scope ([profiles](profiles.md#two-scopes-profile-and-machine)):
`<data folder>\modules\remote\`, declared in `electron/cache/declared.cjs`.

- `settings.json`: `{ enabled, port, allowedLogins, agentFromPhone }`.
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
