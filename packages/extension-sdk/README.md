# MonoRail extension SDK (API 1.2)

The files a MonoRail extension carries in its `monorail-sdk/` folder. No
dependencies and nothing to install: copy the folder, or start from the
[starter extension](../../extensions/hello-monorail).

| File | What it is |
| --- | --- |
| `client.js` / `client.d.ts` | The page side: `monorail.ready()`, `invoke()`, `on()`, `pickFolder()`, `openExternal()`, theme sync |
| `backend.d.ts` | Types for the backend module and its `ctx` |
| `testing.mjs` / `testing.d.ts` | Run your backend in `node --test` without MonoRail: `loadBackend()`, `createTestContext()` |
| `theme.css` | MonoRail's design tokens for Tailwind CSS v4 (colors, radius, elevation, dark mode) |
| `pack.mjs` | Packs the extension into `<id>-<version>.monorail.zip` |

The source of truth is `packages/extension-sdk` in
[wojoe-444/MonoRail](https://github.com/wojoe-444/MonoRail). To update an
extension's copy:

```bash
npx degit wojoe-444/MonoRail/packages/extension-sdk monorail-sdk --force
```

The SDK has no version of its own: it is the extension API version
(`SDK_VERSION` in `client.js`, written by `sync.mjs`). MonoRail loads
extensions whose `engines.monorail` range includes its API version, so an
extension built against SDK 1.x keeps working on every MonoRail with API 1.x.
Set `engines.monorail` to `^` + the SDK version you built with; `pack.mjs`
warns when they disagree. `theme.css` is generated from MonoRail's own design
tokens, so refresh the folder when you want MonoRail's latest colors.

Full documentation: [docs/extensions](../../docs/extensions/README.md).
