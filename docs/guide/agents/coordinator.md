---
audience: human
summary: A pinned chat that reads your other chats, delegates work to them, and reports back.
---

# The Coordinator

Pinned at the top of [Chat](chat.md), the **Coordinator** is a chat that can
talk to your other chats. Ask it to check on three active threads and report
which are stuck — it reads them, sends follow-ups and waits for replies.

## What it can do

- **List** and **read** your other chats.
- **Send** messages to existing chats or **start** new ones in allowed folders.
- **Wait** for replies and summarize results back to you.

It cannot edit files directly. All work is delegated to ordinary chats under the
same rules: [allowed folders](chat.md#which-chats-are-listed), **Ask** / **Agent**
[mode](chat.md#sending-a-message), and automatic permission declines.

## Safety rails

- Never messages another Coordinator chat.
- Skips chats modified in the last minute so it won't talk over you.
- Runs at most one active reply per chat (prevents loops).
- Stopping the Coordinator immediately stops every child chat it launched.

## Make it your own

Override the built-in instructions by [creating an agent](create-an-agent.md)
named `coordinator` (or editing it in the [Template Catalog](catalog.md)). For
quick tweaks, use Chat's **Prompts**
([standing instructions](chat.md#standing-instructions)).

## Other agents can ask it too

External agents connected via [agent access](agent-access.md) can query the
Coordinator if you allow the `ask_coordinator` tool
([MCP reference](../../mcp.md#the-coordinator)).

Claude only (pi has no built-in subagents). Its avatar is the classic sage
[mochi](mochi-crew.md).
