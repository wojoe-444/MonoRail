# Permissions and security

Extensions can come from anyone, so an extension gets nothing by default.
The user sees everything it asks for before it is installed, and again when
an update asks for more.

## The model in one table

| Access | Page (frame) | Backend (process), by default | Backend, with permission |
| --- | --- | --- | --- |
| Its own files | read (served) | read | |
| Its data folder (`ctx.dataDir`) | no | read and write | |
| Its secrets and settings | settings only (no secret values) | through `ctx.secrets` / `ctx.settings` | |
| Files elsewhere | no | no | `filesystem.read` / `filesystem.write` paths under `~`, or folders the user picks (`filesystem.pickFolders`) |
| Network | no, ever | no | `network`: listed hosts, or `true` for any |
| Run programs | no | no | `process`: listed programs, or `true` (**full trust**) |
| User's environment variables | no | a minimal set, nothing secret | |
| Workers, native addons, WASI | | no | not available yet |
| MonoRail's data, other extensions | no | no | not available |

There is one way to grant each kind of access. A page never gets more: it
asks its backend, and the backend has only what the user approved.

## Pages

Each extension's pages run on their own origin, `monorail-ext://<id>/`, in a
sandboxed iframe (scripts, same-origin storage, forms, modals and downloads
only), under this Content Security Policy:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:;
connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'
```

MonoRail also keeps frames on their own origin (`will-frame-navigate`), so a
page can't navigate itself somewhere else. The bridge forwards only what the
[Page API](page-api.md) lists, and only to the page's own extension.

## Backends

Each backend runs in its own child process, started with MonoRail's own
executable in Node mode and Node's permission model switched on:

- `--allow-fs-read`: MonoRail's runner file, the extension folder, the data
  folder, `filesystem.read` and `filesystem.write` paths, and granted folders.
- `--allow-fs-write`: the data folder, `filesystem.write` paths, and folders
  granted with write access.
- `--allow-child-process` only with the `process` permission.
- No workers, native addons or WASI.

A denied file access throws, and reaches the page as `EXT_FS_DENIED`. Paths
are checked after resolving, so a link inside your data folder that points
elsewhere doesn't help.

### Network matching

Node's permission model doesn't cover the network, so MonoRail installs a
guard in the backend process before your code loads. It checks every
outgoing TCP connection (this covers `net`, `tls`, `http`, `https`, `fetch`
and WebSocket), direct DNS queries and UDP:

| Rule | Allows | Doesn't allow |
| --- | --- | --- |
| `"api.example.com"` | `api.example.com` on any port | `example.com`, `x.api.example.com` |
| `"*.example.com"` | `a.example.com`, `a.b.example.com` | `example.com` itself (list it too) |
| `"localhost:25565"` | `localhost` on port 25565 | `localhost:8080`, `127.0.0.1:25565` |
| `"127.0.0.1"` | that address on any port | `localhost` (a different name) |
| `true` | everything, including UDP | |

- The host is compared as you connect to it, by name or address, without
  resolving. `fetch('http://localhost:3000')` needs `localhost`, and
  `127.0.0.1` needs `127.0.0.1`.
- Local sockets and named pipes are refused unless `network` is `true`.
- UDP is refused unless `network` is `true`.
- A denied connection fails with `EXT_NETWORK_DENIED`, naming the host and port.

### Program matching

With a list in `permissions.process`, only those programs may be started
(through `spawn`, `execFile`, `exec`, their sync forms, and `fork`):

- The **file name** is compared, never the folder. `"git"` allows
  `git`, `/usr/bin/git` and `C:\Program Files\Git\cmd\git.exe`.
- Case doesn't matter, and a trailing `.exe`, `.cmd`, `.bat` or `.com` is
  ignored **on both sides**. `"node"`, `"node.exe"` and `"NODE.EXE"` are the
  same entry and all allow `node.exe`. (Before MonoRail's extension API 1.1,
  an entry written with `.exe` never matched.)
- `execSync` checks the first word of the command line. `exec` and
  `spawn(..., { shell: true })` start a shell, so the shell's name (`cmd` or
  `sh`) is checked, and listing it would allow anything. Use `execFile` or
  `spawn` with an argument array.
- A denied program fails with `EXT_PROCESS_DENIED`.

A started program is **not sandboxed**: it runs with the user's full
access. That's why every `process` line is shown as high risk, labeled "Full
trust", and why you should list exact programs rather than `true`.

### Environment

The backend gets only `PATH`, `PATHEXT`, `HOME`, `USERPROFILE`, `LANG`,
`LC_ALL`, `TZ`, a few Windows system variables, and `TMP`, `TEMP` and
`TMPDIR` pointing into the data folder. Tokens in the user's environment
(`GITHUB_TOKEN`, cloud credentials) are never passed on. Ask for them through
[settings](manifest.md#settings) or `ctx.secrets` instead.

## Consent

When installing, MonoRail shows a dialog with what the extension adds (pages,
apps, a backend) and one line per permission, with a risk level:

| Risk | Lines |
| --- | --- |
| Low | Specific hosts, "Ask you for access to folders you choose", "Keep its own data" |
| Medium | Any host (`network: true`), reading paths under `~` |
| High (full trust) | Running programs, writing paths under `~` |

- An **update** that asks for more shows the dialog again, with new lines
  marked "New".
- A **development reload** or a manually copied update that asks for more
  turns the extension off ("Needs approval") until the user approves on the
  Extensions page.
- Asking for less needs no approval.
- Folders a user picked are kept across updates while the extension still
  asks for `pickFolders`, and each one can be removed on the Extensions page.

## Where MonoRail keeps things

All under MonoRail's data folder (`%APPDATA%\MonoRail` on Windows; older
installs keep their original folder), never in a repository:

| Path | What | Readable by the backend |
| --- | --- | --- |
| `extensions/<id>/` | Installed files | yes (read-only) |
| `extensions/state.json` | Enabled, source, granted permissions and folders, data versions | no |
| `extension-data/<id>/` | `ctx.dataDir` | yes (read and write) |
| `extension-secrets/<id>.json`, `<id>.settings.json` | Secrets and secret settings, encrypted | no |
| `extension-settings/<id>.json` | Other settings values | no |

## What the sandbox doesn't protect against

- A program started with the `process` permission can do anything the user can.
- `network: true` lets a backend send anything it can read to anywhere.
- A backend can use as much CPU and memory as it likes. MonoRail doesn't
  limit resources yet.
- Packages aren't signed yet. Installing from GitHub checks that the
  manifest's `repository` matches the repository the release came from, and
  nothing more.
