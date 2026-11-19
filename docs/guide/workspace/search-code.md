---
audience: human
summary: Search code, filenames, commits, full git history and local issues across all your repos offline — including uncommitted edits.
---

# Search your code

[GitHub+](browse-repos.md) searches everything inside your local
[repositories](../glossary.md#repository) offline — code, filenames,
[commit](../glossary.md#commit) messages, full diff history and
[local issues](local-issues.md) — without sending anything off your PC.

## Where to search

- **One repository**: press **/** in any repo to focus its search box.
- **Every repository**: type in the GitHub+ home search box and press **Enter**
  (or **Search code**).
- **Jump to a file**: type fuzzy characters (e.g. `sfmt` → `src/format.ts`) in
  the box above the **Code** file tree and press **Enter**.

(For MonoRail pages, chats, settings and wiki articles, use
[Ctrl+K](../search.md).)

## What it finds that github.com does not

- **Uncommitted edits**: searches your working folder on disk by default
  (honoring `.gitignore`).
- **Any ref or multiple branches**: pick a ref in **Where** or write
  `ref:feature/x` or `ref:main,feature/x` to compare matches across branches.
- **Full diff history**: the **Changes** tab searches every commit that added or
  removed text (runs on demand when opened).
- **Private & unpushed repos**: searches every local repo at once.

## The result tabs

| Tab | Matches |
| --- | --- |
| **Code** | Matching lines with context, grouped by file (click a line number to jump) |
| **Files** | Matching paths, best match first |
| **Commits** | Commit messages and short hashes |
| **Changes** | Commits whose diffs added or removed the text |
| **Issues** | [Local issues](local-issues.md) and [linked tasks](tasks.md#tasks-and-repositories) |

## Narrow it down

Combine filters with your query (or click **Tips** next to the search box):

| Filter | Meaning |
| --- | --- |
| **Aa** / `case:yes` | Case-sensitive |
| **ab** / `word:yes` | Whole words only |
| **.\*** / `/regex/` | Regular expression |
| `"exact phrase"` | Exact phrase |
| `path:src/apps` / `-path:node_modules` | Include or exclude paths (wildcards supported) |
| `lang:ts` | Filter by language (`ts`, `js`, `py`, `sql`, `md`, …) |
| `ref:main` / `ref:working` | Search specific branch/tag/commit or working folder |
| `def:formatDate` | Symbol definitions (functions, classes, constants) |
| `author:ann` | Commits/changes by author |
| `after:2026-01-01` `before:2026-06-30` | Date range |
| `is:open` / `is:closed` | Issue state |
| `repo:notes` | Filter repos during multi-repo search |

## When did this line change?

Click any line number in a file to open its commit history panel — every commit
that touched that line, clickable to view the full diff.

## Saved searches

Click **☆ Save** (up to 8) to pin live match counts on the GitHub+ home page
(handy for `TODO` or `FIXME`). Stored locally
([private data stays local](../private-data.md)).

## Related

- [Browse your repos](browse-repos.md) · [Local issues](local-issues.md) ·
  [Your workspace](README.md)
