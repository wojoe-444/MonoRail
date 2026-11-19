---
audience: human
summary: Manage local private projects alongside your team's Jira tickets, with boards, recurring tasks, worklogs and repo links.
---

# Tasks

**Tools > Tasks** (formerly Jira+) combines local **private projects** on your
PC with your team's live Jira projects on one page. Existing Jira+ data is read
in place automatically.

## Finding your way around

- **Overview**: key counts (open, due within 7 days, in progress, time logged),
  an **Up next** queue sorted by
  [expected end date](#recurring-maintenance-and-expected-end-dates), and
  project cards.
- **List**, **Board** and **Calendar**: group by status (toggle **Show done**),
  drag cards across columns, or view by expected end date (matching **Tools >
  Calendar**).
- Filter by **All projects** or one project (adds **Epics**, **Recurring** for
  private projects, and **On trigger**). Type a key like `ME-12` + Enter to jump
  straight to a task, or click any task to open its right-hand panel for
  [parents](#parents-and-child-issues), [time](#logging-time),
  [comments](#comments) and [repositories](#tasks-and-repositories).

## Private projects

Stored in a local git [repository](../glossary.md#repository) inside your
[data folder](../private-data.md#where-your-data-lives) (never given a remote,
never uploaded). Every edit is a [commit](../glossary.md#commit), browsable in
[GitHub+](browse-repos.md) as *Tasks projects* and included in
[backups](../setup/backups-and-updates.md).

## Your team's Jira

[Connect Atlassian](../setup/connections.md#the-connections) to show team Jira
projects alongside private ones — fetched live on demand and never cached on
disk. Configure a Jira filter under **Team Jira** to choose which team tickets
appear.

## Recurring maintenance and expected end dates

- **Recurring** (private projects): schedule daily, weekly or monthly
  maintenance items. Marking an occurrence Done generates the next one from the
  previous expected end date (clamping month-end dates; re-completing old
  occurrences never duplicates). Recurring items stay separate from regular
  boards.
- **On trigger**: save task templates and trigger notes in your private Tasks
  repo (hooks are not yet wired up).
- **Expected end date**: available on any issue (maps to Jira's due date on team
  tickets, subject to Jira permissions).

## Parents and child issues

Nest issues under a **Parent** (any type in private projects, including Epic;
Jira rules on team projects). Parents display completion progress and an **Add
child issue** shortcut.

## Logging time

Click **Log time** in the task panel using Jira syntax (`2h 30m`, `45m`,
`1d` = 8h) with optional backdated start times. **Work log** lists and deletes
entries; parents roll up child totals. Saved locally on private tickets or as
real Jira worklogs on team tickets.

## Comments

- **Private tickets**: stored locally in git with full edit/delete commit
  history.
- **Team tickets**: **Post to Jira** publishes a real Jira comment visible to
  your team (edit/delete obeys Jira permissions).

## Tasks and repositories

Link any task (private or team) to local or GitHub repos in the task's
**Repositories** card — mirrored on the repo's **Tasks** tab in
[GitHub+](browse-repos.md#linked-tasks). Links live only in Tasks' local data
folder.

## Agents

Agents can read private projects via [agent access](../agents/agent-access.md),
and create or comment only with per-agent approval.

## Related

- [Local issues](local-issues.md) · [Tracker](tracker.md) ·
  [Your workspace](README.md)
