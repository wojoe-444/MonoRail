# MonoRail

Home of **MonoHub**, a desktop app for managing agents, and the agent
definitions it manages.

| Path | What it is |
| --- | --- |
| `apps/command-hub/` | React + shadcn/ui app, packaged for Windows with Electron |
| `agents/` | Agent definitions (public, no secrets) |

## Run it

```bash
cd apps/command-hub
npm install
npm run dev        # browser at http://localhost:5173
npm run desktop    # same app in an Electron window, with hot reload
npm run dist:win   # builds release/MonoHub-Setup-<version>.exe
```

## Install and update (Windows)

Every merge to `main` publishes a GitHub release with
`MonoHub-Setup-<version>.exe`. Install it once; after that, open
**Settings > Check for updates** in the app and click **Download and
restart**. The installer is per-user (no admin prompt) and installs to
`%LOCALAPPDATA%\Programs\command-hub` (the folder kept its pre-rename name so
existing installs upgrade in place).

First install from PowerShell:

```powershell
$rel   = Invoke-RestMethod https://api.github.com/repos/wojoe-444/MonoRail/releases/latest
$asset = $rel.assets | Where-Object name -like 'MonoHub-Setup-*.exe' | Select-Object -First 1
$out   = Join-Path $env:TEMP $asset.name
Invoke-WebRequest $asset.browser_download_url -OutFile $out
Unblock-File $out
Start-Process $out -Wait
```

The installer is not code-signed yet, so SmartScreen may still ask you to
confirm (More info > Run anyway).

## Private data

This repo is public. Anything personal (API keys, tokens, settings, run
history) is stored in `%APPDATA%\MonoHub` on your machine and is never
committed. See [CLAUDE.md](CLAUDE.md).
