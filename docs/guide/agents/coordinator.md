---
audience: human
summary: A chat that talks to your other chats for you: reads them, sends them work, and waits for answers.
---

# The Coordinator

The **Coordinator** is pinned above the list in [Chat](chat.md). It is a
chat with one unusual skill: it can talk to your other chats. Ask it "check
on the three chats working on the website and tell me which ones are stuck",
and it reads them, sends them messages and waits for their replies.

## What it can do

- **List** your chats and **read** what was said in them.
- **Send** a message to a chat, or **start** a new one in an allowed folder.
- **Wait** for a chat to reply, then report back to you.

It cannot edit files itself. Anything it wants done, it asks another chat to
do, and that chat works under the usual rules: [allowed
folders](chat.md#which-chats-are-listed), **Ask** or **Agent**
[mode](chat.md#sending-a-message), and permission requests always declined.

## Safety rails

- It never sends work to another Coordinator chat.
- It leaves alone any chat that changed in the last minute, so it does not
  talk over you or another agent.
- Only one reply runs per chat at a time, which also stops loops.
- When the Coordinator's own reply ends, every chat it started stops too.

## Make it your own

By default the Coordinator uses MonoRail's built-in instructions. To change
how it behaves, [create an agent](create-an-agent.md) called `coordinator`;
MonoRail then uses yours. For lighter changes, add standing instructions
with **Prompts** on the Chat page ([standing instructions](chat.md#standing-instructions)).

## Other agents can ask it too

An agent connected through [agent access](agent-access.md) can ask the
Coordinator a question, if you allow that agent the `ask_coordinator` tool.
The [agent access reference](../../mcp.md#the-coordinator) has the details.

The Coordinator works with Claude only, because pi has no subagents. Its
character is the classic mochi from the app icon; see the
[mochi crew](../../mochi-crew.md).
