---
audience: human
summary: Quick answers to common questions, each linked to the full guide.
---

# Questions and answers

## My chats don't show up in Chat

Chat only lists sessions inside
[allowed folders](agents/chat.md#which-chats-are-listed): git repos directly
under `~/Repos`, plus any folders added via **Folders** in Chat. Cloud/web chats
are not stored on your computer.

## Claude Stats shows less than my bill

Claude Stats counts only local agent logs (not cloud sessions). On a monthly
subscription, numbers show API-equivalent cost. See
[Subscription or API?](agents/spend.md#subscription-or-api) and the
[Claude connection](setup/connections.md#the-connections).

## Does MonoRail send my data anywhere?

No. Everything lives in your [data folder](glossary.md#data-folder), and network
calls happen only when you ask
([what does leave your computer](private-data.md#what-does-leave-your-computer)).

## Can I use my Claude subscription with Chat?

Yes. MonoRail runs your installed Claude Code using Anthropic's own sign-in and
never handles your credentials
([sending a message](agents/chat.md#sending-a-message)).

## An agent wants to change something in MonoRail and can't

Write tools stay off until you enable them per agent and per tool in
[Agent access](agents/agent-access.md#reading-is-on-writing-is-up-to-you).

## The agent asked for permission and nothing happened

MonoRail automatically declines permission prompts in [Chat](agents/chat.md) and
shows them inline. Switch to **Agent** mode or narrow the request.

## How do I make my own agent?

Create a short Markdown file or use the Catalog form:
[create an agent](agents/create-an-agent.md).

## How do I update?

MonoRail checks automatically and notifies you when a release is ready
([updates](setup/backups-and-updates.md#updates)).

## How do I get my work back from a backup?

See the restore table in
[Backups and updates](setup/backups-and-updates.md#restoring-from-a-backup).

## The installer says "Failed to uninstall old application files"

Another process is holding a MonoRail file open (often Claude Desktop via MCP).
Close MonoRail and any connected agent app, then re-run the installer.

## Where are the developer docs?

Switch the sidebar filter to **Agents** or **All** to see technical reference
pages like [Building extensions](../extensions/README.md),
[MCP server](../mcp.md) and [Caching](../caching.md).
