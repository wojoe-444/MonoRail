---
audience: human
summary: Private Markdown to-do lists stored inside each git repository without cluttering your working tree.
---

# Local issues

The **Issues** tab in [GitHub+](browse-repos.md) keeps a lightweight, private
to-do list inside each git [repository](../glossary.md#repository).

## What you can do

Create Markdown issues, comment, edit, close/reopen, and filter open vs. closed.

## Where they are kept

Stored inside git on a private ref — never touching your working tree, never
pushed on a normal `git push`, and never stored in MonoRail's
[data folder](../private-data.md#where-your-data-lives). Every change is a
[commit](../glossary.md#commit), so repo
[backups](../setup/backups-and-updates.md) preserve them automatically.

## Also on GitHub, if you want

When a repo lives on github.com and you have
[connected GitHub](../setup/connections.md#the-connections), the New issue form
offers an opt-in **Also create it on GitHub** checkbox (always off by default).
Later edits and comments remain local.

## Agents and issues

Agents can read local issues via [agent access](../agents/agent-access.md), and
create/comment only if you allow those write tools. Agents never publish issues
to GitHub.

## Issues or tasks?

Use local issues for work belonging to one repository. For cross-repo work or
team Jira tickets, use [Tasks](tasks.md) (or [Tracker](tracker.md) for local
team planning).
