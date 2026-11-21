---
audience: ai
summary: Local Git reads, issue persistence, Tasks compatibility and repository linking.
---

# GitHub+ and Tasks

See [Browse your repos](../guide/workspace/browse-repos.md),
[Tasks](../guide/workspace/tasks.md) and the [developer reference](README.md).

## GitHub+

GitHub+ is a Workspace app and a port of `wojoe-444/Local-Repo-UI`.
`electron/apps/github-plus/git.cjs` runs the local Git CLI for repositories
the user opened. Validate refs and paths, and disable repo-configured
textconv and external diffs. Recent paths stay in the app's data folder.
Markdown blocks remote images and external links. `linked.cjs` lists
the private Tasks repo and [Notes](workspace-tools.md#notes-and-flashcards)
as linked repositories. Leave them out of Chat's allowed folders. To open
Explorer, `openInExplorer` accepts only an opened, recent or linked repo
and checks that the target is a directory (`shell.openPath` can run files).

`src/apps/github-plus/styles.css` scopes the `--gh-*` tokens to `.ghp` in
`@layer components` and maps them to the hub palette. Home uses a view
switcher (`?view=`), status strip and dense tables. The repo frame uses
the same header and switches branches on ref-following pages. A lazy file
tree is the navigation on code pages and memoizes listings by commit.
README collapse state is per profile (`commandHub.githubPlus.collapsed.*`).

With a [GitHub connection](connections.md#accounts-and-local-tooling),
`github.cjs` reads `/user/repos` with default affiliation, including
collaborators and organization members. Cache this list for ten minutes
in memory. Match locally opened repos by github.com remote, origin first.
Clone only a listed repo, into the user's chosen folder, with the HTTPS
URL derived from the repo name. New issues are local by default. An
explicit publish uses the repo's own remote and saves a local
`github: { repo, number, url }` link. Later edits and comments stay local.
Keep GitHub+ MCP writes local.

## Search and performance

`search.cjs` supports code (`git grep` with context), files (`ls-files` or
`ls-tree` with fuzzy scoring), commits (`log --grep` and SHA prefix), history
(`log -S` or `-G`), and local issues and linked tasks. Search history only
while its tab is open. The default is the working tree including untracked
files. `readWorkingBlob` resolves paths inside the repository. Validate and
resolve each selected ref (up to four) before using it. Pass search text
after `-e` or with its option, and pathspecs only after `--`. Apply qualifier
filters in JavaScript. Use the same Git process pool (at most six), caps
and time limits for every search, and cancel superseded requests on a
channel. Search across repos uses stored recents and linked repos only.
See the [search guide](../guide/workspace/search-code.md) for syntax.
`lineHistory` uses blame and `log -L`. Save up to eight raw query strings
in `commandHub.githubPlus.savedSearches`. Home reuses counts only for
committed-ref queries and only while `refsFingerprint` matches.

Git process startup is expensive on Windows. Get folder entries with one
`ls-tree`; use one extra `git log --name-only` walk for last commits.
Ask for divergence on the Branches page using `for-each-ref %(ahead-behind:)`
on Git 2.41+ and `rev-list` per branch on older versions. Load working
states after Home paints via `getWorkingStates`. Working states use an
uncached `git status --porcelain=v2 --branch`. Memoize results tied to a
commit in memory. Home summaries use `refsFingerprint`.

## Local issues and backups

`issues.cjs` writes one JSON file per issue in the tree at
`refs/local-issues`. Use Git plumbing (`hash-object`, `mktree`,
`commit-tree`, guarded `update-ref`) so each change is a commit and the
working tree and index stay untouched. Normal pushes omit the ref and
bundle backups carry it. Use `--exclude=refs/local-issues --all` in
commit feeds. See [Local issues](../guide/workspace/local-issues.md).

Repo backup schedules are in the app's `backups.json` (`backup.cjs`).
Each backup is a verified `git bundle --all` written as `.partial` and
renamed on success. Keep the newest configured number. The scheduler
checks at startup and every minute, catches up once for missed work and
retries failures after 15 minutes. See [global backups](../backups.md)
for folder, frequency overrides and retention.

## Tasks

Keep the app id `jira-plus`, route `/apps/jira-plus`, backend directory
`electron/apps/jira-plus`, data folder `apps/jira-plus`, backup id
`jira-plus` and MCP names `*_jira_plus_*`. User-facing text says Tasks.
The legacy `modules/jira` data folder stays in use if it holds data and
the app folder does not. A legacy `connection.json` supplies the Jira
token until forgotten when no Atlassian connection is set up.

The Tasks page uses a `.jp` scope mapped to hub tokens, view routes in
`scope.ts` and a right-side issue panel selected by `?selectedIssue=`.
Calendar reuses `src/apps/calendar/TaskCalendar.tsx`. Team projects use
the Jira Cloud REST API through Connections. The app stores the JQL
filter in `settings.json`. The private `local-repo` is handled by
isomorphic-git, one JSON file per issue and one commit per change. It
has no remote. Preserve that when working on backup or link features.

Local parents must belong to the same project, cycles are refused and
deleting a parent clears children's references in the same commit.
Each worklog keeps its start, seconds and comment, between one minute and
one week. Child lists and rolled-up work are computed on read. Jira uses
its `parent` field and JQL to get children and `aggregatetimespent` for
rolled-up work. Local comments are owned by the local user. Jira comments
use real create/update/delete calls and derive ownership from `myAccount`.
The composer identifies the audience, including potential Jira watcher
notifications.

## Task links

`repo-links.cjs` stores links in Tasks' `repo-links.json` after legacy
data resolution. Links are many-to-many. Local repos store the Git
root plus a verified github.com `owner/name` if present, and a GitHub-only
repo stores only `owner/name`. Match by either on local clones. The file
keeps only task keys and repo roots/names. Team ticket text is fetched on
demand. Keep links out of Jira, GitHub and repository history. Deleting a
local issue drops its links.

`tasksForRepo` and `repoLinks` feed the GitHub+ Tasks tab, Home counts
and linked tasks for GitHub-only repos. Tasks opens a local repo via
`openInGitHubPlus`, GitHub+ opens a task via `openInJiraPlus`, and both
handoffs stay in memory. Repository choices come from recents, linked
repos, GitHub's list when connected or a user-picked folder.
