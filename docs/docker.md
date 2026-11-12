---
audience: ai
summary: Reference for the Docker connector and the Docker page: files, commands it runs, opt-in and privacy rules.
---

# Docker connector and page

People: see the guide, [Docker](guide/setup/docker.md).

## Files

| File | What it does |
| --- | --- |
| `electron/modules/docker-cli.cjs` | The only code that runs `docker` / `lazydocker`. Finds them on PATH by file (`findOnPath`; `docker.exe` only on Windows). On Windows the PATH is re-read from the registry (`freshPath`: `reg.exe query` of the machine and user `Path`, cached 60 s), because a program installed after Explorer started is missing from MonoRail's own PATH; then the usual install folders are checked by file (`knownLocations`: Docker Desktop's `resources\bin`, WinGet Links, scoop shims, Chocolatey, Go), plus Docker Desktop's `InstallLocation` from its uninstall entry (`dockerDesktopDir`, HKLM then HKCU), so an install on another drive is found. When docker is not found, the connector's check lists where it looked (`trace`: whether the registry PATH was read, the recorded install folder, each file checked). **Docker inside WSL**: when no Windows `docker.exe` is found, `findDockerInWsl` asks `%SystemRoot%\System32\wsl.exe -e printenv WSL_DISTRO_NAME` for the default distro (name checked against `^[\w.-]{1,64}$`) and checks `wsl.exe -d <distro> -e docker --version`; `findDockerTarget` returns a path or `{ wsl, distro }`, and `createDocker` then runs `wsl.exe -d <distro> -e docker <fixed args>` (no shell). This can start WSL, so it only happens from the connector's check and the Docker page, both opt-in. lazydocker inside the distro is found and opened with `bash -lc 'lazydocker ...'` (fixed command, login shell so `~/.local/bin` counts). The engine strip and the connector show "in WSL (<distro>)". Programs run with that fresh PATH and docker's own folder first. It runs them with `spawn(..., { shell: false })` and fixed arguments, parses `--format "{{json .}}"` output in memory. |
| `electron/connections/connectors/docker.cjs` | Connector `docker` on [Connections](guide/setup/connections.md). One setting, `lazydocker` (`yes`/`no`). `credentials()` returns `{ lazydocker }`. Actions: `start-desktop` (Windows, only when `Docker Desktop.exe` is in its default folder), `open-lazydocker` (terminal via `openTerminal`). |
| `electron/modules/docker.cjs` | Page backend: `getOverview`, `getStats`, `getLogs`, `getContainer`, `openLazydocker`, `openLazydockerPage`. No `start()`. |
| `src/modules/docker/` | The page (`/docker`, Utilities). `sample.ts` is fictional data for the browser dev server. |
| `electron/modules/docker.test.cjs` | Parsers, opt-in, no write commands, connector states. |

## Rules

- **Opt-in.** Every page method checks `hasConnection('docker')` first (reads
  the saved list only) and returns `block: 'not-set-up'` without looking for
  any program. The connector runs only after the user adds it (enforced
  centrally in `createConnections`). Nothing is ever downloaded or installed.
- **Read-only.** Commands used: `version`, `info`, `ps --all`, `system df`
  (plain and `--verbose`), `network ls`, `stats --no-stream`,
  `logs --tail 500 --timestamps <id>`, `inspect --type container <id>`. A test
  fails if `docker-cli.cjs` mentions a write verb (`run`, `start`, `stop`,
  `rm`, `prune`, `exec`, ...). Container actions belong in lazydocker or
  Docker Desktop.
- **Ids only from the page.** The one argument from the renderer is a
  container id, checked against `CONTAINER_ID` (`^[a-f0-9]{12,64}$`).
- **No files.** Nothing is cached or written (`modules/docker` is in
  `SCOPES` as `machine`, keeps no files). Stats live in the page's memory
  (one `docker stats --no-stream` every 5 s while the page is open, 60
  kept); logs are re-read every 3 s while **Follow** is on.
- **No secrets.** `parseInspect` keeps environment variable names and drops
  values, so they never cross IPC.
- **States.** `not-set-up`, `not-installed` (no `docker` on PATH),
  `not-running` (client answered, `Server` null; `blockDetail` is the CLI's
  first stderr line). The connector maps these to `unavailable` and `error`.

See also [Storage](storage.md) for drive space and the
[nothing runs until you ask](guide/private-data.md#nothing-runs-until-you-ask) rule.
