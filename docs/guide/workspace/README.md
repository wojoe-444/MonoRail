---
audience: human
folder: Workspace
summary: The pages for the work itself: your git repositories, issues, tasks, mail and study cards.
---

# Your workspace

Open **Tools** in the menu for GitHub+, Tasks, Calendar, Email, Bookmarks,
Files, Notes and Flashcards. Its overview links to each page, and its flyout lets
you jump straight to one. Each keeps its data on your computer, as [private data stays
local](../private-data.md) promises, and they are linked to each other where
it helps.

- **Explore**, directly below Home in the menu, lets you browse fields from subagents, note summaries, flashcards and the connected [semantic project](../setup/semantic.md). Select a source, entity type, instance or field in Browse estate, search the resulting fields, and select a card to see its value. Other sources are not yet included; warnings identify unavailable or truncated sources.
- **Code.** [Browse your repos](browse-repos.md) with GitHub+: code, history,
  branches and comparisons for the git [repositories](../glossary.md#repository)
  on your computer, plus your repositories on github.com once you
  [connect GitHub](../setup/connections.md#the-connections).
- **To-dos next to the code.** [Local issues](local-issues.md) live inside a
  repository, so they travel with it.
- **Tasks.** [Tasks](tasks.md) (formerly Jira+) keeps private projects on your computer
  next to your team's real Jira, and links tasks to repositories.
- **Calendar.** Calendar shows your tasks on their expected end dates. Select a date to see its tasks, then open one in Tasks. Team issues follow the Team Jira filter in Tasks.
- **Scheduled.** Windows Task Scheduler shows schedules, recent results and the next run for this PC's tasks. You can run, stop, enable, disable or delete tasks that run as your Windows account. Other tasks are read-only; Microsoft system tasks are omitted. Open Task Scheduler from the page to create or edit tasks. Hide removes a task from the list until you unhide it; it does not change the task.
  Its **In-App** page lists the jobs MonoRail runs by itself while it is open:
  [backups](../setup/backups-and-updates.md), the Claude usage report, update
  checks, drive space samples, the PR reviewer and the
  [Remote access](../setup/remote-access.md) check. Each shows its schedule, next
  and last run and whether the last run worked. **Run now** starts a backup, the
  usage report or an update check right away; to change a job's schedule or turn
  it off, open the page that owns it. These jobs stop when MonoRail is closed, and
  one that came due meanwhile runs when it opens again.
- **Mail.** [Email](email.md) reads Gmail or the classic Outlook on your PC.
- **Learning.** [Flashcards](../../flashcards.md) keeps spaced repetition
  decks; agents can add cards if you [let them](../agents/agent-access.md).
- **Your files.** [Files](../../files.md), under Tools, is a file explorer
  with tabs, two panes side by side, previews, pinned folders and color tags.
  Deleting always goes to the Recycle Bin.
- **Info dump.** [Notes](../../notes.md), under Tools, takes anything you want
  to jot down; every note is a file in a git repository on your computer that
  GitHub+ shows too.

Most of these can be [backed up](../setup/backups-and-updates.md) to a folder
of your choice on a schedule, and agents can read them through
[agent access](../agents/agent-access.md).
