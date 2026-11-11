# Running Python and other runtimes

A backend is always a Node module, but it may start other programs with the
`process` permission: a Python package, a Java server, a CLI. This page is
what that looks like on Windows today, measured on a real MonoRail build
(extension API 1.2). Python is the running example; the rules are the same
for any runtime.

The short version:

1. Bundle the runtime inside the extension (Python's "embeddable" zip plus
   your wheels), or let the user point at one in a setting. Don't rely on
   whatever `python` is on `PATH`.
2. Start it with `spawn` or `execFile` and an argument list, never a shell.
3. Pass the program its own `env`, rebuilding `APPDATA` and `LOCALAPPDATA`
   if it needs them (Google auth, pip, the Python install manager do).
4. Let the program pick its own port and print it, and list `"localhost"` in
   `permissions.network` to talk to it.
5. On Windows a started program ends with the backend. Don't use `detached`.

## Permissions

```json
"backend": { "main": "backend/index.cjs" },
"permissions": {
  "process": ["python"],
  "network": ["localhost"]
}
```

`"python"` matches by file name only (see
[program matching](permissions.md#program-matching)), so it allows the
`python.exe` you bundle as well as one on `PATH`. `python3`, `py` and
`pythonw` are different names and need their own entries. `exec` and
`shell: true` start `cmd.exe` and fail with:

```
EXT_PROCESS_DENIED: This extension may not run "C:\Windows\system32\cmd.exe". Add it to "permissions.process" in monorail.json.
```

The started program is **not sandboxed**: it reads and writes anything the
user can, and its network use isn't checked. The consent dialog says so
("Full trust").

## Finding a runtime

The backend can't look for one on disk itself: its file access is limited
to its own folders, so `fs.statSync` on a Python install fails with
`ERR_ACCESS_DENIED`. Starting the program is the only way to find out.

What happened with each kind of install:

| How Python is installed | `spawn('python', ...)` from a backend |
| --- | --- |
| python.org installer, on `PATH` | Works. The backend's `PATH` is the user's, so the first `python` on it runs. |
| Not on `PATH` | Fails with `spawn python ENOENT` (`err.code === 'ENOENT'`). |
| Python install manager (the `python.exe` alias in `%LOCALAPPDATA%\Microsoft\WindowsApps`) | **Don't.** Started with the backend's environment (no `LOCALAPPDATA`), it downloaded and installed a second, newer Python into the backend's working folder (`ctx.dataDir`), registered it for the user, and only then ran the command: 8 seconds, a few hundred MB, and a side effect outside your extension. With `LOCALAPPDATA` and `APPDATA` passed in `env` it ran the user's own default Python in about 2 seconds. |
| Older "Microsoft Store" stub alias (no Python installed) | Not measured. The stub prints a message pointing at the Store and exits with an error instead of running Python. |
| Bundled in the extension | Works: `spawn(path.join(ctx.extensionDir, 'runtime', 'python.exe'), ...)`. |

The alias row is why `PATH` is a poor default: on a machine where the alias
comes before a real install, `python` is that alias.

### Bundling Python

Python's Windows "embeddable package" is a zip of about 11 MB that runs from
any folder. To bundle it with dependencies that have native wheels:

```bash
mkdir runtime && cd runtime
unzip ../python-3.12.10-embed-amd64.zip
python -m pip install --target site-packages --only-binary=:all: \
  --python-version 3.12 --platform win_amd64 --implementation cp \
  sqlglot sqlfluff duckdb z3-solver
printf 'python312.zip\n.\nsite-packages\nimport site\n' > python312._pth
```

Then pack it with the extension: `node monorail-sdk/pack.mjs --include runtime`.
A test package built this way (sqlglot, sqlfluff, duckdb and z3-solver) was
143 MB and 2,400 files on disk and a **58 MB** `.monorail.zip`. It installed
in about 6.5 seconds, and from a backend both `import duckdb, z3` and a
DuckDB query worked.

Things to know:

- **Size limits** (from `electron/extensions/install.cjs`): the zip may be at
  most 200 MB (209,715,200 bytes), 600 MB unpacked and 30,000 files. A 195 MB
  package installed; a 205 MB one failed with `The .zip is larger than 200 MB`.
  The zip and its unpacked files are held in memory while installing: the
  195 MB package took MonoRail's memory up by about 600 MB for a moment.
- **Where it lands**: installed files go to `extensions/<id>/` in MonoRail's
  data folder, which on Windows is under `%APPDATA%` (the roaming profile).
  On machines with roaming profiles that is synced at sign-in, so keep the
  package as small as you can.
- **Per platform**: an embeddable Python and binary wheels are for one OS and
  CPU. MonoRail's packages have no per-platform variants yet.
- **Files the backend can read**: the extension folder is readable by the
  backend and by the program, so a bundled runtime needs no extra permission.

### Letting the user choose

If you don't bundle, offer a setting and check it by running it:

```json
"settings": [
  { "key": "python", "type": "string", "title": "Python", "description": "Full path to python.exe, 3.11 or newer. Leave empty to use the bundled one.", "default": "" }
]
```

```js
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const run = promisify(execFile)

async function pythonVersion(file, env) {
  const { stdout } = await run(file, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { env, windowsHide: true, timeout: 15000 })
  return stdout.trim()
}
```

The setting's program still has to match `permissions.process` by file name.

## The program's environment

A backend gets a minimal environment (see
[Environment](permissions.md#environment)). Whatever you pass as `env` to
`spawn` or `execFile` is used as is; without `env`, the program gets the
backend's environment.

Measured in a Python program started from a backend:

| Variable | Default (backend's environment) | `env: {}` | `env` rebuilt as below |
| --- | --- | --- | --- |
| `APPDATA`, `LOCALAPPDATA` | missing | missing | set |
| `GOOGLE_APPLICATION_CREDENTIALS`, `CLOUDSDK_CONFIG` | missing | missing | missing |
| `USERPROFILE`, `TEMP` | set | set | set |
| `HOME` | set | missing | set |

On Windows, Node always adds a few system variables (`SYSTEMROOT`,
`USERPROFILE`, `TEMP`, `USERNAME` and others) even to an empty `env`. `TEMP`
and `TMP` point into the backend's data folder.

The user's own values of `APPDATA`, `LOCALAPPDATA` and
`GOOGLE_APPLICATION_CREDENTIALS` can't be read by an extension. The usual
locations can be rebuilt from `USERPROFILE`:

```js
const path = require('node:path')

function programEnv(extra = {}) {
  const home = process.env.USERPROFILE ?? process.env.HOME
  return {
    ...process.env,
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    PYTHONUTF8: '1',
    ...extra,
  }
}
```

This is right for a default Windows profile. It is wrong where IT redirects
`AppData` to another drive or a network share; there, ask the user for the
folder in a setting.

### Google application default credentials

Python's `google.auth.default()` looks for the user's login (from
`gcloud auth application-default login`) under `%APPDATA%\gcloud`. Measured
on a machine that has that login:

| Environment | Result |
| --- | --- |
| Backend's default | Looked for `C:\gcloud\application_default_credentials.json` and failed after about 15 seconds with `DefaultCredentialsError: Your default credentials were not found.` |
| `programEnv()` above | Found the login and refreshed a token. |

A service-account key file the user normally names in
`GOOGLE_APPLICATION_CREDENTIALS` isn't visible either. Ask for its path as a
setting and pass it in `env`. The key file stays where it is: your program
reads it, MonoRail never sees it.

## When the program ends

On Windows, Node puts every program a backend starts into a job object that
ends with the backend process. Measured with a Python program started by
`spawn`, checked two seconds after each event:

| What happened | Backend | Program (default) | Program started with `detached: true` |
| --- | --- | --- | --- |
| MonoRail stopped the backend (`stop(ctx)` ran, the program was not killed in it) | gone | **gone** | survives |
| The backend crashed (`process.exit(3)`) | gone | **gone** | survives |
| The backend process was killed outright | gone | **gone** | survives |
| The process hosting the backend (MonoRail) was killed outright | gone | **gone** | survives |

So on Windows:

- Don't pass `detached: true`. A detached program outlives MonoRail and the
  user has no way to stop it.
- Still end the program in `stop(ctx)` so it can shut down cleanly; it is
  killed anyway when the backend exits.
- For other operating systems (where this job object doesn't exist), have the
  program exit when its standard input closes. That happens however the
  backend ends:

```python
import os, sys, threading

def exit_when_parent_goes():
    sys.stdin.buffer.read()   # returns at end of input: the backend is gone
    os._exit(0)

threading.Thread(target=exit_when_parent_goes, daemon=True).start()
```

Start it with `stdio: ['pipe', 'pipe', 'pipe']` and never close its stdin
yourself.

## A helper HTTP server

A program that serves HTTP (a local UI or API) works, with these rules.

**Port.** Let the program bind port `0` and print the port it got; read it
from its first line of output:

```js
const child = spawn(python, ['-m', 'mytool', 'serve', '--port', '0'], { env: programEnv(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
const port = await new Promise((resolve, reject) => {
  let out = ''
  child.stdout.on('data', (d) => {
    out += d
    const m = /PORT (\d+)/.exec(out)
    if (m) resolve(Number(m[1]))
  })
  child.once('exit', (code) => reject(new Error(`exited with ${code}: ${out}`)))
})
```

Picking a port in the backend (`net.createServer().listen(0, '127.0.0.1')`)
is subject to the network guard: it needs `127.0.0.1` in
`permissions.network`, and otherwise fails with
`EXT_NETWORK_DENIED: This extension has no network permission for DNS lookups of 127.0.0.1.`
Letting the program choose avoids that and the race between picking and binding.

**Network rule.** The program itself isn't checked; the backend's
connections to it are.

| `permissions.network` | Backend's `fetch` to the program |
| --- | --- |
| `["localhost"]` | Works on any port, by the name `localhost`. |
| `["localhost:8765"]` | Works only on 8765. A server on a random port fails with `EXT_NETWORK_DENIED: ... for localhost:51330`. |
| none | Fails the same way. |

Use `["localhost"]` with a port picked at run time, rather than a fixed port
that another program may already hold. Connect by the same name you list
(`localhost` and `127.0.0.1` are different rules).

**Reaching it from a page.** Pages have no network (`connect-src 'self'`),
so a page can't call the server directly. The backend can forward requests
for it:

```js
// backend
methods: {
  async api(ctx, { path, method = 'GET', body }) {
    if (typeof path !== 'string' || !path.startsWith('/api/')) ctx.fail('BAD_PATH', 'Only /api/ paths')
    const res = await fetch(`http://localhost:${port}${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
    return { status: res.status, body: await res.text() }
  },
}
```

The backend's `fetch` to a local Python server took 3 to 70 ms (the first
request is the slow one).

## Timing

Measured on a laptop from a running backend:

| Step | Time |
| --- | --- |
| Start Python and run one line | 0.1 to 0.4 s |
| Bundled Python importing sqlglot, sqlfluff, duckdb and z3 | about 3 s the first time, about 1 s after |
| Python install manager alias, with `LOCALAPPDATA` passed | about 2 s |

Calls from a page time out after 2 minutes and the backend must start within
20 seconds ([Limits](backend-api.md#limits)), so start a slow program in the
background from `start(ctx)` or the first call, and don't `await` its warm-up
in `start`.
