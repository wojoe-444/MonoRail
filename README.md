# MonoRail

MonoRail is a Windows desktop workspace for running agents, browsing repositories
and working with local tools and data catalogs. The app ships as an Electron
installer.

| Path | What it contains |
| --- | --- |
| [`apps/command-hub/`](apps/command-hub) | The MonoRail renderer and Electron backends |
| [`agents/`](agents/README.md) | A placeholder for public agent definitions. MonoRail discovers agents on the user's machine. |
| [`packages/extension-sdk/`](packages/extension-sdk/README.md) | Source for the SDK files shipped with extensions |
| [`extensions/`](extensions/README.md) | The Hello MonoRail starter and working extension sample |
| [`docs/`](docs) | The in-app Wiki, including the [user guide](docs/guide/README.md), [developer reference](docs/contributing/README.md), [extension author docs](docs/extensions/README.md) and [entity standard](docs/standard/README.md) |

## Run from source

Use Node.js 22 to match CI.

```bash
cd apps/command-hub
npm ci
npm run desktop    # Electron with hot reload
npm run dev        # Vite browser preview with fictional data
npm run dist:win   # builds release/MonoRail-Setup-<version>.exe
```

To use MonoRail without installing it (for example as a test user), run
`npm start` instead, or double-click `Start MonoRail.cmd` in this folder. It
builds the app if needed and opens it in your browser at
http://127.0.0.1:5180 with your real data. Keep its window open; close it to
stop MonoRail. Update with `git pull` and start again. See
[Run MonoRail without installing it](docs/guide/setup/run-from-source.md).

Run `npm run lint`, `npm test` and `npm run build` from the same folder.
See the [repository guide](CLAUDE.md) for commands, contribution rules and
backend architecture.

## Install and update on Windows

Download `MonoRail-Setup-<version>.exe` from the
[latest GitHub release](https://github.com/wojoe-444/MonoRail/releases/latest).
The installer is per-user and installs to
`%LOCALAPPDATA%\Programs\command-hub`. That folder name lets older installs
upgrade in place. The installer is unsigned, so SmartScreen may prompt for
confirmation.

After the initial install, open **Settings > Check for updates**, then choose
**Download and restart**. See [Backups and updates](docs/guide/setup/backups-and-updates.md#updates).

## Private data

This repository is public. Credentials, settings and run history live on your
machine in `%APPDATA%\MonoRail`. Older installs continue to use their existing
data folder, shown in Settings. See [Private data stays local](docs/guide/private-data.md).
