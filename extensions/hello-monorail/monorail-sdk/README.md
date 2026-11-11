# MonoRail extension SDK (API 1.0)

The files a MonoRail extension carries in its `monorail-sdk/` folder. No
dependencies and nothing to install: copy the folder, or start from the
[starter extension](../../extensions/hello-monorail).

| File | What it is |
| --- | --- |
| `client.js` / `client.d.ts` | The page side: `monorail.ready()`, `invoke()`, `on()`, `pickFolder()`, `openExternal()`, theme sync |
| `backend.d.ts` | Types for the backend module and its `ctx` |
| `theme.css` | MonoRail's design tokens for Tailwind CSS v4 (colors, radius, elevation, dark mode) |
| `pack.mjs` | Packs the extension into `<id>-<version>.monorail.zip` |

The source of truth is `packages/extension-sdk` in
[wojoe-444/MonoRail](https://github.com/wojoe-444/MonoRail). To update an
extension's copy:

```bash
npx degit wojoe-444/MonoRail/packages/extension-sdk monorail-sdk --force
```

The SDK's version matches the extension API version. MonoRail loads
extensions whose `engines.monorail` range includes its API version, so an
extension built against SDK 1.x keeps working on every MonoRail with API 1.x.
