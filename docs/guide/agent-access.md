---
audience: human
summary: Let Claude Code and other agents read what MonoRail knows, and choose what they may change.
---

# Let agents use MonoRail

MonoRail can answer questions from your agents: "what did I spend this
week?", "which of my chats are still open?", "what local issues are in this
repo?". It does this through an **MCP server**, a standard way for agents to
use outside tools.

## Connect an agent

Open **Configure > Agent access**. It shows a ready-to-copy command for
Claude Code, and a snippet for agents that use a settings file (Claude
Desktop, Cursor and most others), with the right path for your computer. Run
or paste it once; the agent starts MonoRail's server by itself when it needs
it, even when the MonoRail window is closed.

## Reading is on, writing is up to you

Every connected agent can **read**: spending summaries, your chat list
(allowed folders only), local issues, and whether your connections work.
Nothing it reads includes passwords or tokens.

**Writing** is off for every agent until you turn it on. On the Agent access
page each agent gets its own switches, one per write tool, such as "create a
local issue" or "add flashcards". An agent you have never seen before is
listed the first time it connects, with nothing allowed.

## See what happened

**Activity** on the same page lists every call: which agent, which tool,
whether it worked and how long it took. For writes it adds one line saying
what was done. It never records what was asked or answered.

## For developers

The full list of tools and how the server runs is in
[Agent access (MCP server)](../mcp.md).
