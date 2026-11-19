---
audience: human
summary: Define a Claude Code or pi subagent or skill as a plain Markdown file or via the Catalog form.
---

# Create an agent

A [subagent](../glossary.md#subagent) is a focused helper with its own
instructions and tool limits that Claude Code (or pi) can delegate tasks to —
such as reviewing diffs or writing release notes. Every subagent appears in
**Bots > Catalog** with a [mochi crew](mochi-crew.md) avatar.

## Where agents live

Each subagent is one Markdown file in either scope:

- **Personal (every repo)**: `~/.claude/agents/` (or `~/.pi/agent/agents/` for pi).
- **Project-shared**: `<repo>/.claude/agents/` (or `<repo>/.pi/agents/` for pi).

MonoRail reads your home folder plus every folder
[allowed in Chat](chat.md#which-chats-are-listed).

## The easy way: Bots > Catalog

The [Template Catalog](catalog.md) explains every subagent in plain English
(tools, restrictions, trigger description) and lets you create, edit, duplicate
or delete templates safely with automatic backups.

## Write one by hand

Create a file such as `release-notes.md` in one of those folders:

```markdown
---
name: release-notes
description: Writes release notes from commits since the last tag. Use when asked for release notes or a changelog.
tools: Read, Grep, Glob, Bash
---

Write short, friendly release notes grouped into New, Improved and Fixed.
Leave out internal refactors.
```

- **name**: how you invoke it; its final word also chooses its mochi role (e.g.
  `code-reviewer` -> Reviewer).
- **description**: tells Claude *when* to delegate to it — be specific.
- **tools**: restricts capabilities. Omit to allow all tools, or list read-only
  tools (`Read, Grep, Glob`) for look-only helpers.
- **Body**: plain-language instructions after the closing `---`.

Save the file and ask for it by name in [Chat](chat.md) ("use the release-notes
agent"), or let Claude pick it automatically.

## Skills

A [skill](../glossary.md#skill) is a reusable recipe without separate tool
limits: a folder containing `SKILL.md` under `.claude/skills/` (personal or
repo) or pi's `skills` folder.

## The Coordinator is an agent too

Creating a subagent named `coordinator` overrides MonoRail's built-in
[Coordinator](coordinator.md).

## Tips

- Keep one clear job per subagent so Claude picks it reliably.
- Give read-only tasks read-only tools and test in **Ask**
  [mode](chat.md#sending-a-message) first.
- Commit project agents to git and browse them in
  [GitHub+](../workspace/browse-repos.md).
- Watch subagent costs in [Claude Stats](spend.md).
