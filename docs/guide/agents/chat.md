---
audience: human
summary: Read, continue or start Claude Code and pi conversations across your allowed repos.
---

# Chat with your agents

**Bots** (the Chat landing page) lists every Claude Code and pi conversation on
this computer — regardless of which terminal or editor started it. Open any
[chat](../glossary.md#chat) to read or continue it, or start a new one.

## Which chats are listed

Chat only shows conversations inside allowed folders:

- git [repositories](../glossary.md#repository) directly under `~/Repos`, and
- any repository added via **Folders** on the Chat page.

Chats elsewhere are never listed or opened. The same allowlist applies to the
[Coordinator](coordinator.md) and [agent access](agent-access.md). Logs are read
in place and never copied
([private data stays local](../private-data.md#what-monorail-reads-and-leaves-alone)).

## Sending a message

Type in the composer and press **Enter**. MonoRail runs your installed Claude
Code or pi binary under your own sign-in
([Claude connection](../setup/connections.md#the-connections)). Choose the mode
in the status bar:

- **Ask** (default): read and search files only. Best for questions.
- **Agent**: full Claude Code tool use under its usual permission rules.

If an agent prompts for permission, MonoRail declines automatically and shows
the request inline so nothing runs silently. **Stop** halts a reply immediately.
The status bar also sets the [model](../glossary.md#model) and
[effort](../glossary.md#effort).

## Plain or Detailed

**Plain** (default) shows the conversation cleanly. **Detailed** reveals model
reasoning and per-call cost. For trends over weeks, see
[Claude Stats](spend.md). If a
[spending limit](../setup/spending-limit.md#in-chat) is active, the status bar
displays your current usage.

## Keeping the list tidy

- Active chats appear newest first with repository and branch labels; a dot
  marks unread replies.
- Two collapsible sections sit at the bottom: **Working** (replies currently
  running from MonoRail or your phone, excluding Coordinator child turns) and
  **Settled** (read chats quiet for 2+ days; new replies pull them back up).
- Right-click any chat to mark read/unread or archive it. Scheduled-job chats
  carry a **Scheduled** tag behind a toggle.

## Side panels

- **Changes**: uncommitted edits in the chat's repo, matching
  [GitHub+](../workspace/browse-repos.md).
- **Browser**: a side-by-side web view for local previews.

## Standing instructions

Click **Prompts** in the header to append standing instructions to every new
Claude, pi or [Coordinator](coordinator.md) turn. They guide behavior without
expanding permissions.

## Subagents in a chat

When Claude delegates to a [subagent](create-an-agent.md), its tool row shows
its [mochi crew](mochi-crew.md) character so multi-agent turns stay scannable.

## Related

- [Working with agents](README.md) · [Remote access](../setup/remote-access.md)
  · [Missing chats FAQ](../faq.md#my-chats-dont-show-up-in-chat)
