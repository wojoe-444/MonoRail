---
audience: human
summary: Read your Claude Code and pi conversations, carry them on, or start new ones.
---

# Chat with your agents

**Agents > Chat** brings the conversations you have had with Claude Code and
pi on this computer into one list, whichever terminal or editor you had them
in. Open one to read it, type to carry it on, or start a new
[chat](../glossary.md#chat).

## Which chats are listed

To keep things tidy and safe, Chat only shows conversations that took place
in folders you have allowed:

- any git [repository](../glossary.md#repository) directly inside your
  `Repos` folder (in your home folder), and
- any repository you add with **Folders** on the Chat page.

A chat from anywhere else is not listed, opened or continued. The same rule
covers the [Coordinator](coordinator.md) and the chat list
[other agents can read](agent-access.md). Chats are read where they are and
never copied; [private data stays local](../private-data.md#what-monorail-reads-and-leaves-alone)
says what is kept.

## Sending a message

Type in the box at the bottom and press Enter. MonoRail runs your own
installed copy of Claude Code (or pi) to answer, signed in the way you signed
it in; the [Claude connection](../setup/connections.md#the-connections) shows
which login that is. Pick the mode in the status bar under the box:

- **Ask** (the default): the agent can only read and search files in the
  chat's folder. Good for questions.
- **Agent**: the agent works as it normally does, under Claude Code's usual
  permission rules. Good for getting things done.

If the agent asks for permission to do something, MonoRail says no and shows
the request in the conversation, so nothing happens behind your back.
**Stop** ends a reply at once. The status bar also picks the
[model](../glossary.md#model) and the [effort](../glossary.md#effort).

## Plain or Detailed

**Plain** (the default) shows the conversation. **Detailed** also shows the
agent's reasoning and, after each reply, what every model call cost. For the
bigger picture over weeks, see [keep an eye on spending](spend.md). If you
turned on a [spending limit](../setup/spending-limit.md#in-chat), the status
bar also shows how much of it is used.

## Keeping the list tidy

- A dot marks chats with something new since you last looked.
- Right-click a chat to mark it read or unread, or to archive it.
- Chats started by scheduled jobs are tagged **Scheduled** and tucked away
  behind a button, like archived ones.

## Side panels

- **Changes** shows what the agent changed in the chat's folder, the same
  view [GitHub+](../workspace/browse-repos.md) gives you for a whole
  repository.
- **Browser** shows a web page next to the chat, handy for a local preview.

## Standing instructions

**Prompts** in the page header lets you add your own instructions for
Claude, pi or the [Coordinator](coordinator.md), applied to every new turn.
They change what the agent is told, never what it is allowed to do.

## Subagents in a chat

When Claude hands work to a [subagent](create-an-agent.md), the row in the
conversation shows that subagent's character from the
[mochi crew](../../mochi-crew.md), so you can follow who is doing what.

## Related

- [Working with agents](README.md) for the whole picture.
- [Use MonoRail from your phone](../setup/remote-access.md) to read and send
  chats while away from the PC.
- [Questions and answers](../faq.md#my-chats-dont-show-up-in-chat) if a chat
  is missing.
