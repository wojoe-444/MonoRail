---
audience: human
summary: Read your Claude Code and pi conversations, carry them on, or start new ones.
---

# Chat with your agents

**Agents > Chat** brings the conversations you have had with Claude Code and
pi on this computer into one list, whichever terminal or editor you had them
in. Open one to read it, type to carry it on, or start a new chat.

## Which chats are listed

To keep things tidy and safe, Chat only shows conversations that took place
in folders you have allowed:

- any git repository directly inside your `Repos` folder (in your home
  folder), and
- any repository you add with **Folders** on the Chat page.

A chat from anywhere else is not listed, opened or continued. You can change
the Repos folder and add repositories at any time.

## Sending a message

Type in the box at the bottom and press Enter. MonoRail runs your own
installed copy of Claude Code (or pi) to answer, signed in the way you signed
it in. Pick the mode in the status bar under the box:

- **Ask** (the default): the agent can only read and search files in the
  chat's folder. Good for questions.
- **Agent**: the agent works as it normally does, under Claude Code's usual
  permission rules. Good for getting things done.

If the agent asks for permission to do something, MonoRail says no and shows
the request in the conversation, so nothing happens behind your back.
**Stop** ends a reply at once.

## Plain or Detailed

**Plain** (the default) shows the conversation. **Detailed** also shows the
agent's reasoning and, after each reply, what every model call cost.

## Keeping the list tidy

- A dot marks chats with something new since you last looked.
- Right-click a chat to mark it read or unread, or to archive it.
- Chats started by scheduled jobs are tagged **Scheduled** and tucked away
  behind a button, like archived ones.

## Side panels

- **Changes** shows what the agent changed in the chat's folder (the same as
  `git status` and `git diff`).
- **Browser** shows a web page next to the chat, handy for a local preview.

## The Coordinator

Pinned above the list, the **Coordinator** is a chat that can talk to your
other chats for you: read them, send them messages and wait for answers. It
follows the same rules as you (allowed folders, Ask or Agent).

## System prompts

**Prompts** in the page header lets you add your own standing instructions
for Claude, pi or the Coordinator, applied to every new turn.
