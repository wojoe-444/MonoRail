---
audience: human
summary: Plan and track work with issues, cycles, projects and initiatives, all kept on your computer.
---

# Tracker

**Tools > Tracker** is a planning tool in the style fast product teams use:
issues live in **teams**, each with its own workflow; teams work in
**cycles**; bigger pieces of work are **projects**; and the biggest goals are
**initiatives**. Everything is kept in [MonoRail's local
database](../glossary.md#local-database) on your computer, as
[private data stays local](../private-data.md) promises. Nothing is sent
anywhere, and the people you assign work to are just names.

It is separate from [Tasks](tasks.md), which is built around your team's Jira.

## Getting started

The first time you open Tracker, create a team: give it a name and a short
**key** such as `ENG`. Issues of the team are numbered with it (`ENG-1`,
`ENG-2`, ...). To look around first, choose **Add a fictional example team**.

## Issues

Press **C** anywhere in Tracker (or the pen button) to make a new issue.
Give it a title, and set its status, priority, assignee, labels, project,
cycle, estimate and due date from the buttons below. **Ctrl+Enter** creates
it; **Create more** keeps the dialog open for the next one.

Click an issue to open it in a panel on the right. There you can:

- edit the title and the description (Markdown);
- change any property on the right; changing the **team** moves the issue
  and gives it a new number there;
- break it into **sub-issues**;
- link **relations**: blocks, related to, or duplicate of another issue (the
  other issue shows "blocked by" or "duplicated by");
- comment and reply, and see the **activity**: every change, with when it
  happened.

Delete an issue from the panel or from a selection; **Undo** in the message
brings it back.

### Lists and boards

Every list of issues (a team, your issues, a project, a cycle, a view, a
search) has the same tools:

- **Filter** by status, priority, assignee, label, project, cycle, team or
  due date. Each filter shows as a chip you can remove.
- **Display** switches between **List** and **Board**, and sets grouping
  (status, assignee, priority, project, cycle, label, team), ordering
  (manual, priority, updated, created, due date, title), whether finished
  issues and sub-issues show, and whether empty groups show.
- Drag a card to another column (or a row to another group) to change that
  property. With **manual** ordering, drop it where you want it.
- Tick rows (Shift picks a range) to change many issues at once.
- Click the priority, status, due date or avatar on a row to change it in
  place.

Each page remembers its own filters and display.

## Teams, workflow and triage

A team has its own **workflow**: the statuses an issue moves through, each of
a type (Backlog, Unstarted, Started, Completed, Canceled). Change them in the
team's settings (the cog on the team's issues page, or **Tracker settings**).
Turn on **Triage** to give the team an inbox: new issues can land there, and
opening one offers **Accept**, **Duplicate** or **Decline**.

## Cycles

Turn on **Cycles** in a team's settings and choose their length (one to eight
weeks), an optional cooldown, and how many upcoming cycles to keep ready.
Tracker makes them for you. When a cycle ends, unfinished issues move to the
next one, unless you turn that off. The team's **Cycles** page shows the
current, upcoming and past cycles with their progress.

## Projects and initiatives

A **project** is work toward a goal with a target date, such as a new
feature. Its page shows progress (finished issues, weighted by estimate),
**milestones** with their own progress, and **updates**: short notes with a
health (on track, at risk, off track). The newest update sets the project's
health on the project list.

An **initiative** groups the projects behind a bigger goal, and can hold
sub-initiatives. Its progress counts every project below it.

## Views

Save any combination of filters and display options as a **view** with the
save button next to **Display**. Views are listed under **Views**; change one
and press **Save view** to keep the change. A view can be for every team or
only one.

## Members and labels

**Tracker settings** lists the **members** you assign work to (names only;
nobody signs in) and the **labels** every team can use. A **label group**
holds labels of which an issue gets at most one, like *Type*: Bug, Feature.
Teams can also have labels of their own.

## Where it is kept

Tracker's issues and everything around them are entities of the
[MonoRail standard](../../standard/monorail/tracker.md), stored in the
[local database](../../local-database.md). Every change is kept as a new
version, which is how the activity list knows what changed.
