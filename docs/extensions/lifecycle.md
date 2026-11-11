# Lifecycle

## Install

From **Settings > Extensions > Install extension**:

| Source | What happens |
| --- | --- |
| From a GitHub release | MonoRail downloads the asset ending in `.monorail.zip` from the latest release of `owner/name`. The manifest's `repository` must match that repository. |
| From a .zip | Unpacked and copied in. |
| From a folder | Copied in. |
| Load a folder for development | **Not copied**: MonoRail reads the folder in place. Rebuild, then press **Reload**. |

Every install is staged first (in `extensions/.staging`) and checked: a valid
manifest, no unsafe paths in the zip ("zip slip"), at most 200 MB zipped,
600 MB unpacked and 30,000 files. Nothing runs until the user accepts the
consent dialog. A staged install expires if the user doesn't confirm it within 30
minutes.

An extension whose `engines.monorail` doesn't include MonoRail's API version
can't be installed. If it was installed before (and MonoRail changed), it
stays installed as "Incompatible" and isn't loaded.

## States

| State | Meaning | Pages and apps | Backend |
| --- | --- | --- | --- |
| On | Active | shown | runs when needed |
| Off | Turned off by the user | hidden | stopped |
| Needs approval | The installed version asks for permissions the user hasn't approved | hidden | stopped |
| Incompatible | `engines.monorail` doesn't include MonoRail's API version | hidden | stopped |
| Could not load | The manifest is missing or invalid, or its id changed | hidden | stopped |

## When the backend runs

- `"activation": "onDemand"` (default): started by the first `invoke` from a
  page. It keeps running until something stops it. Closing the page doesn't.
- `"activation": "startup"`: started when MonoRail starts, and after
  install, update, turning on, reload, approval, a granted or revoked folder,
  and a settings save that restarts it. Use it for bots, schedulers and anything that must run without
  a page open.

MonoRail stops the backend (calling `stop(ctx)`, then ending the process
after 3 seconds) when the user turns the extension off, removes, reloads or
updates it, approves new permissions, grants or revokes a folder, saves
settings without a `settingsChanged` hook, and when MonoRail quits. After a
stop, an `onDemand` backend starts again on the next call.

If the process exits on its own (an uncaught crash, `process.exit`),
pending calls fail with `EXT_CRASHED` and the next call starts it again.
After **3 crashes within a minute** it stays stopped ("Backend crashed")
until the user reloads it. The reason is in Backend logs.

## Update

- **From GitHub**: **Check for updates** compares the latest release with the
  installed version. **Update to x.y.z** shows the consent dialog again, with
  new permissions marked "New".
- **From a .zip or a folder**: install the new version the same way. MonoRail
  sees it is the same id and treats it as an update, and warns about a downgrade.
- **Development folder**: press **Reload**. It restarts the backend and
  reloads open pages. If the manifest now asks for more permissions, the
  extension waits for approval.

On update, MonoRail replaces the extension's files and restarts the backend.
`migrate` then runs if the version changed (see
[Backend API: data across versions](backend-api.md#data-across-versions)).
The data folder, secrets, settings and granted folders (while
`pickFolders` is still declared) stay. An update turns the extension on.

## Remove

**Remove** stops the backend, deletes the installed files (a development
folder is left untouched) and removes the extension's pages and apps.

| | Kept | Deleted |
| --- | --- | --- |
| Remove | data folder, secrets, settings, the data version | installed files, granted folders, approval |
| Remove + "Also delete its data" | | all of it |

Reinstalling after a plain Remove picks up the kept data, and `migrate` gets
the old version.

## Releasing

1. Bump the version: `npm version patch` in the starter updates
   `package.json` and `monorail.json`, commits and tags `v<version>`.
2. `git push --follow-tags`. The starter's release workflow builds, runs
   `monorail-sdk/pack.mjs` and attaches `<id>-<version>.monorail.zip` to a
   GitHub release.
3. Users install or update from `owner/name`.

Never change `id` between releases: a new id is a different extension, with
empty data.
