# Testing

## Backend tests without MonoRail

`monorail-sdk/testing.mjs` runs your backend in plain Node, under
`node --test` or any test runner:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadBackend } from '../monorail-sdk/testing.mjs'

test('adds a note', async (t) => {
  const b = await loadBackend()          // reads ./monorail.json, imports backend.main
  t.after(() => b.close())               // stop(), then deletes the temporary data folder

  await b.invoke('addNote', { text: 'hi' })
  assert.equal(b.events.at(-1).channel, 'notes')
  await assert.rejects(b.invoke('addNote', { text: '' }), { code: 'EMPTY_NOTE' })
})
```

### `loadBackend(options)`

Imports the backend like MonoRail does, runs `migrate(ctx, previousVersion)`
if the version differs, then `start(ctx)`. Options (all optional):

| Option | Default | What it does |
| --- | --- | --- |
| `root` | current folder | The extension folder with `monorail.json`. |
| `main` | `backend.main` | The backend file. |
| `manifest` | read from `root` | Use this manifest object instead. |
| `previousVersion` | `null` | The version that "last used" the data folder, passed to `migrate`. |
| `dataDir` | a new temporary folder | Use your own folder (kept by `close()`), e.g. with fixture data. |
| `folders` | `[]` | Folders "the user picked": `[{ path, write }]`. |
| `settings` | `{}` | Values "the user entered". Missing fields get the manifest's defaults. |
| `secrets` | `{}` | Secrets stored beforehand. |
| `secretsAvailable` | `true` | `false` simulates a computer without encryption (`EXT_SECRETS_UNAVAILABLE`). |

It returns:

| Member | What it is |
| --- | --- |
| `invoke(method, args)` | Calls a method as a page would. Arguments and results go through JSON, and errors come back as `{ code, message, details }` under the same rules as in MonoRail. |
| `events` | Everything emitted: `{ channel, payload }[]`. |
| `logs` | Everything logged: `{ level, line }[]`. |
| `secrets` | The in-memory secrets (`Map`). |
| `dataDir` | The data folder. |
| `ctx` | The `ctx` your backend received. |
| `changeSettings(values)` | Simulates a save: calls `settingsChanged`, or `stop()` + `start()` like MonoRail's restart. |
| `close({ keepData })` | Calls `stop()` and deletes the temporary data folder. |

### `createTestContext(options)`

A `ctx` on its own, to unit-test a single function:
`const { ctx, record } = createTestContext({ manifest, settings })`.
`record.events`, `record.logs` and `record.secrets` hold what it did.

## What still needs MonoRail

The test helper is **not a sandbox**. Your backend runs with your own
access, so these only show up in MonoRail:

- File access outside the data folder (`EXT_FS_DENIED`).
- Network hosts missing from `permissions.network` (`EXT_NETWORK_DENIED`).
- Programs missing from `permissions.process` (`EXT_PROCESS_DENIED`).
- The 20-second start limit and the 2-minute call limit.
- Your pages talking to the real backend.

Check those by loading the folder with **Load a folder for development**
(see [Tutorial](tutorial.md)), and watch **Backend logs**: every failed call
is logged with its code.

## Pages

Pages are ordinary web pages. Test them with your usual tools (Vitest,
Playwright) against `npm run dev`, where `monorail.inMonoRail` is `false` and
the starter shows sample data. Keep backend calls behind a small module you
can replace in tests.

## In CI

The starter's release workflow runs `npm test` before packing. MonoRail's
own CI runs the starter's tests on every pull request.
