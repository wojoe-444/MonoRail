---
audience: ai
summary: Local files, Notes, Flashcards, Storage, mail accounts, BigQuery and SQLX editing.
---

# Workspace and data tool backends

See the [Workspace guide](../guide/workspace/README.md), the
[Data guide](../guide/data/README.md) and the [developer reference](README.md).

## Files

[Files](../guide/workspace/files.md) uses `monorail.files.*` preferences for
tabs, pane state, pins, tags and recent locations. Grid thumbnails come
from Windows `nativeImage.createThumbnailFromPath` and stay in memory.
Preview can read the Git branch from `.git/HEAD` and open the folder in
[GitHub+](git-workspace.md). `electron/modules/files.cjs` checks paths with
`absPath`, filenames with `checkName` and never follows links during walks.
Mutations require user actions. New files and folders avoid overwrites,
copy/move uses `uniqueTarget` and deletion goes through `shell.trashItem`.
`open`, `reveal` and `trash` are desktop-only. [Remote access](../remote-access.md)
refuses the whole backend. The module declares `NOT_CACHED`.

## Notes and Flashcards

[Notes](../guide/workspace/notes.md) writes Markdown on input via
`notes-store.cjs`, in an isomorphic-git repo called `repo/` in its data
folder. Take a lock in `.git`. Batch commits after a minute of quiet, on
leaving or on the next start. Exclude blank new notes. The filename follows
the title only until its first commit. Keep the repo local. GitHub+ lists
it via `linked.cjs` and [backup](../backups.md) uses a bundle with id `notes`.

[Flashcards](../guide/workspace/flashcards.md) stores decks, cards and 90 days
of study counts in `decks.json`. Its Electron-free `flashcards-store.cjs`
also serves [Agent access](../mcp.md). Every edit takes `decks.json.lock`,
reads fresh and writes atomically. Refuse a damaged file. `flashcards-fsrs.cjs`
implements FSRS-5 with default weights, learning steps of one and ten
minutes and relearning of ten minutes. Default target recall is 0.9 and
the default new-card limit is 20 per day. `study` returns the next intervals
and Undo retains only the last answer per deck in memory. Render Markdown
with `ChatMarkdown`.

## Storage

[Storage](../guide/workspace/storage.md) reads drive space via `fs.statfs`.
Build known folder locations from environment folders and scan only when
requested, up to 45 seconds per folder, without following links or
junctions. `storage.history` retains up to 500 scans and drive-only
samples (every six hours while the app runs). The cached last scan
survives restart. Machine-scope drive goals live in `goals.json` through
`storage-goals.cjs`. Refuse to overwrite it when damaged.

The backend does no file mutations on measured locations. Actions open a
listed folder by id or the system Storage settings. A future cleanup
feature requires an explicit confirmation per item and must be limited
to caches marked safe.

## Email

[Email](../guide/workspace/email.md) isolates inbox providers behind the
connector contract in `electron/apps/email/connectors/index.cjs`: config
fields, sign-in and session operations for folders, threads, modify and
send. Keep provider details under `src/apps/email` and
`electron/apps/email` so the app can move to an extension. Gmail uses OAuth
2.0 with PKCE and a loopback redirect via `oauth.cjs`, plus plain fetch
with the `gmail.modify` scope. The user supplies their own Desktop OAuth
client. `store.cjs` encrypts secrets and refresh tokens with safeStorage,
and refuses to save if encryption is unavailable. Mail is fetched on
demand. HTML is shown in a sandboxed iframe with scripts disabled and
remote images requiring a user action.

Classic Outlook uses COM via `connectors/outlook.ps1`. The hidden Windows
PowerShell 5.1 helper receives the script on stdin and arguments as
base64 JSON in `MONORAIL_ARGS`. Limit to three calls with a timeout,
minimal environment and one JSON result. Check that Outlook is already
running and attach with `GetActiveObject`. Avoid `Namespace.CurrentUser`,
which triggers an address-access prompt. Windows CI runs the script and
expects `not-running` on a clean runner. New Outlook lacks COM.

Accounts map to StoreID (Gmail uses address). Shared stores start read-only.
`assertWritable` enforces that in the backend. Folder IDs are paths, standard
folder names are normalized, and skip lists exclude subtrees. Message IDs
include EntryID and internet message ID. When a move invalidates EntryID,
resolve by internet message ID and return the new ID. Deduplicate by
internet message ID. All folders search is opt-in and returns partial
results on its 60-second timeout. `searchAccounts` merges results newest
first, deduplicates across accounts and preserves per-account errors.

## BigQuery

Every [BigQuery console](../guide/data/bigquery.md) operation requires the
[Google Cloud connection](connections.md#accounts-and-local-tooling). Its
`gcloud auth print-access-token` token is cached in memory for 30 minutes
and refreshed on a 401. `bigquery-api.cjs` constructs fixed URLs at
`bigquery.googleapis.com` from validated IDs. Keep INT64 and NUMERIC
values as strings. Estimate bytes with a debounced dry run, preview rows
with `tabledata.list`, and get personal/project history from `jobs.list`.
Persist tabs and starred projects as `monorail.bigquery.*` preferences.
[BigQuery metadata](../bigquery-metadata.md) is a separate catalog source.

## SQLX

[SQLX](../guide/data/sqlx.md) keeps the Dataform config block in a
structured editor (target, settings, columns and assertions). Version 3
puts BigQuery options at the top and version 2 under `bigquery`.
`parse.ts` keeps raw block and text slices that join byte for byte,
including line endings. Preserve unknown expressions as source and
rewrite only edited blocks. `ConfigTabs.tsx` maps Not null to
`assertions.nonNull`. The Raw file tab is the full text.

`electron/modules/sqlx.cjs` stores user-picked projects by id, name and path
in `projects.json` and keeps root paths out of the renderer. Re-resolve
each relative `.sqlx` path inside the selected root. Skip links, dot
folders and `node_modules`. `saveFile` checks the opened mtime and writes
through a temporary file. Drops and pastes are scratch copies without
a save destination. The backend keeps no cache.
