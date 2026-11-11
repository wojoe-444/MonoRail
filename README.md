# MonoRail

Home of **Command Hub**, a desktop app for managing agents, and the agent
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
npm run dist:win   # builds release/CommandHub-<version>-portable.exe
```

The `.exe` is a portable build: double-click to run, no installer. It is not
code-signed yet, so Windows SmartScreen may ask you to confirm the first time.

## Private data

This repo is public. Anything personal (API keys, tokens, settings, run
history) is stored in `%APPDATA%\Command Hub` on your machine and is never
committed. See [CLAUDE.md](CLAUDE.md).
