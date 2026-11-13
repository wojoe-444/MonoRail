---
audience: human
summary: Your private tasks and your team's Jira on one page; private projects stay on your computer.
---

# Tasks

**Workspace > Tasks** (called Jira+ before) keeps every task, big or small, on
one page. Its special trick is that a **private project** on your computer is
a first-class project, right next to your team's real Jira projects. Your
existing Jira+ tasks are all still there: Tasks reads the same data in place.

## Finding your way around

- **Overview** shows four numbers (open tasks, due in the next 7 days, in
  progress, time logged), an **Up next** list with the soonest
  [expected end date](#recurring-maintenance-and-expected-end-dates) first,
  and a card per project.
- **List** groups tasks by status. Turn on **Show done** to see finished ones.
- **Board** has a column per status; drag a card to move it.
- **Calendar** shows tasks by expected end date (the same view as
  **Workspace > Calendar**).
- The project buttons next to the views (**All projects**, then each project)
  narrow every view to one project. A project adds **Epics**, **Recurring**
  (private projects) and **On trigger**.
- Type a key such as `ME-12` in the search box and press Enter to open that
  task; any other text filters the list and board.
- Click a task to open it in a panel on the right. Everything below
  ([parents](#parents-and-child-issues), [time](#logging-time),
  [comments](#comments), [repositories](#tasks-and-repositories)) lives there.
- **Team Jira** connects or changes your team's Jira, and **New task** adds a
  task to the project you are looking at.

## Private projects

Private projects are for work only you need to track. They are kept in a
small git [repository](../glossary.md#repository) in MonoRail's [data
folder](../private-data.md#where-your-data-lives); each change is a
[commit](../glossary.md#commit), so an issue's history is complete. That
repository never gets a remote: nothing in it is uploaded. You can still look
at it in [GitHub+](browse-repos.md), where it is listed as "Tasks projects",
and include it in [backups](../setup/backups-and-updates.md).

## Your team's Jira

[Connect your Atlassian account](../setup/connections.md#the-connections)
and Tasks shows your team's projects and tickets too, fetched from Jira when
you open them and not stored. Without a connection, Tasks shows only private
projects. The one Tasks setting is a filter for which team tickets to show.

## Recurring maintenance and expected end dates

In a private project, open **Recurring** and create a maintenance item with an expected end date and a daily, weekly or monthly schedule. When you mark an occurrence Done, Tasks creates the next one with its date advanced from the previous expected end date. Monthly dates that do not exist in the next month move to its last day. Reopening and completing an old occurrence does not create another copy. Recurring items are listed separately from the project board and regular task list. Team Jira recurrence is managed in Jira.

Under **On trigger**, save task templates and describe the conditions you want to connect later. Templates are stored in the private Tasks repository, including for team projects. Hooks are not connected yet, so these notes do not create tasks.

Any issue can have an **Expected end date**, set at creation or in Details. For a team issue this is Jira's due date and is subject to that project's Jira permissions and field configuration.

## Parents and child issues

Any issue can sit under a **parent**: an epic, a story or another task in the
same project. Set it in the issue's **Parent** field, or pick one when you
create the issue. The parent shows above the issue's title and on its board
card. A parent lists its **child issues** with how many are done, and **Add
child issue** creates a new one under it. In private projects any issue can
be a parent (Epic is one of the types); for your team's Jira, Jira itself
decides which types can be parents.

## Logging time

**Log time** at the top of the task panel records how long you worked, when you
started and what you did. The **Work log** tab lists every entry, and you can
delete one there. Choose when the work started, including a past date when catching up. Each entry shows both the work start and when it was logged, in your local time. Details shows the time logged on the issue and, for a
parent, the total including all its child issues. Time is written the Jira
way: `2h 30m`, `45m`, or `1d` for a day of 8 hours. In private projects the
log is saved with the ticket, so its [history](#private-projects) records it;
on team tickets it becomes a real Jira worklog your team can see.

## Comments

The **Comments** tab under an issue's Activity is where you write notes and
replies. Who reads them depends on the project, and the box says so before
you send:

- On a [private](#private-projects) ticket a comment is saved with the
  ticket on your computer and never sent anywhere. Each comment, edit or
  delete is a commit, so the ticket's history keeps every version.
- On a [team](#your-teams-jira) ticket, **Post to Jira** adds a real Jira
  comment under your Atlassian name. Everyone who can see the ticket can read
  it, and Jira may email the people watching it.

**Edit** and **Delete** appear under your own comments. On team tickets Jira
decides who may change a comment, and an edit or delete changes it for the
whole team. Board cards show how many comments a ticket has.

## Tasks and repositories

Any task, private or team, can be linked to local repositories and to
repositories on github.com. The task panel's **Repositories** card lists
them; [GitHub+](browse-repos.md#linked-tasks) shows the same links from the
repository's side, on its **Tasks** tab. Links are kept only in Tasks' own
data folder, never written to Jira, GitHub or the repository.

## Agents

Agents can read private projects through [agent access](../agents/agent-access.md),
and create or comment on private issues only with your OK.

## Related

- For to-dos that belong to one repository: [local issues](local-issues.md).
- Everything else in [your workspace](README.md).
