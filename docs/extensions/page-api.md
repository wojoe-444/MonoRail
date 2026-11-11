---
audience: ai
---

# Page API (`monorail-sdk/client.js`)

Your pages are static files served from the extension's `ui` folder into a
sandboxed frame. They reach MonoRail only through the SDK client:

```js
import { monorail, MonoRailError } from '../monorail-sdk/client.js'
```

It has no dependencies and works with any framework or none. Types are in
`client.d.ts`.

## At a glance

| Call | Returns | API |
| --- | --- | --- |
| `monorail.inMonoRail` | `boolean`: false when the page is opened on its own (e.g. a Vite dev server) | 1.0 |
| `monorail.ready()` | `Promise<{ extension, contribution, theme, apiVersion }>` | 1.0 |
| `monorail.invoke(method, args?)` | `Promise<result>` of your backend's method | 1.0 |
| `monorail.on(channel, cb)` | unsubscribe function. Events from `ctx.emit(channel, payload)` | 1.0 |
| `monorail.onTheme(cb)` | unsubscribe function. `'light' \| 'dark'` now and on change | 1.0 |
| `monorail.pickFolder({ write? })` | `Promise<{ path, write } \| null>` | 1.0 |
| `monorail.openExternal(url)` | `Promise<void>`. Opens an `https://` link in the browser | 1.0 |
| `monorail.getSettings()` | `Promise<{ values, secrets }>` | 1.1 |
| `monorail.onSettings(cb)` | unsubscribe function. Called with `{ values, secrets }` after a save | 1.1 |
| `monorail.openSettings()` | `Promise<void>`. Shows your settings form in MonoRail | 1.1 |
| `MonoRailError` | the class of every rejection: `code`, `message`, `details` | 1.1 |
| `SDK_VERSION` | the API version this SDK copy was written for | 1.1 |

## `ready()`

MonoRail introduces itself when the page loads:

```js
const { extension, contribution, theme, apiVersion } = await monorail.ready()
// extension:    { id, name, version }
// contribution: { id, kind: 'module' | 'app' }  which contribution this page is showing
// apiVersion:   MonoRail's extension API version, e.g. "1.1.0"
```

You don't have to wait for `ready()` before calling `invoke()`. Requests are
answered once the bridge is up. Outside MonoRail, `ready()` rejects with
`EXT_NOT_IN_MONORAIL`.

## `invoke(method, args)`

Calls `methods[method](ctx, args)` in your backend and resolves to its return
value. If the backend isn't running, MonoRail starts it first (see
[Lifecycle](lifecycle.md)).

- `args` and the result are **plain JSON**: objects, arrays, strings,
  numbers, booleans, null. `undefined` becomes `null`. Dates arrive as
  strings, and `Map`, `Set`, `BigInt` and class instances don't survive.
  Something that can't be sent fails with `EXT_BAD_PAYLOAD`.
- A result may be up to 16 MB. Page large data, or write it to a file in the
  data folder and send a summary.
- A call that takes more than **2 minutes** fails with `EXT_TIMEOUT`. For long
  work, start it, return right away, and report progress with events.

## Errors

Every failed request rejects with a `MonoRailError`:

```js
try {
  await monorail.invoke('connect', { server })
} catch (err) {
  if (err.code === 'NOT_SIGNED_IN') showSignIn()       // your backend's own code (ctx.fail)
  else if (err.code === 'EXT_TIMEOUT') showRetry()      // MonoRail's codes start with EXT_
  else showError(err.message)
  console.log(err.details)                               // JSON your backend attached, if any
}
```

`code` is stable and meant for your code to check. `message` is meant for
people. The full list of `EXT_*` codes and how your backend sets its own is in
[Backend API: errors](backend-api.md#errors). Stack traces stay in the
backend logs and never reach the page.

## Events: `on(channel, cb)`

Your backend pushes events with `ctx.emit(channel, payload)`. Every open page
of the extension (all its modules and apps) gets them.

Events are **not queued**. A page that isn't open, or hasn't loaded yet,
misses them. So the pattern is to subscribe first, then load the current state:

```js
const off = monorail.on('notes', setNotes)        // 1. follow changes
setNotes(await monorail.invoke('listNotes'))      // 2. load what's there now
// later: off()
```

Channel names starting with `monorail.` are reserved for MonoRail.

## Settings

API 1.1. The values of the [settings](manifest.md#settings) your manifest
declares:

```js
const { values, secrets } = await monorail.getSettings()
// values:  { server: 'localhost', port: 25565 }   every non-secret field (defaults filled in)
// secrets: { password: true }                     per secret field: is one saved?
monorail.onSettings(({ values }) => applySettings(values))   // after the user saves
await monorail.openSettings()                                // takes the user to the form
```

Secret values never reach pages. Read them in the backend.

## Folders: `pickFolder({ write })`

Needs `"filesystem": { "pickFolders": true }`. MonoRail shows the system
folder picker with your extension's name. If the user picks a folder, it
resolves to `{ path, write }`, and **your backend restarts** with access to it
(read, or read and write). The backend sees all granted folders in
`ctx.folders`. If the user cancels, it resolves to `null`. Granted folders are
remembered across restarts and updates, and listed on the Extensions page,
where the user can remove access.

## Theme

The client keeps `<html>` in step with MonoRail. It adds the `dark` class and
sets `color-scheme` when MonoRail is dark. With `monorail-sdk/theme.css` and
Tailwind CSS v4, your pages get MonoRail's colors, radius and elevation
tokens (`bg-card`, `text-muted-foreground`, `ring-foreground/10`, ...):

```css
@import "tailwindcss";
@import "../monorail-sdk/theme.css";
```

`onTheme(cb)` tells you the theme if you draw something yourself, such as a
canvas or a chart.

## Modules vs apps

| | Module page | App |
| --- | --- | --- |
| Above your page | MonoRail's page header (title, description) and the hub's top bar | The hub bar with "Back to MonoRail" |
| Size | Full width. **Height follows your content**: the client reports it, so don't use `100vh` | Fills the window under the hub bar |
| Background | Keep it transparent: it sits on MonoRail's page | Yours to paint |

Several contributions can share one HTML file. Read `contribution.id` from
`ready()`, or use the `#hash` of each `entry`.

## What a page can't do

The page runs on its own origin `monorail-ext://<id>/` with a strict Content
Security Policy:

- Only its own files: no remote scripts, styles, fonts or images (`data:` and
  `blob:` images are fine).
- No inline `<script>`. Inline styles are allowed.
- **No network**: `fetch`, XHR and WebSocket only reach your own files. Do
  network work in the backend and declare the hosts.
- No popups, no navigating MonoRail's window, no nested frames. Links to the
  web go through `openExternal`.
- No access to MonoRail's window, storage or other extensions.

`localStorage` and `IndexedDB` work and are kept per extension. For anything
that matters, prefer the backend's data folder: it is visible to the user,
included in "Also delete its data", and survives a profile reset.

## Developing pages outside MonoRail

`npm run dev` in the starter opens your pages in a normal browser.
`monorail.inMonoRail` is `false` there, and every request rejects with
`EXT_NOT_IN_MONORAIL`. Show sample data in that case (the starter does). To
test with the real backend, load the folder in MonoRail (see
[Tutorial](tutorial.md)).
