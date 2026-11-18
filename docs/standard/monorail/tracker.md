---
audience: human, ai
summary: MonoRail's own entity types for planning work in Tracker: issues, workflow states, labels, projects, milestones, updates, cycles, initiatives, views and comments.
---

# Tracker

Entity types of MonoRail's own for planning and tracking work in
[Tracker](../../guide/workspace/tracker.md). They follow the planning model
that fast product teams use (teams with their own workflow, cycles, projects
and initiatives), with the usual field names kept where they fit. They are
stored in [MonoRail's local database](../../local-database.md) like every
other entity, so each keeps every version: an issue's history is worked out
from them. The developer reference is [Tracker (reference)](../../tracker.md).

Teams and members are not new types. They are OpenMetadata's own
[Team](../teams-and-users/team.md) and [User](../teams-and-users/user.md),
adopted whole (see the [rules](../README.md#rules)); Tracker's settings for
them go in `extension.tracker`, and only teams and users carrying that key
belong to Tracker. OpenMetadata's [Task](../collaboration/task.md) is not used
for issues: it is a governance request about a data asset (approve a term,
grant access), not a unit of planned work.

<!-- standard:entities tracker -->

| Entity | Type | What it is | In MonoRail |
| --- | --- | --- | --- |
| [Issue](tracker.md#issue) | `issue` | A unit of work in a team: title, status, priority, estimate, assignee, labels, project, cycle, parent and relations. | Tools > Tracker |
| [Workflow state](tracker.md#workflow-state) | `workflowState` | A status in a team's workflow, of one of six types: triage, backlog, unstarted, started, completed, canceled. | Tools > Tracker |
| [Issue label](tracker.md#issue-label) | `issueLabel` | A label for issues, for the whole workspace or one team; a label group holds labels of which an issue takes one. | Tools > Tracker |
| [Project](tracker.md#project) | `project` | A time-bound piece of work with a goal, across teams: status, priority, lead, dates, milestones and updates. | Tools > Tracker |
| [Project milestone](tracker.md#project-milestone) | `projectMilestone` | A stage of a project with a target date; issues of the project can belong to one. | Tools > Tracker |
| [Project update](tracker.md#project-update) | `projectUpdate` | A dated progress note on a project with its health: on track, at risk or off track. The newest sets the project's health. | Tools > Tracker |
| [Cycle](tracker.md#cycle) | `cycle` | A team's fixed-length period of work (a sprint). Made automatically when the team turns cycles on; unfinished issues roll over. | Tools > Tracker |
| [Initiative](tracker.md#initiative) | `initiative` | A larger goal that groups projects, with an owner, status and target date; initiatives can nest. | Tools > Tracker |
| [Custom view](tracker.md#custom-view) | `customView` | A saved set of issue filters and display options (layout, grouping, ordering), for the workspace or one team. | Tools > Tracker |
| [Comment](tracker.md#comment) | `comment` | A Markdown comment on an issue, optionally a reply in a thread. | Tools > Tracker |

<!-- /standard -->

## Issue

A unit of work in a team. Its identifier is the team key and its number,
like `ENG-12`; it is worked out on read, so renaming a team's key renames
every identifier. Moving an issue to another team gives it a new number there
and keeps the old identifier in `previousIdentifiers`.

<!-- standard:fields issue -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The issue number as text (unique per team). |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `number` | `number` | Yes | The number within its team; with the team key it makes the identifier, like ENG-12. |
| `title` | `string` | Yes | One line, up to 500 characters. |
| `description` | `markdown` |  | The issue text. |
| `teamId` | `uuid` | Yes | The team it belongs to. |
| `stateId` | `uuid` | Yes | Its workflow state (status) in that team. |
| `priority` | `number` | Yes | 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low. |
| `estimate` | `number` |  | Points on the team's estimate scale; empty when not estimated. |
| `assigneeId` | `uuid` |  | The member it is assigned to. |
| `creatorId` | `uuid` |  | The member who made it. |
| `labelIds` | `uuid[]` |  | Its labels, at most one from each label group. |
| `projectId` | `uuid` |  | The project it is part of. |
| `projectMilestoneId` | `uuid` |  | A milestone of that project. |
| `cycleId` | `uuid` |  | A cycle of its team. |
| `parentId` | `uuid` |  | The parent issue when this is a sub-issue; never a loop. |
| `dueDate` | `date` |  | Due date, YYYY-MM-DD. |
| `relations` | `object[]` |  | `{ type: blocks \| related \| duplicate, issueId }`, from this issue to another. The other side (blocked by, duplicated by) is worked out on read. |
| `sortOrder` | `number` | Yes | Its place in manual ordering (lower first). |
| `createdAt` | `timestamp` | Yes | When it was made. |
| `startedAt` | `timestamp` |  | First moved to a Started status. |
| `completedAt` | `timestamp` |  | Moved to a Completed status. |
| `canceledAt` | `timestamp` |  | Moved to a Canceled status. |
| `triagedAt` | `timestamp` |  | Moved out of Triage. |
| `previousIdentifiers` | `string[]` |  | Identifiers it had before moving to another team. |
| `deleted` | `boolean` |  | Deleted issues can be restored. |
| `archivedAt` | `timestamp` |  | When it was deleted. |

<!-- /standard -->

## Workflow state

A status in a team's workflow. Its type decides where it shows and what
counts as done: `triage` (an inbox for new issues, only when the team turns
Triage on), `backlog`, `unstarted`, `started`, `completed` and `canceled`. A
new team starts with Triage, Backlog, Todo (the default), In Progress, In
Review, Done, Canceled and Duplicate.

<!-- standard:fields workflowState -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The status name, unique in its team. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `teamId` | `uuid` | Yes | Its team. |
| `type` | `enum` | Yes | `triage`, `backlog`, `unstarted`, `started`, `completed` or `canceled`. Fixed once made. |
| `color` | `string` | Yes | A `#rrggbb` color. |
| `position` | `number` | Yes | Order within its type (lower first). |
| `description` | `string` |  | What it means, up to 500 characters. |

<!-- /standard -->

## Issue label

A label for issues, for the whole workspace or one team. A label group holds
labels of which an issue can carry only one (for example *Type*: Bug,
Feature).

<!-- standard:fields issueLabel -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The label name, unique among its siblings. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `teamId` | `uuid` |  | Its team; empty for a workspace label. |
| `parentId` | `uuid` |  | Its label group. |
| `isGroup` | `boolean` | Yes | A label group: holds labels and is not put on issues itself. |
| `color` | `string` | Yes | A `#rrggbb` color. |
| `description` | `string` |  | Up to 500 characters. |

<!-- /standard -->

## Project

A time-bound piece of work with a goal, possibly across teams. Its health
comes from its newest [project update](#project-update); its progress from
its issues, weighted by estimate.

<!-- standard:fields project -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The project name, unique in the workspace. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `summary` | `string` |  | One line, up to 255 characters. |
| `description` | `markdown` |  | The project brief. |
| `icon` | `string` |  | An emoji. |
| `color` | `string` | Yes | A `#rrggbb` color. |
| `status` | `enum` | Yes | `backlog`, `planned`, `started`, `paused`, `completed` or `canceled`. |
| `priority` | `number` | Yes | 0 No priority to 4 Low, as on issues. |
| `leadId` | `uuid` |  | The member who leads it. |
| `memberIds` | `uuid[]` |  | Members working on it. |
| `teamIds` | `uuid[]` |  | Teams it belongs to. |
| `startDate` | `date` |  | Planned start. |
| `targetDate` | `date` |  | Target date. |
| `startedAt` | `timestamp` |  | First set to started. |
| `completedAt` | `timestamp` |  | Set to completed. |
| `canceledAt` | `timestamp` |  | Set to canceled. |
| `sortOrder` | `number` | Yes | Manual order. |
| `createdAt` | `timestamp` | Yes | When it was made. |

<!-- /standard -->

## Project milestone

A stage of a project with a target date. Issues of the project can belong to
one.

<!-- standard:fields projectMilestone -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The milestone name, unique in its project. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `projectId` | `uuid` | Yes | Its project. |
| `description` | `string` |  | Up to 2,000 characters. |
| `targetDate` | `date` |  | Target date. |
| `sortOrder` | `number` | Yes | Order in the project. |

<!-- /standard -->

## Project update

A dated note on how a project is going, with its health.

<!-- standard:fields projectUpdate -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The update id. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `projectId` | `uuid` | Yes | Its project. |
| `health` | `enum` | Yes | `onTrack`, `atRisk` or `offTrack`. |
| `body` | `markdown` | Yes | The update. |
| `userId` | `uuid` | Yes | Who wrote it. |
| `createdAt` | `timestamp` | Yes | When it was written. |

<!-- /standard -->

## Cycle

A team's fixed-length period of work. When a team turns cycles on, Tracker
makes the current cycle and the upcoming ones from its settings (length,
cooldown, how many ahead), and, if the team wants, moves unfinished issues of
an ended cycle into the next one.

<!-- standard:fields cycle -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The cycle number as text. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `teamId` | `uuid` | Yes | Its team. |
| `number` | `number` | Yes | Counts up per team. |
| `title` | `string` |  | An optional name. |
| `description` | `string` |  | Up to 2,000 characters. |
| `startsAt` | `date` | Yes | First day. |
| `endsAt` | `date` | Yes | The day after the last day. Cycles of a team never overlap. |
| `completedAt` | `timestamp` |  | When it ended and its unfinished issues rolled over. |

<!-- /standard -->

## Initiative

A larger goal that groups the projects working toward it. Initiatives can
nest (sub-initiatives); progress counts every project below.

<!-- standard:fields initiative -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The initiative name, unique in the workspace. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `summary` | `string` |  | One line. |
| `description` | `markdown` |  | The goal in full. |
| `icon` | `string` |  | An emoji. |
| `color` | `string` | Yes | A `#rrggbb` color. |
| `status` | `enum` | Yes | `planned`, `active` or `completed`. |
| `ownerId` | `uuid` |  | The member who owns it. |
| `targetDate` | `date` |  | Target date. |
| `projectIds` | `uuid[]` |  | Its projects. |
| `parentId` | `uuid` |  | The initiative it is part of (sub-initiative); never a loop. |
| `sortOrder` | `number` | Yes | Manual order. |
| `createdAt` | `timestamp` | Yes | When it was made. |

<!-- /standard -->

## Custom view

A saved set of issue filters and display options, for the workspace or one
team.

<!-- standard:fields customView -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The view name, unique in its team or the workspace. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `teamId` | `uuid` |  | Its team; empty for a workspace view. |
| `description` | `string` |  | Up to 500 characters. |
| `icon` | `string` |  | An emoji. |
| `color` | `string` | Yes | A `#rrggbb` color. |
| `filters` | `object` | Yes | Lists of `stateTypes`, `stateIds`, `priorities`, `assigneeIds`, `labelIds`, `projectIds`, `cycleIds`, `teamIds`, `creatorIds`, `milestoneIds`, plus `due` and `query`. Every list given must match. |
| `display` | `object` | Yes | `layout` (list, board), `groupBy`, `orderBy`, `showSubIssues`, `showCompleted`, `showEmptyGroups`. |
| `createdAt` | `timestamp` | Yes | When it was made. |

<!-- /standard -->

## Comment

A Markdown comment on an issue. A comment with `parentId` is a reply in that
comment's thread.

<!-- standard:fields comment -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The entity id, given by the local database. |
| `name` | `string` | Yes | The comment id. |
| `fullyQualifiedName` | `string` | Yes | Unique among entities of the type; starts with the parent's id for things inside a team or project. |
| `entityType` | `string` | Yes | The type name, so a stored entity says what it is. |
| `version` | `number` | Yes | Goes up by 0.1 on every real change; every version is kept. |
| `updatedAt` | `timestamp` | Yes | Last change, ms since epoch. |
| `issueId` | `uuid` | Yes | Its issue. |
| `parentId` | `uuid` |  | The comment it replies to. |
| `body` | `markdown` | Yes | The comment. |
| `userId` | `uuid` | Yes | Who wrote it. |
| `createdAt` | `timestamp` | Yes | When it was written. |
| `editedAt` | `timestamp` |  | Last edit. |

<!-- /standard -->
