---
audience: human
summary: A to-do list kept inside a git repository, which travels with it and stays private unless you publish.
---

# Local issues

GitHub+'s **Issues** tab keeps a to-do list inside a git
[repository](../glossary.md#repository): bugs, ideas, notes to self. Open a
repository in [GitHub+](browse-repos.md) and choose **Issues**.

## What you can do

- **Create** an issue with a title and a description in Markdown.
- **Comment** on it, **edit** it, **close** it and **reopen** it.
- Filter open and closed issues.

## Where they are kept

Inside the repository, in git, but away from your files: they never show up
as changes in your working folder, and every edit is saved as its own
[commit](../glossary.md#commit) on a private line of history. That means:

- [backups](../setup/backups-and-updates.md) of the repository carry them;
- a normal push does **not** send them anywhere;
- nothing about them is stored in MonoRail's [data
  folder](../private-data.md#where-your-data-lives).

## Also on GitHub, if you want

If the repository also lives on github.com and you have
[connected GitHub](../setup/connections.md#the-connections), the New issue
page offers **Also create it on GitHub**. It starts off every time, so an
issue only goes public when you tick it. Later edits and comments stay local.

## Agents and issues

Agents can read local issues through [agent access](../agents/agent-access.md),
and create or comment on them only if you allow that agent those tools.
Agents never publish an issue to GitHub.

## Issues or tasks?

Local issues belong to one repository. For work that spans several, or that
your team tracks in Jira, use [Tasks](tasks.md), which can link a task to
any number of repositories.
