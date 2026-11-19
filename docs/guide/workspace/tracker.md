---
audience: human
summary: Linear-style local planning with teams, workflows, cycles, projects, milestones and initiatives.
---

# Tracker

**Tools > Tracker** plans work with **teams**, custom **workflows**, **cycles**,
**projects** and **initiatives** — all stored locally in MonoRail's
[local database](../glossary.md#local-database)
([private data stays local](../private-data.md)). Assignees are local names only;
nothing is synced or sent anywhere. (Separate from [Tasks](tasks.md), which
integrates with Jira.)

## Getting started

Create a team with a name and short key (e.g. `ENG` → `ENG-1`, `ENG-2`), or
click **Add a fictional example team** to explore first.

## Issues

Press **C** (or the compose button) anywhere in Tracker to create an issue
(`Ctrl+Enter` submits; toggle **Create more** for rapid entry). Click any issue
to edit its Markdown description, properties (changing team renumbers it),
**sub-issues**, **relations** (blocks, related, duplicate), comments and full
**activity** log. Deleted issues offer an inline **Undo**.

### Lists and boards

Every issue view shares consistent controls (remembered per view):

- **Filter** by status, priority, assignee, label, project, cycle, team or due
  date.
- **Display**: switch **List** vs. **Board**, group or sort (including manual
  drag order), and toggle finished items, sub-issues or empty groups.
- Drag rows/cards between groups, click inline cells to edit in place, or
  Shift-select rows for bulk actions.

## Teams, workflow and triage

Configure each team's workflow statuses (Backlog, Unstarted, Started, Completed,
Canceled) in team settings. Enable **Triage** to route new issues through an
inbox (**Accept**, **Duplicate**, **Decline**).

## Cycles

Enable **Cycles** in team settings (1–8 weeks, optional cooldown, auto-created
upcoming cycles). Unfinished issues roll over to the next cycle by default.

## Projects and initiatives

- **Projects**: target-dated goals tracking estimate-weighted progress,
  **milestones** and health **updates** (*on track*, *at risk*, *off track*).
- **Initiatives**: roll up multiple projects (and sub-initiatives) under higher
  goals.

## Views, members and labels

- **Views**: save any filter + display combination across one or all teams.
- **Members & labels** (**Tracker settings**): add assignee names and shared or
  team labels (including mutually exclusive **label groups**, e.g. *Type*).

## Where it is kept

Stored as versioned [MonoRail standard](../../standard/monorail/tracker.md)
entities in the [local database](../../local-database.md) (see the
[Tracker reference](../../tracker.md) for developers).
