---
audience: human
summary: GitHub+ shows the git repositories on your computer in a familiar, GitHub-style view.
---

# Browse your repos

**Workspace > GitHub+** is a GitHub-style browser for the git
[repositories](../glossary.md#repository) on your own computer: the code,
the README, the history, branches and comparisons, without opening a
terminal. It only reads; it never changes your files.

## Open a repository

Press **Open a repository** and pick a folder. GitHub+ remembers it on its
home page with its recent activity. Repositories that MonoRail itself keeps,
like your [Jira+](jira-plus.md) private projects, are listed there
automatically.

## What you can see

- **Code**: folders and files, with the README shown below, and when each
  file last changed.
- **History** and **commits**: every [commit](../glossary.md#commit), with
  what it changed.
- **Branches** and **Compare**: how far [branches](../glossary.md#branch)
  have moved apart, and the difference between any two.

If an agent is working in the repository right now, the **Changes** panel in
[Chat](../agents/chat.md#side-panels) shows its uncommitted edits.

## Issues

The **Issues** tab keeps a to-do list inside the repository itself. See
[local issues](local-issues.md).

## Your GitHub repositories

Once you [connect GitHub](../setup/connections.md#the-connections), GitHub+
also lists your repositories on github.com, including team ones. You can
clone one into a folder you pick, or open it on github.com. Repositories you
already have on your computer get a small cloud mark instead. Until then
GitHub+ makes no requests to GitHub at all.

## Linked tasks

The **Tasks** tab shows [Jira+](jira-plus.md#tasks-and-repositories) tasks
linked to the repository, and you can link more from either side.

## Backups

The **Backups** tab copies a repository to a folder of your choice on a
schedule, or follows the app-wide setting. See
[backups and updates](../setup/backups-and-updates.md).

## Related

- The agents in a repository's `.claude\agents` folder:
  [create an agent](../agents/create-an-agent.md#where-agents-live).
- Everything else in [your workspace](README.md).
