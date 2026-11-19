---
audience: human
folder: Agents
summary: Talk to your agents, create subagents and flows, track spending, and control what agents may touch.
---

# Working with agents

An [agent](../glossary.md#agent) is an AI that takes action, not just chats.
MonoRail brings your local agents together under **Bots**:

1. **[Chat with your agents](chat.md)** — browse, continue or start Claude Code
   and pi sessions in **Ask** or **Agent** mode.
2. **[Create an agent](create-an-agent.md)** — write a
   [subagent](../glossary.md#subagent) or [skill](../glossary.md#skill) in a few
   lines of Markdown.
3. **[Template Catalog](catalog.md)** — inspect, create, edit and back up
   subagent templates, built-ins and the PR reviewer.
4. **[The Coordinator](coordinator.md)** — a chat that reads and delegates to
   your other chats.
5. **[Build a flow](flows.md)** — wire agents, subagents and prompts into a
   graph on a canvas.
6. **[Keep an eye on spending](spend.md)** — track costs by day,
   [model](../glossary.md#model) and [effort](../glossary.md#effort).
7. **[Let agents use MonoRail](agent-access.md)** — connect external agents via
   MCP and approve write tools one by one.
8. **[The mochi crew](mochi-crew.md)** — the avatar characters automatically
   matched to every subagent.

Two rules apply everywhere: agents only see
[allowed folders](chat.md#which-chats-are-listed), and write actions always need
your approval ([private data stays local](../private-data.md)). New here? Start
with [your first ten minutes](../first-ten-minutes.md).

## Reusable prompts

In **Bots > Catalog > Templates > Prompts**, save prompt templates with
`{placeholder}` fields (letters, numbers, underscores; starting with a letter).
Repeated names share one input. Fill in the fields and copy the rendered prompt
into [Chat](chat.md) or elsewhere.

Every save creates a new version so earlier versions stay intact. Prompts live
in your local [profile](../../profiles.md). (Unlike [Flows](flows.md) prompt
steps, catalog prompts are filled in directly on the Prompts page.)
