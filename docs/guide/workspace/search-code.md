---
audience: human
summary: Search the code, files, commits, changes and issues of your repositories, including work you have not committed yet.
---

# Search your code

[GitHub+](browse-repos.md) can search everything in your
[repositories](../glossary.md#repository): the code, file names,
[commit](../glossary.md#commit) messages, the whole history of changes, and
[local issues](local-issues.md). It all runs on your computer, so it works
offline and nothing is sent anywhere.

## Where to search

- **One repository**: the search box in the repository's tab row. Press
  **/** on any repository page to jump to it.
- **Every repository**: on the GitHub+ home page, type in the search box and
  press **Enter**, or press **Search code**. This searches every repository
  listed on the home page, each one shown as its own group.
- **Find a file**: the box above the file tree on the **Code** tab finds a
  file anywhere in the [branch](../glossary.md#branch), not only in folders
  you have opened. Letters in order are enough: `sfmt` finds
  `src/format.ts`. **Enter** opens the best match.

This is a different search from the [command palette](../search.md)
(**Ctrl+K**), which finds MonoRail's pages, chats and settings.

## What it finds that github.com does not

- **Work you have not committed yet.** By default it searches the working
  folder: files as they are on disk now, including edits you have not
  committed and new files. Files your `.gitignore` hides are left out. A
  result found there says **Working folder**, and opening it shows the file
  as it is on disk.
- **Any branch, tag or commit.** Pick one in the **Where** list next to the
  box, or add `ref:feature/x` to the search.
- **Several branches at once.** `ref:main,feature/x` searches both, shows
  which branch each match is in, and counts the files found in only one of
  them.
- **The whole history.** The **Changes** tab lists the commits that added or
  removed the text, newest first: the quickest way to answer "when did this
  appear?" or "when did this function disappear?". It reads every change in
  the history, so it can take a while on a big repository; it only runs when
  you open the tab.
- **Every repository at once**, private ones and ones that were never pushed
  anywhere included.

## The result tabs

| Tab | What it lists |
| --- | --- |
| **Code** | Matching lines, with the line above and below, grouped by file. Click a line number to open the file at that line. |
| **Files** | File paths that match, best match first. |
| **Commits** | Commits whose message matches. A commit's short id also finds it. |
| **Changes** | Commits whose changes added or removed the text, with the files they touched. |
| **Issues** | [Local issues](local-issues.md) whose title, description or comments match, and [linked tasks](tasks.md#tasks-and-repositories). |

## Narrow it down

Type any of these into the box, together with your text. The buttons beside
the box do the same as the first three.

| Type | Means |
| --- | --- |
| **Aa** button or `case:yes` | Match upper and lower case exactly |
| **ab** button or `word:yes` | Whole words only |
| **.\*** button or `/text/` | A regular expression |
| `"two words"` | An exact phrase |
| `path:src/apps` | Only paths that contain this; `path:*.test.ts` takes wildcards |
| `-path:node_modules` | Leave these paths out |
| `lang:ts` | Only one language's files (ts, js, py, cs, go, rs, md, sql, ...) |
| `ref:main` | A branch, tag or commit instead of the working folder |
| `ref:working` | The working folder, together with a `ref:` |
| `def:formatDate` | Where something is defined: a function, class, constant and so on |
| `author:ann` | Commits and changes by someone |
| `after:2026-01-01` `before:2026-06-30` | Commits and changes in a date range |
| `is:open` / `is:closed` | Only open or closed issues |
| `repo:notes` | When searching every repository: only repositories whose name contains this |

Press **Tips** next to the box for the same list, and click an example to try it.

## When did this line change?

On any file page, click a line number. A panel opens above the file with who
changed that line last, and every commit that changed it, each with the lines
it changed. Click a commit to see all of it.

## Saved searches

Press **☆ Save** to keep a search, up to eight. The GitHub+ home page then
shows each one with how many lines match across all your repositories right
now: handy for keeping an eye on `TODO` or `FIXME`. Saved searches are kept
with your other [settings on this computer](../private-data.md).

## Related

- [Browse your repos](browse-repos.md): everything else GitHub+ shows.
- [Local issues](local-issues.md): the to-do list kept inside a repository.
- Everything in [your workspace](README.md).
