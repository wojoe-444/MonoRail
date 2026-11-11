# Notes

**Notes** (under Home in the nav) is an info dump: links, snippets, meeting
scraps, half-formed ideas. There are no folders, fields or tags. Press
**New note** and type; the first line becomes the note's title. **Write** and
**Preview** switch between the text and its Markdown rendering, and search
finds a word anywhere in any note.

## Where notes are kept

Every note is a plain Markdown file in a local git repository in MonoRail's
data folder:

```
%APPDATA%\MonoRail\modules\notes\repo\
  README.md
  notes\2026-11-11-standup-scratch.md
  notes\2026-11-11-reading-list.md
```

(Older installs keep their original data folder, for example `%APPDATA%\command-hub`.)

- **Saving.** The file is written a moment after you stop typing.
- **Commits.** Changes are committed after a minute without typing, when you
  switch to another note or leave the page, and at the next start for anything
  left over (for example when MonoRail was closed right after typing). So the
  history reads as editing sessions, not keystrokes. A new note that is still
  blank is not committed.
- **File names.** A new note's file is named after its date and title
  (`2026-11-11-standup-scratch.md`) and follows the title until its first
  commit. After that the name stays, so the note's history is never cut by a
  rename.
- **History.** The note's **⋯ > History** lists every commit that changed it and
  shows the text at each one. Deleting a note removes its file and commits at
  once; earlier versions stay in the history.
- **Edits outside MonoRail.** Files you add or change in `notes\` yourself (in
  any editor) are listed and committed the same way. File names must be
  lowercase letters, digits and dashes, ending in `.md`.

The repository **never gets a remote**: it is not pushed to GitHub or anywhere
else, and it lives in your AppData, outside every project folder. Notes are
private data, so keep it that way.

## In GitHub+

GitHub+ lists the repository as **Notes** (with a Notes badge) as soon as it
exists, the same way it lists Jira+'s private projects. **Open in GitHub+** on
the Notes page opens it there, for the file tree, commits and diffs. It is not
added to Chat's allowed folders.

## Backups

With the global backup folder on (Settings > Backups), Notes is backed up on
the global schedule as one `.bundle` file (every note and its whole history)
into `<backup folder>\notes\`. Restore with `git clone "<file>" repo`. See
[Backups](backups.md).

## Code

- Page: `src/modules/notes/` (sample notes for the browser preview in `sample.ts`).
- Backend: `electron/modules/notes.cjs`, storage in `notes-store.cjs`
  (isomorphic-git, no git install needed; a lock file in `.git` keeps writers
  apart). Tests: `electron/modules/notes.test.cjs`.
- GitHub+ listing: `SOURCES` in `electron/apps/github-plus/linked.cjs`.
- Backups: `notes` in `electron/backups/global.cjs` and `service.cjs`.
