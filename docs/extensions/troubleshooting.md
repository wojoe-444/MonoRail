# Troubleshooting

Start with **Backend logs** (the extension's **…** menu on Settings >
Extensions). Every failed call is logged there with its code, e.g.
`getStatus failed: [EXT_NETWORK_DENIED] ...`.

## Installing

| Symptom | Cause | Fix |
| --- | --- | --- |
| `manifestVersion must be 1` | Missing or wrong `manifestVersion`. | Add `"manifestVersion": 1`. |
| `id must be kebab-case` | Uppercase, underscores, dots, or a leading digit. | `my-extension`, `bot2`. |
| `engines.monorail is required` | No API range. | `"engines": { "monorail": "^1.1.0" }`. |
| `Unknown permission "..."` | A typo, or a permission that doesn't exist. | Only `network`, `process` and `filesystem` exist. See [Manifest](manifest.md#permissions). |
| `... paths must start with ~/` | An absolute path in `filesystem.read` or `filesystem.write`. | Use `~/...`, or `pickFolders` for folders outside home. |
| `The extension contributes nothing` | No modules, apps or backend. | Add at least one. |
| `The .zip is larger than 200 MB` | The package is over the limit (also 600 MB unpacked, 30,000 files). | Leave out what you can (tests, docs, unused wheels). |
| Install button disabled, "Built for extension API ..." | `engines.monorail` excludes this MonoRail's API version. | Lower the range if you don't use newer features, or update MonoRail. |
| GitHub install: no `.monorail.zip` asset | The release has no packed zip attached. | Run the release workflow, or attach `release/<id>-<version>.monorail.zip`. |
| GitHub install: repository mismatch | The manifest's `repository` differs from the repo you installed from. | Make them the same `owner/name`. |
| `pack: ... entry ... does not exist. Did you build the UI?` | `ui/` is missing or stale. | `npm run build` first (`npm run pack` does both). |

## The page

| Symptom | Cause | Fix |
| --- | --- | --- |
| Blank page | A script failed, or the `entry` path is wrong. | Check the entry against the files in `ui/`. Vite needs `base: './'` so asset paths are relative (the starter sets it). |
| Inline `<script>` doesn't run | The CSP forbids inline scripts. | Move the code into a `.js` file. |
| `... violates the following Content Security Policy directive because 'unsafe-eval' ...` | A library compiles strings (`new Function`, `eval`), e.g. lodash's `_.template`. | Use a build of the library or a feature that doesn't need `eval`. |
| `fetch('http://localhost:...')` fails with `Failed to fetch` | Pages can't reach a local server either. | Forward the call through a backend method. See [a fetch shim](page-api.md#a-fetch-shim). |
| `fetch('https://...')` fails | Pages have no network. | Call a backend method, and declare the host in `permissions.network`. |
| Remote images, fonts or styles don't load | Only the extension's own files are allowed. | Bundle them into `ui/`. |
| Module page is cut off or very tall | A `100vh` or `h-screen` layout in a module. The frame grows with your content. | Let module pages size to their content. Only apps fill the window. |
| `EXT_NOT_IN_MONORAIL` | The page is open in a normal browser. | Expected with `npm run dev`. Show sample data when `monorail.inMonoRail` is false. |
| Events never arrive | No page was open when they were sent, or the channel names differ. | Events aren't queued. Load state with `invoke` when the page opens, then follow with `on`. |
| Dark mode doesn't apply | `theme.css` isn't imported, or colors are hard-coded. | Import `monorail-sdk/theme.css` and use the tokens (`bg-card`, `text-foreground`). |
| Links do nothing | Navigation away from the frame is blocked. | `monorail.openExternal('https://...')`. |

## The backend

