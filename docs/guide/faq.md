---
audience: human
summary: Quick answers to the questions people ask most, each pointing to the page with the full story.
---

# Questions and answers

## My chats don't show up in Chat

Chat only lists conversations from [allowed folders](agents/chat.md#which-chats-are-listed):
git repositories directly inside your `Repos` folder, plus any you add with
**Folders** on the Chat page. Chats that ran on the web are not stored on
your computer at all.

## Claude Stats shows less than my bill

It only counts agents that log on this computer; cloud sessions are not
included. With a subscription, the figures are what the use would have cost
at API prices. [Subscription or API?](agents/spend.md#subscription-or-api)
explains it, and the [Claude connection](setup/connections.md#the-connections)
says which kind of login you have.

## Does MonoRail send my data anywhere?

No. It keeps everything in your own [data folder](glossary.md#data-folder)
and only contacts a service when you ask it to. [What does leave your
computer](private-data.md#what-does-leave-your-computer) lists every case.

## Can I use my Claude subscription with Chat?

Yes. MonoRail runs your own installed Claude Code, signed in through
Anthropic's own sign-in, and never handles your login itself. See
[sending a message](agents/chat.md#sending-a-message).

## An agent wants to change something in MonoRail and can't

Write tools are off for every agent until you allow them, tool by tool. See
[reading is on, writing is up to you](agents/agent-access.md#reading-is-on-writing-is-up-to-you).

## The agent asked for permission and nothing happened

MonoRail says no to every permission request in [Chat](agents/chat.md) and
shows it in the conversation. Switch the chat to **Agent** mode, or ask in a
way that needs fewer tools.

## How do I make my own agent?

Write one small text file: [create an agent](agents/create-an-agent.md).

## How do I update?

MonoRail checks by itself and offers the update in a pop-up. See
[updates](setup/backups-and-updates.md#updates).

## How do I get my work back from a backup?

[Backups](../backups.md#the-global-backup-folder) has a table with the
restore steps for each kind of backup.

## The installer says "Failed to uninstall old application files"

Another program is holding a MonoRail file open. Close MonoRail and any app
that may have it open (the Claude desktop app sometimes does), then run the
installer again.

## Where are the developer docs?

Switch the filter above the page list to **Agents** or **All**. Those pages
describe exact files, settings and rules: start at [building
extensions](../extensions/README.md), [agent access in depth](../mcp.md) or
[caching](../caching.md).
