---
audience: human
summary: Browse local git repositories in a read-only GitHub-style view with code, history, branches, diffs and issues.
---

# Browse your repos

**Tools > GitHub+** is a read-only, GitHub-style browser for local git
[repositories](../glossary.md#repository): inspect code, READMEs, commit
history, branches and diffs without touching a terminal.

## Open a repository

Click **Open repository** to pick a folder; GitHub+ remembers it on its home
page. MonoRail's own internal repos (such as [Tasks](tasks.md) private projects
and [Notes](notes.md)) appear automatically.

## The home page

Five tabs — **Overview**, **Repositories**, **Activity**, **Issues** and
**Backups** — with a live filter box (press **Enter** to
[search code](search-code.md) across every repo):

- **Summary strip**: repo and open-issue counts, unpushed commits, uncommitted
  files and backup alerts.
- **Active branches**: recent [branches](../glossary.md#branch) with
  behind/ahead bars and **Compare**.
- **Repositories**: current branch and sync indicators (`↑` unpushed, `↓` to
  pull, `●` dirty, *clean*), plus folder/issue/task counts and GitHub repos.
- **Recent commits**: latest [commits](../glossary.md#commit) across all repos.

## What you can see

Every repo displays a status strip (distance from main, unpushed/uncommitted
counts, last backup, latest commit) and a branch switcher:

- **Code**: file tree beside the folder's collapsible README.
- **History & commits**: commit log and diffs.
- **Branches & Compare**: divergence between any two
  [branches](../glossary.md#branch).

Press **/** to [search the repo](search-code.md), or click any line number to
see [when that line changed](search-code.md#when-did-this-line-change). For live
uncommitted edits by an agent, see the **Changes** side panel in
[Chat](../agents/chat.md#side-panels).

## Issues

The **Issues** tab tracks [local issues](local-issues.md) stored right inside
the repository.

## Your GitHub repositories

Once you [connect GitHub](../setup/connections.md#the-connections), GitHub+
lists your personal and team repos on github.com so you can clone or open them
(local clones show a cloud badge). Without that connection, GitHub+ makes zero
network calls.

## Linked tasks

The **Tasks** tab shows [Tasks](tasks.md#tasks-and-repositories) linked to the
repository; link more from either side.

## Backups

The **Backups** tab backs up the repo as a `.bundle` on its own schedule or
using the app-wide setting ([backups and updates](../setup/backups-and-updates.md)).

## Related

- [Search your code](search-code.md) ·
  [Repo subagents](../agents/create-an-agent.md#where-agents-live) ·
  [Your workspace](README.md)
