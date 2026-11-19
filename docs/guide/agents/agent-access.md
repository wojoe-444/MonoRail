---
audience: human
summary: Connect Claude Code and other agents to MonoRail's MCP server and approve write tools one by one.
---

# Let agents use MonoRail

MonoRail includes a built-in [MCP](../glossary.md#mcp) server so external agents
can query what MonoRail knows ("what did I spend this week?", "which local
issues are open?") and, with your approval, take limited actions.

## Connect an agent

Open **Settings > Agent access** for a copy-paste command for Claude Code or a
JSON snippet for Claude Desktop, Cursor and other MCP clients. Once configured,
the agent launches MonoRail's server on demand — even when the MonoRail window
is closed.

## Reading is on, writing is up to you

- **Read tools** are enabled automatically: [spending](spend.md) summaries,
  [Chat](chat.md) sessions (allowed folders only),
  [local issues](../workspace/local-issues.md), [Tasks](../workspace/tasks.md),
  [dbt metrics](../data/semantic.md) and
  [connection](../setup/connections.md) status. Passwords and tokens are never
  exposed.
- **Write tools** start off for every agent. Toggle each tool individually per
  agent — e.g. creating local issues, adding
  [flashcards](../workspace/flashcards.md), asking the
  [Coordinator](coordinator.md), or running warehouse
  [metrics queries](../data/semantic.md#let-agents-use-it). First-time agents
  appear with everything off
  ([nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)).

## See what happened

The **Activity** log lists every call (agent, tool, outcome, duration, plus a
one-line summary for writes) without storing prompt or response bodies.

## Extensions add tools

Tools contributed by an [extension](../setup/extensions.md) always require your
per-agent approval, whether read or write.

## For developers

Full tool list, config paths and server internals:
[Agent access (MCP server)](../../mcp.md).