| Symptom | Cause | Fix |
| --- | --- | --- |
| `EXT_START_FAILED: failed to start: ...` | Loading the file, `migrate` or `start` threw. The log has the stack. | Fix the error. A missing module usually means a dependency wasn't bundled next to `backend.main`. |
| `EXT_START_FAILED: did not start within 20s` | `start` awaits something slow. | Start slow work in the background, without awaiting it in `start`. |
| `EXT_UNKNOWN_METHOD` | The method isn't a function in `methods`, or the name differs. | Check the spelling. Reload after renaming. |
| `EXT_FS_DENIED` | A file outside your folders. Relative paths resolve against `ctx.dataDir`. | Use `ctx.dataDir`, declare `filesystem` paths, or ask with `pickFolder`. |
| `EXT_NETWORK_DENIED` for a host you listed | Different name or port: `localhost` vs `127.0.0.1`, `example.com` vs `www.example.com`, or a port in the rule. | List the exact host your code connects to, including redirects' hosts. See [network matching](permissions.md#network-matching). |
| `EXT_PROCESS_DENIED` | The program isn't listed, or you used `exec` or `shell: true` (that starts `cmd` or `sh`). | List the program's file name. Use `execFile` or `spawn` with arguments. |
| `spawn python ENOENT` | The program isn't on the backend's `PATH`. The backend can't search the disk for it. | Bundle the runtime, or ask for its path in a setting. See [finding a runtime](non-node-runtimes.md#finding-a-runtime). |
| Starting `python` installs a new Python into the data folder | The Python install manager alias in `WindowsApps` ran without `LOCALAPPDATA`. | Pass `APPDATA` and `LOCALAPPDATA` in `env`, or don't use the alias. See [the program's environment](non-node-runtimes.md#the-programs-environment). |
| `DefaultCredentialsError` from Google auth in a program | `APPDATA` isn't set, so the login under `%APPDATA%\gcloud` isn't found. | Rebuild `APPDATA` in the program's `env`. See [Google application default credentials](non-node-runtimes.md#google-application-default-credentials). |
| `EXT_NETWORK_DENIED ... DNS lookups of 127.0.0.1` when listening | `server.listen(port, '127.0.0.1')` needs `127.0.0.1` in `permissions.network`. | Let the started program pick the port, or list `127.0.0.1`. |
| A program keeps running after MonoRail quits | It was started with `detached: true`. | Don't detach. On Windows a normal child ends with the backend. |
| A program starts on Mac/Linux but not Windows | `.cmd` launchers (e.g. `npm`, `npx`) need a shell on Windows. | Run the real executable (`node path/to/cli.js`), and list `node`. |
| `EXT_SECRETS_UNAVAILABLE` | The system offers no encryption (rare on Windows). | Tell the user. Never fall back to writing the secret to a file. |
| `EXT_BAD_PAYLOAD` | A result, argument or event isn't plain JSON (`BigInt`, a cycle, a class instance) or is too large. | Return plain objects. Convert dates to strings. Page large results. |
| `EXT_TIMEOUT` | A call ran longer than 2 minutes. | Return right away and report progress with events. |
| "Backend crashed", stays stopped | 3 crashes within a minute. | Read the log, fix it, then **Reload** (or **Restart**). |
| Settings changes are ignored | No `settingsChanged` hook, and the code only read settings once at load time (outside `start`). | Read settings in `start`, in methods, or in `settingsChanged`. |
| `migrate` runs on every start | It throws, so the new version is never recorded. | Check the log. Make it succeed or throw a clear error. |
| Environment variable missing | The backend gets a minimal environment on purpose. | Ask for the value as a setting or keep it in `ctx.secrets`. |

## Updates and data

| Symptom | Cause | Fix |
| --- | --- | --- |
| After a reload: "Needs approval" | The manifest now asks for more permissions. | Approve on the Extensions page. Users see the same on update. |
| Data gone after reinstall | It was removed with "Also delete its data", or the `id` changed. | Keep `id` stable. A plain Remove keeps the data. |
| Old data format after an update | No `migrate`, or it didn't handle the old version. | Add `migrate(ctx, fromVersion)`. See [data across versions](backend-api.md#data-across-versions). |
| Styles look outdated next to MonoRail | Your `monorail-sdk/theme.css` is an older snapshot. | Refresh the SDK folder (see [Concepts](concepts.md#the-sdk-folder)). |
