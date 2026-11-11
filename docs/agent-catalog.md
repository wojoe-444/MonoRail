---
audience: human, ai
---

# Agent Catalog

**Agents > Catalog** lists every subagent on this computer, explains each one
in plain language, and lets you create, edit, duplicate and delete them.
For what a subagent is and how to write one by hand, see
[Create an agent](guide/agents/create-an-agent.md).

## Where subagents come from

| Agent | Yours (every repo) | In a repo (shared with the repo) |
| --- | --- | --- |
| Claude Code | `~/.claude/agents/*.md` (or the first `CLAUDE_CONFIG_DIR` folder) | `<repo>/.claude/agents/*.md` |
| pi | `~/.pi/agent/agents/*.md` (or `PI_CODING_AGENT_DIR/agents`) | `<repo>/.pi/agents/*.md` |

Repos are the ones allowed on the Chat page (folders under the Repos folder,
plus repos added in its Folders dialog). MonoRail's built-in coordinator is
listed too, read-only, while you have no `coordinator` subagent of your own;
**Make my own copy** saves an editable copy to `~/.claude/agents/coordinator.md`,
which the Coordinator then uses instead.

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
