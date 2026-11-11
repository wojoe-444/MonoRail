---
audience: human, ai
---

# Tutorial: your first extension

This walks from the starter to a released extension. You need Node 22+, Git,
and MonoRail installed on Windows.

## 1. Copy the starter

```bash
npx degit wojoe-444/MonoRail/extensions/hello-monorail my-extension
cd my-extension
npm install
```

You get:

| Path | What it is |
| --- | --- |
| `monorail.json` | The [manifest](manifest.md) |
| `src/` | The UI (Vite + React + Tailwind). `npm run build` writes it to `ui/` |
| `backend/index.cjs` | The backend: notes in the data folder, events, a setting, a migrate hook |
| `test/backend.test.mjs` | Backend tests (`npm test`) |
| `monorail-sdk/` | The SDK: page client, types, test helper, theme, packer |
| `.github/workflows/release.yml` | Publishes a release when you push a `v*` tag |

## 2. Make it yours

In `monorail.json`, change `id` (permanent: pick it carefully), `name`,
`publisher`, `repository` (your GitHub `owner/name`) and `description`. In
`package.json`, change `name`. Leave `engines.monorail` at `^` plus the SDK's
version (see [Concepts: version numbers](concepts.md#version-numbers)).

## 3. Add a method and call it

In `backend/index.cjs`:

```js
methods: {
  async greet(ctx, { name }) {
    if (!name) ctx.fail('NO_NAME', 'Tell me your name')
    const { greeting } = await ctx.settings.get()
    return `${greeting}, ${name}!`
  },
}
```

In a page:

```ts
import { monorail } from '../monorail-sdk/client.js'

try {
  setText(await monorail.invoke<string>('greet', { name: 'Ada' }))
} catch (err) {
  setText(err.code === 'NO_NAME' ? 'Type a name first' : err.message)
}
```

## 4. Test the backend

```js
// test/greet.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadBackend } from '../monorail-sdk/testing.mjs'

test('greets', async (t) => {
  const b = await loadBackend({ settings: { greeting: 'Hi' } })
  t.after(() => b.close())
  assert.equal(await b.invoke('greet', { name: 'Ada' }), 'Hi, Ada!')
  await assert.rejects(b.invoke('greet', {}), { code: 'NO_NAME' })
})
```

Run `npm test`. See [Testing](testing.md) for what this does and doesn't cover.

## 5. Preview the UI in a browser

`npm run dev` opens the pages with sample data. There's no backend there
(`monorail.inMonoRail` is `false`), so the starter shows fictional data. Use
this for layout work.

## 6. Run it in MonoRail

1. `npm run build`.
2. In MonoRail: **Settings > Extensions > Install extension > Load a folder
   for development**, and pick your extension folder.
3. Review the consent dialog and install. Your module appears in the menu
   (under `nav.section`) and your app on the Apps page.
4. After each change: `npm run build`, then **Reload** on the extension's row.
5. Backend output: the row's **…** menu > **Backend logs**.

## 7. Ask for access

The backend can only use its own folders. To call an API, declare the host:

```json
"permissions": { "network": ["api.example.com"] }
```

Reload. Because the extension now asks for more, it turns off until you
approve on the Extensions page. That's the same flow your users see on an
update. See [Permissions](permissions.md) for exact matching rules.

If the API needs a key, let the user enter it as a setting:

```json
"settings": [{ "key": "apiKey", "type": "secret", "title": "API key", "required": true }]
```

Read it with `(await ctx.settings.get()).apiKey`. MonoRail shows the form,
encrypts the value and never sends it to pages.

## 8. Release

```bash
npm version patch        # bumps package.json and monorail.json, commits, tags v<version>
git push --follow-tags   # the workflow builds, packs and publishes the release
```

Users install it with **Install extension > From a GitHub release** and your
`owner/name`, and get updates with **Check for updates**. `npm run pack`
writes the same `release/<id>-<version>.monorail.zip` locally, which can be
installed with **From a .zip**.

## Next

- [Backend API](backend-api.md): every `ctx` member, hooks and error codes.
- [Lifecycle](lifecycle.md): when your backend starts and stops, and how data
  survives updates (`migrate`).
- [Troubleshooting](troubleshooting.md) when something doesn't work.
