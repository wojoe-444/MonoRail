# Hello MonoRail

The starter extension for [MonoRail](https://github.com/wojoe-444/MonoRail):
one page in the hub's menu, one full-screen app, and a small backend that keeps
notes in the extension's private data folder, pushes live events, and lists a
folder the user picks.

Copy it to start your own extension:

```bash
npx degit wojoe-444/MonoRail/extensions/hello-monorail my-extension
cd my-extension
npm install
```

Then change `id`, `name`, `publisher` and `repository` in `monorail.json`.

## Layout

| Path | What it is |
| --- | --- |
| `monorail.json` | The manifest: what the extension adds and what it may access |
| `src/` | The UI (Vite + React + Tailwind). Builds to `ui/`, which MonoRail serves |
| `backend/index.cjs` | The backend, run by MonoRail in its own sandboxed process |
| `test/` | Backend tests (`npm test`) |
| `monorail-sdk/` | Page client, backend types, MonoRail's design tokens, the packager |
| `.github/workflows/release.yml` | Publishes a release when you push a `v*` tag |

## Develop

- `npm run dev` previews the UI in a browser with sample data (no backend).
- In MonoRail: **Settings > Extensions > Install extension > Load a folder for
  development**, pick this folder, then `npm run build` and press **Reload**
  after each change. Backend logs are under the extension's **…** menu.

Pages can't use the network or inline scripts (MonoRail's CSP); do network
work in the backend and declare the hosts in `permissions.network`.

## Release

```bash
npm version patch          # bumps package.json and monorail.json, commits and tags
git push --follow-tags     # the workflow builds, packs and publishes the release
```

`npm run pack` writes `release/<id>-<version>.monorail.zip` locally, which can
also be installed with **From a .zip**.

## Test

`npm test` runs `test/*.test.mjs` with `node --test`. `monorail-sdk/testing.mjs`
loads the backend without MonoRail (temporary data folder, in-memory secrets
and settings). Permissions are not enforced there, so check them in MonoRail.

See the [extension docs](https://github.com/wojoe-444/MonoRail/blob/main/docs/extensions/README.md):
tutorial, manifest reference, page and backend API, permissions, lifecycle and
troubleshooting.
