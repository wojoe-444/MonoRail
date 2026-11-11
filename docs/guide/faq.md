---
audience: human
summary: Quick answers to the questions people ask most.
---

# Questions and answers

## My chats don't show up in Chat

Chat only lists conversations from allowed folders: git repositories
directly inside your `Repos` folder, plus any you add with **Folders** on the
Chat page. Also check that the conversation ran on this computer; chats on
the web are not stored here.

## Claude Stats shows less than my bill

It only counts agents that log on this computer. Claude on the web and other
cloud sessions are not included. If you have a subscription, the figures are
what the use would have cost at API prices, not what you paid.

## Does MonoRail send my data anywhere?

No. It keeps everything in your own data folder and only contacts a service
when you ask it to (sending a message, publishing an issue, fetching Jira
tickets) or to check for app updates. See
[private data stays local](private-data.md).

## Can I use my Claude subscription with Chat?

Yes. MonoRail runs your own installed Claude Code, signed in through
Anthropic's own sign-in, and never handles your login itself.

## An agent wants to change something in MonoRail and can't

Write tools are off for every agent until you allow them. Open **Configure >
Agent access** and turn on the tool for that agent. See
[let agents use MonoRail](agent-access.md).

## How do I update?

MonoRail checks by itself and shows a pop-up when there is a new version.
You can also use **Settings > Check for updates**. See
[backups and updates](backups-and-updates.md).

## The installer says "Failed to uninstall old application files"

Another program is holding a MonoRail file open. Close MonoRail and any app
that may have it open (the Claude desktop app sometimes does), then run the
installer again.

## Where do I find the developer docs?

Switch the filter at the top of the wiki's page list to **For agents** or
**All**. Those pages describe exact files, settings and rules, and are the
ones to point an agent at.
