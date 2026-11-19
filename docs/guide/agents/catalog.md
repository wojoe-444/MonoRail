---
audience: human, ai
summary: Inspect, create, edit and back up Claude Code and pi subagent templates, built-ins and the PR reviewer.
---

# Template Catalog

**Bots > Catalog** lists every reusable subagent template on this computer,
explains what each can and cannot do, and lets you create, edit, duplicate or
delete them. Templates are definitions (not running instances) and can be dropped
straight into [Flows](flows.md). To write one by hand, see
[Create an agent](create-an-agent.md).

## Where subagents come from

| Agent | Personal (every repo) | Project (shared in repo) |
| --- | --- | --- |
| Claude Code | `~/.claude/agents/*.md` (or first `CLAUDE_CONFIG_DIR`) | `<repo>/.claude/agents/*.md` |
| pi | `~/.pi/agent/agents/*.md` (or `PI_CODING_AGENT_DIR/agents`) | `<repo>/.pi/agents/*.md` |

Repo scopes follow Chat's [allowed folders](chat.md#which-chats-are-listed).
Built-in templates shipped with MonoRail:

- **Coordinator**: shown unless you define your own `coordinator.md`. Edits
  save to your active profile; **Reset to default** restores the shipped copy.
- **Storage Detective** (`storage-detective`): read-only (`Read, Grep, Glob`,
  plus MCP `storage_scan`) helper that reads your last
  [Storage](../../guide/workspace/storage.md) scan via
  [agent access](agent-access.md) and proposes a ranked cleanup plan without
  ever deleting anything. Click **Add to Claude Code** to copy it into
  `~/.claude/agents/`.

For pi, `.pi` subagents require pi's subagent extension (Catalog warns if it is
missing, and marks files lacking `name` or `description` as skipped).

## The explainer page

Selecting a template shows:

- **When it is used**: its trigger description and how to call it by name.
- **What it can do / It cannot**: tools color-coded by risk (read-only, edit
  files, run commands). Omitting a tool list inherits every tool (including
  bash).
- **Instructions & At a glance**: Markdown body, model, scope and front matter.
- **Code tab**: read-only view of the raw `.md` file (or MonoRail source for
  built-ins).

## Editing safely

- Writes stay strictly inside the allowed agent folders above; symlinks are
  never modified or deleted, and edits abort if the file changed on disk.
- Every edit or delete saves a backup to
  `%APPDATA%\MonoRail\modules\agent-catalog\backups\` (newest 200 kept).
- Unrecognized front-matter keys (`color`, `permissionMode`, etc.) are
  preserved. Built-in overrides live in `modules/agent-chat/template-overrides/`.
  Nothing is cached; files are read live on each visit.

## Pull request reviewer

The opt-in **PR reviewer** runs an OpenAI Agents SDK reviewer against a GitHub
repo (requires GitHub + OpenAI connections in
[Connections](../setup/connections.md)). While MonoRail is open, it polls every
minute for newly opened PRs (skipping existing ones and PRs opened while closed)
and posts a `COMMENT` review — never approving or requesting changes.

It reads only the PR's text patch plus ancestor `AGENTS.md` / `CLAUDE.md` files
at the base commit (no file or shell tools). Oversized/incomplete patches fail
visibly, changed heads or closed PRs skip submission, and failed runs can be
retried. Settings and run metadata stay in `modules/pr-review`; patches are sent
to OpenAI (API charges apply).

In the [MonoRail standard](../../standard/README.md), subagents are
[Subagent](../../standard/monorail/agents.md#subagent) and prompt templates are
[Prompt Template](../../standard/data-assets/ai/prompt-template.md).
