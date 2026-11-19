---
audience: human, ai
summary: Quick Markdown notes stored in a local git repository with automatic commit history and GitHub+ integration.
---

# Notes

**Tools > Notes** is a fast Markdown scratchpad — no folders, fields or tags.
Click **New note** and type; the first line becomes the title. Switch between
**Write** and **Preview**, or search full text across every note. Part of
[your workspace](README.md).

## Where notes are kept

Every note is a `.md` file inside a private local git repo in your
[data folder](../private-data.md#where-your-data-lives):

```
%APPDATA%\MonoRail\modules\notes\repo\
  notes\2026-11-11-standup-scratch.md
```

- **Auto-save & commits**: writes to disk as you pause typing; commits after a
  quiet minute, on switching notes/pages, or on next launch (blank notes are
  skipped) so history reflects editing sessions.
- **Stable filenames**: follows the title until first commit, then stays fixed
  to preserve git history.
- **History & delete**: open **⋯ > History** to inspect any past version.
  Deleting removes the file and commits while keeping earlier history intact.
- **External edits**: `.md` files (lowercase letters, digits, dashes) added or
  edited in `notes\` outside MonoRail are picked up automatically.

The repo **never gets a remote** and never leaves your PC.

## In GitHub+ & Backups

[GitHub+](browse-repos.md) automatically lists the repo as **Notes** (click
**Open in GitHub+** from Notes to browse diffs/commits; never added to Chat's
allowed folders). When the global backup folder is enabled, Notes backs up on
schedule as one `.bundle` ([backups and updates](../setup/backups-and-updates.md)).

## Code

Page `src/modules/notes/` (browser preview `sample.ts`); backend
`electron/modules/notes.cjs` + `notes-store.cjs` (isomorphic-git with `.git`
lock; tests `notes.test.cjs`); GitHub+ entry in
`electron/apps/github-plus/linked.cjs`; backup job in
`electron/backups/global.cjs`. Standard type:
[Note](../../standard/monorail/workspace.md#note) in the
[MonoRail standard](../../standard/README.md).
