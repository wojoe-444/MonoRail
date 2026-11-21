---
audience: ai
summary: How Tracker stores and checks issues, projects, cycles and initiatives in the local database, and where its code lives.
---

# Tracker (reference)

Tracker is a Workspace app under Tools (`src/apps/tracker`, backend
`electron/apps/tracker`). The guide for people is
[Tracker](guide/workspace/tracker.md); the entity types and every field are on
the standard's [Tracker page](standard/monorail/tracker.md).

## Storage

- Everything is an entity in [MonoRail's local database](local-database.md)
  (`localDb()`), written with `put`, so every change is a new version and
  nothing is overwritten. The app's own data folder (`apps/tracker`, profile
  scope) stays empty.
- Teams and members are OpenMetadata `team` and `user` entities with
  `extension.tracker`; the rest are MonoRail's own types (`issue`,
  `workflowState`, `issueLabel`, `project`, `projectMilestone`,
  `projectUpdate`, `cycle`, `initiative`, `customView`, `comment`). Own types
  carry `entityType` so a row read by id says what it is.
- Full names: a team is its key, a project, initiative or member its name;
  anything inside a team or project starts with the parent's **id**
  (`<teamId>.<number>` for an issue, `<projectId>.<name>` for a milestone), so
  renames never cascade. A full name another entity of the type already has is
  refused with a readable message (`put` would otherwise match it and update
  the wrong entity).
- Issues are deleted softly (`deleted: true`, `archivedAt`) and restored with
  `restoreIssues` (the page's Undo). Everything else is removed for good, with
  references cleared in the same transaction: a removed project clears
  `projectId` and `projectMilestoneId` on its issues and drops its milestones
  and updates; a removed label comes off every issue; a removed member is
  unassigned everywhere. A status in use needs `moveTo`; the default status and
  the last Started, Completed, Canceled or Backlog/Unstarted status cannot go.
  A team can only be removed with no issues (deleted ones count).

## Rules the backend enforces (`model.cjs`)

- Status belongs to the issue's team; Triage only while the team has it on.
- `startedAt`, `completedAt`, `canceledAt` and `triagedAt` follow status type
  changes.
- One label per label group (adding a label replaces its group sibling);
  team labels only on that team's issues.
- A milestone belongs to the issue's project (changing project clears it); a
  cycle belongs to the issue's team; parents never loop; relations
  (`blocks`, `related`, `duplicate`) point at live issues, not at the issue
  itself. The reverse side (blocked by, duplicated by) is worked out on read.
- Moving to another team: next number there, the first status of the same
  type, cycle and team labels cleared, old identifier kept.
- Estimates are dropped when the team does not use them.
- **Cycles** (`scheduleCycles`, called by the page once per visit per team
  setting): back-to-back cycles of `cycleDuration` weeks with
  `cycleCooldown` between, from `cycleStartDate` or this week's Monday, until
  `upcomingCycleCount` lie ahead. Cycles of a team never overlap. With
  `cycleAutoRollover`, unfinished issues of an ended cycle move to the
  current one and the cycle gets `completedAt`. Idempotent.
- Views keep only the known filter keys and display options.

## Backend methods

`snapshot` (everything the page shows, one read; comments are counted, not
sent), `createTeam` (with the default workflow and a member for you),
`updateTeam`, `createIssue`, `updateIssues` (one patch for many issues, plus
`addLabelIds` / `removeLabelIds`), `deleteIssues`, `restoreIssues`,
`issueDetail` (comments and the history worked out from versions),
`addProjectUpdate`, `scheduleCycles`, `addExample` (fictional, empty tracker
only), and the generic `save({ type, entity })` / `remove({ type, id,
moveTo })`. No method needs this PC's screen, and none changes accounts or
secrets. They are listed under `phone` in the [Remote access policy](remote-access.md#phone-coverage).

## The page

- `TrackerContext.tsx` holds the snapshot and its lookups (`buildIndex` in
  `lib.ts`), runs calls with optimistic issue patches and toasts, keeps the
  open issue in the URL (`?issue=ENG-12`) and the create dialog state.
- `components/IssueBrowser.tsx` is every issue list: filters, display options
  (list or board, grouping, ordering, completed issues, sub-issues, empty
  groups), drag and drop (board columns and manual order with
  `between()`), bulk actions and save-as-view. Each page remembers its own
  filters and display with `prefs` (`commandHub.tracker.browse.<page>`).
- `components/IssuePanel.tsx` is the issue side panel; `CreateIssue.tsx` the
  new-issue dialog (C anywhere, Ctrl+Enter to create).
- The browser dev server uses the fictional data and the small in-memory
  stand-in in `sample.ts`.

## Related

- [Local database](local-database.md)
- [The MonoRail standard](standard/README.md)
- [Tasks](guide/workspace/tasks.md), the Jira-backed tracker, which keeps its
  own git repo and is separate from Tracker.
