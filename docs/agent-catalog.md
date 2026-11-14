---
audience: human, ai
---

# Template Catalog

**Bots > Catalog** lists the reusable subagent templates on this computer,
explains each one in plain language, and lets you create, edit, duplicate and
delete them. A template is a definition, not a running subagent instance.
For what a subagent is and how to write one by hand, see
[Create an agent](guide/agents/create-an-agent.md). A [flow](flows.md) can use
any listed subagent as a step.

## Where subagents come from

| Agent | Yours (every repo) | In a repo (shared with the repo) |
| --- | --- | --- |
| Claude Code | `~/.claude/agents/*.md` (or the first `CLAUDE_CONFIG_DIR` folder) | `<repo>/.claude/agents/*.md` |
| pi | `~/.pi/agent/agents/*.md` (or `PI_CODING_AGENT_DIR/agents`) | `<repo>/.pi/agents/*.md` |

Repos are the ones allowed on the Chat page (folders under the Repos folder,
plus repos added in its Folders dialog). MonoRail's built-in coordinator is
listed while you have no `coordinator` subagent of your own. Edit changes the
template in the active MonoRail profile; Reset to default restores the shipped
definition. An existing user-level `coordinator.md` still takes precedence.

MonoRail also ships **Storage Detective** (`storage-detective`): it reads the
[Storage](storage.md) page's last scan through the MCP tool `storage_scan`
([agent access](guide/agents/agent-access.md)) and its file tools, and reports
a ranked cleanup plan with the exact command or setting for each step. Its
tools are look-only (Read, Grep, Glob and that tool), so it cannot delete or
move anything, and its instructions say every cleanup is the user's call, one
item at a time. **Add to Claude Code** saves it to
`~/.claude/agents/storage-detective.md`, where you can change it.

pi has no subagents of its own. The `.pi` files are the ones pi's **subagent
extension** reads (pi's example extension, or a package built on it); the page
warns when it cannot find one in pi's `extensions` folder or `packages` list.
pi skips a file without a `name` and a `description`, and the catalog marks
such files as skipped.

## The explainer page

Clicking a subagent opens a page that reads the file's header for you:

The **Code** tab shows the complete original Markdown file, including its
header. For built-in templates it shows the MonoRail source file containing
the definition; the PR reviewer also offers its context and watcher files.
The source view is read-only. Use Edit to change a template.

- **When Claude (or pi) uses it**: the description, and how to ask for it by name.
- **What it can do**: each tool in plain words, coloured by strength (look only,
  can edit files, can run commands), plus an **It cannot** list. A subagent with
  no tool list gets every tool of the calling chat (Claude) or pi's default
  tools, which include bash, and the page says so.
- **Its instructions**: the Markdown body.
- **At a glance**: model, who gets it, where it lives, other header fields.

## Editing safely

- Files are written only into the folders above. The page names a place as
  "just me" or an allowed repo's name, never a path, and the agents folder
  must resolve (following links) inside the home config folder or the repo.
- Before a file is changed or deleted, a copy goes to `backups/` in
  `%APPDATA%\MonoRail\modules\agent-catalog` (newest 200 kept). **Open backups
  folder** appears after a delete; restore by copying a file back.
- An edit is refused if the file changed on disk after you opened it, and a
  subagent file that is a link to another file is never changed or deleted.
- Header fields MonoRail does not edit (`color`, `permissionMode`, ...) are
  kept as they are. Renaming is done by duplicating.

Nothing from the files is cached: they are read in place on every visit.
Edits to built-in templates are saved under the profile's
`modules/agent-chat/template-overrides/`, with a backup on edit or reset.

## Pull request reviewer

The **PR reviewer** template sets up one opt-in OpenAI Agents SDK reviewer
for a GitHub repository. It needs a GitHub connection that can read the repo and
submit reviews, plus an OpenAI API key in Connections. Enabling it starts a
new watch window; existing PRs are skipped. While MonoRail is running it checks
open PRs every minute and submits a GitHub `COMMENT` review for each newly
opened one. It never approves or requests changes. PRs opened while MonoRail
is closed are not picked up on the next start.

The reviewer receives the PR's textual patch and root and ancestor `AGENTS.md`
and `CLAUDE.md` files from the base commit. It has no file or command tools;
other repository files and guidance linked from those files are not included.
Incomplete, unsupported or oversized patches fail visibly instead of being
silently reviewed in part. A changed head or a closed PR prevents submission.
The page shows outcomes and allows failed or interrupted reviews to be retried.
The settings and recent run metadata live in the active profile under
`modules/pr-review`; the generated review is posted to GitHub. The patch and
guidance are sent to OpenAI, where API usage charges apply.
