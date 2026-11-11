---
audience: ai
summary: How profiles scope settings and data (default profile over the existing data folder), and Developer Mode's New User test profile.
---

# Profiles

A **profile** is one person's settings and data inside a copy of MonoRail:
their appearance, connections, backups, Flashcards decks, Jira+ projects and so
on. Profiles have a name and a folder. They have **no password and no
sign-in**, and they are not a security boundary (see [Not a lock](#not-a-lock)).

Today every copy of MonoRail has exactly one profile, the **default profile**.
It uses the data you already have, in the folder where it already is. The
groundwork is laid so that MonoRail can later hold several profiles, for
example two people sharing one computer account, without reshaping every
page again.

## The rule: existing data stays where it is

MonoRail never moves, renames or copies a data folder or a data file on its
own (an earlier version moved a folder on startup and it caused trouble). The
profile layer follows that rule:

- The default profile's folder **is** the data folder MonoRail has always used
  (`%APPDATA%\MonoRail`, or an older `MonoHub` / `command-hub` folder; see
  `electron/userData.cjs`). Every existing file is read in place.
- Every existing preference in the window's local storage keeps its key.
- Reading profiles never writes anything. `profiles.json` is written only when
  you change a profile (today: its name on **Settings > Profile**), and a
  damaged file is never overwritten.
- Copying data into another profile, when that exists, will be something you
  start yourself, item by item, never automatic.

## Two scopes: profile and machine

Every folder MonoRail keeps belongs to one of two scopes.

| Scope | Belongs to | Examples |
| --- | --- | --- |
| **profile** | the person | Appearance and nav layout, Connections and their secrets, Settings > Backups, Flashcards, Notes, Jira+ (projects, repo links, filter), GitHub+ (recents, backup schedules), Email accounts, Chat (allowed folders, flags, prompts, composer choices), Agent access consent and activity |
| **machine** | this copy of MonoRail on this computer | Updates and the app version, installed extensions, the Claude Stats report (built from this computer's agent logs), Storage measurements, Chromium's own files and the encryption key, `profiles.json` |

The machine scope holds what is the same whoever sits at the computer. Claude
Stats is machine-wide because it reads the agent logs of the computer's user
account, which every profile on that account shares; its account-type badge
still comes from the profile's Claude connection.

The table in code is `SCOPES` in `electron/profiles/index.cjs`. A test fails
when a backend or a declared data folder is missing from it, so new data
always has an owner.

## Where the data lives

```
%APPDATA%\MonoRail\              machine folder (and the default profile's folder)
  profiles.json                  the profile list (only after a change)
  modules\claude-stats\          machine
  modules\flashcards\            profile: default
  apps\jira-plus\                profile: default
  extensions\                    machine
  profiles\<id>\                 a later profile's folder
    modules\flashcards\
    apps\jira-plus\
```

`profiles.json`:

```json
{
  "version": 1,
  "activeId": "default",
  "profiles": [{ "id": "default", "name": "Sam Example", "createdAt": "2026-11-11T12:00:00.000Z" }]
}
```

Profile ids are lowercase letters, digits and dashes. The id `default` always
exists, because it owns the data that was there first.

## For backend authors

Backends get the profile through `ctx` (`electron/modules/index.cjs`):

| Field | What it is |
| --- | --- |
| `ctx.dataDir` | the backend's own folder, resolved by its scope (unchanged for the default profile) |
| `ctx.profile` | `{ id, name }` of the active profile |
| `ctx.layout` | resolves any folder by scope: `ctx.layout.folder('modules/flashcards')` |
| `ctx.profileDir` | the active profile's data root |
| `ctx.machineDir` | the machine folder |
| `ctx.rootDir` | same as `profileDir`, kept for older code |

- Read another backend's folder with `ctx.layout.folder('<scope folder>')`,
  never by building a path from `app.getPath('userData')`.
- Main-process singletons use `appLayout()` from `electron/profiles`.
- Cache helpers (`readSummaries`, `auditAll`) and the MCP tools accept a layout
  or a plain folder (`folderOf`).
- A new backend or data folder needs a line in `SCOPES`.
- The MCP server is started with the machine folder (`--data-dir`) and reads
  `profiles.json` itself: its tools and Agent access use the active profile,
  extensions stay machine-wide.

## For page authors

Use `prefs` from `src/lib/prefs.ts` instead of `localStorage` for anything
that belongs to the person. The default profile keeps the keys that have
always been used (`commandHub.palette`, `monorail.email.account`, ...); another
profile gets the same key under `commandHub.profile.<id>.`. Session-only state
(`sessionStorage`, for example the wiki's last page) needs nothing.

## New User: Developer Mode's test profile

[Developer Mode](guide/setup/developer-mode.md) adds one hidden profile, id
`new-user` (`NEW_USER_ID`), for trying MonoRail as a first-time user.

- It is listed only in Developer Mode and is always `hidden` and `blank`,
  whatever `profiles.json` says.
- `switchTo(id)` (profiles backend, then `restart`) writes `activeId` and,
  for New User, `previousId` (the profile to go back to) and
  `pendingReset: "new-user"`. It never writes over a damaged file.
- A switch takes effect at the next start: the store keeps the profile this
  run started with (`running`), so backends never change folders mid-run.
- At start-up, before any backend opens a file, `resetBlankProfile()`
  (called from `main.cjs`) deletes `<data folder>\profiles\new-user` and only
  that folder, when New User is active and marked; then clears the mark. A
  restart inside New User without a new switch keeps what was made there.
- The page clears New User's `commandHub.profile.new-user.*` preferences
  before restarting and points `commandHub.activeProfile` at the new profile;
  at start-up it re-syncs with the backend (`syncActiveProfile`).
- Machine-scope data (installed extensions, Claude Stats, Storage) is shared,
  so it still shows in New User. The MCP server follows `activeId`, so agents
  also see New User while it is open.
- The default profile's folder is never deleted, moved or copied; tests in
  `electron/profiles/profiles.test.cjs` check it.

## Not a lock

Profiles keep people's things apart; they do not keep people out. Anyone who
can use the computer account can read every profile's folder, and secrets are
encrypted with the computer account's key (Electron safeStorage), which is the
same for every profile. Separate Windows accounts remain the way to keep data
private from another person. If profiles ever get a lock, it is its own phase
with its own design.

## Phases

1. **Foundation (done).** One default profile over the existing data, the scope
   table, the profile layout in every backend and in the MCP server, `prefs`
   for page preferences, and **Settings > Profile** to name it.
2. **More profiles.** Create, rename, switch (restarting the window is fine)
   and remove a profile. Background work (backup schedules, Claude Stats
   refresh) runs for the active profile. Extension data, settings and secrets
   move to profile scope for profiles created from then on (the default keeps
   its machine-level folders in place). Connections stay per profile, so a
   second person signs in to their own accounts.
3. **Bring things along.** When creating a profile, optionally copy chosen
   items from another one (appearance, Chat folders, a Flashcards deck),
   always as a copy the user starts, never a move.
4. **Beyond one computer account** (if ever): a profile picker at start and an
   optional lock, designed separately.
