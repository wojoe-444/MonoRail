---
audience: human
summary: Let Claude Code and other agents read what MonoRail knows, and choose what they may change.
---

# Let agents use MonoRail

MonoRail can answer questions from your agents: "what did I spend this
week?", "which of my chats are still open?", "what local issues are in this
repo?". It does this through an [MCP](../glossary.md#mcp) server, a standard
way for agents to use outside tools.

## Connect an agent

Open **Settings > Agent access**. It shows a ready-to-copy command for
Claude Code, and a snippet for agents that use a settings file (Claude
Desktop, Cursor and most others), with the right path for your computer. Run
or paste it once; the agent starts MonoRail's server by itself when it needs
it, even when the MonoRail window is closed.

## Reading is on, writing is up to you

Every connected agent can **read**: [spending](spend.md) summaries, your
[chat list](chat.md) (allowed folders only),
[local issues](../workspace/local-issues.md) and [Jira+](../workspace/jira-plus.md)
tasks, and whether your [connections](../setup/connections.md) work. Nothing
it reads includes passwords or tokens.

**Writing** is off for every agent until you turn it on. On the Agent access
page each agent gets its own switches, one per write tool, such as "create a
local issue", "add [flashcards](../../flashcards.md)" or "ask the
[Coordinator](coordinator.md)". An agent you have never seen before is listed
the first time it connects, with nothing allowed. That is the same
[nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)
rule as everywhere else.

## See what happened

**Activity** on the same page lists every call: which agent, which tool,
whether it worked and how long it took. For writes it adds one line saying
what was done. It never records what was asked or answered.

## Extensions add tools

An [extension](../setup/extensions.md) may offer tools of its own. Those
always need your OK, per agent, whether they read or write.

## For developers

The full list of tools and how the server runs is in
[Agent access (MCP server)](../../mcp.md).
