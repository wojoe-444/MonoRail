---
audience: human
summary: A Jira-style tracker where private projects on your computer sit next to your team's real Jira.
---

# Jira+

**Workspace > Jira+** is a task tracker in the style of Jira: Your work,
Projects, boards, lists and an issue dialog. Its special trick is that a
**private project** on your computer is a first-class project, right next to
your team's real Jira projects.

## Private projects

Private projects are for work only you need to track. They are kept in a
small git [repository](../glossary.md#repository) in MonoRail's [data
folder](../private-data.md#where-your-data-lives); each change is a
[commit](../glossary.md#commit), so an issue's history is complete. That
repository never gets a remote: nothing in it is uploaded. You can still look
at it in [GitHub+](browse-repos.md), where it is listed as "Jira+ projects",
and include it in [backups](../setup/backups-and-updates.md).

## Your team's Jira

[Connect your Atlassian account](../setup/connections.md#the-connections)
and Jira+ shows your team's projects and tickets too, fetched from Jira when
you open them and not stored. Without a connection, Jira+ shows only private
projects. The one Jira+ setting is a filter for which team tickets to show.

## Tasks and repositories

Any task, private or team, can be linked to local repositories and to
repositories on github.com. The issue dialog's **Repositories** card lists
them; [GitHub+](browse-repos.md#linked-tasks) shows the same links from the
repository's side, on its **Tasks** tab. Links are kept only in Jira+'s own
data folder, never written to Jira, GitHub or the repository.

## Agents

Agents can read private projects through [agent access](../agents/agent-access.md),
and create or comment on private issues only with your OK.

## Related

- For to-dos that belong to one repository: [local issues](local-issues.md).
- Everything else in [your workspace](README.md).
