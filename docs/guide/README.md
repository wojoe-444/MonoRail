---
audience: human
folder: Guides
summary: What MonoRail is, what it is good for, and how to find your way around this wiki.
---

# Welcome to MonoRail

MonoRail is a desktop app for living with AI agents. It sits next to the
[agents](glossary.md#agent) you already use, like Claude Code and pi, and
gives you one place to see what they are doing, talk to them, keep an eye on
what they cost, and look after the work they produce.

It is not a cloud service. MonoRail runs on your computer, reads files that
are already there, and keeps what it learns there too. That idea runs through
everything; [private data stays local](private-data.md) explains it.

## What you can do with it

- **Talk to your agents.** [Chat](agents/chat.md) lists the conversations you
  have had with Claude Code and pi on this computer, and lets you carry on any
  of them. The [Coordinator](agents/coordinator.md) can even talk to your
  other chats for you.
- **Make your own helpers.** [Create an agent](agents/create-an-agent.md)
  shows how to write a subagent or a skill in a few lines of plain text.
- **Know what you spend.** [Claude Stats](agents/spend.md) charts what your
  agents cost, by day and by model.
- **Look after your work.** [GitHub+](workspace/browse-repos.md) browses the
  git repositories on your computer, with [local issues](workspace/local-issues.md);
  [Tasks](workspace/tasks.md) keeps tasks; [Email](workspace/email.md)
  reads mail. All of it is in [your workspace](workspace/README.md).
- **Let agents help themselves.** [Agent access](agents/agent-access.md) lets
  an agent read what MonoRail knows, and, only with your OK, write a few
  things back.
- **Make it yours.** [Connect your accounts](setup/connections.md), pick a
  [look](setup/appearance.md), turn on [backups](setup/backups-and-updates.md)
  and [add extensions](setup/extensions.md). [Set up and look after
  MonoRail](setup/README.md) has the whole list.

## How to read this wiki

The pages are meant to be read by following links, not by hunting through
the list on the left. Every page links to the pages around it:

- **Links in the text** go to the page that explains that idea. Hover over
  one to see what the page is about before you open it.
- **Linked from**, at the end of each page, lists the pages that point to it,
  so you can see where an idea is used.
- **The path at the top** of each page ("Wiki › Guides › Agents") takes you
  up to the section it belongs to.

If you only read one more page, read [your first ten minutes](first-ten-minutes.md).
If a word is new, the [glossary](glossary.md) explains it, and the
[questions and answers](faq.md) cover the usual surprises.

## For people, for agents

Every page is tagged with who it is written for:

- **For people**: plain-language guides like this one. You don't need to read
  code to follow them.
- **For agents**: dense reference for agents and developers, full of exact
  file names, settings and rules, like the [extension
  reference](../extensions/README.md) or [how caching works](../caching.md).
  Useful when you build something, or when you point an agent at the docs.

Some pages are both. The switch above the page list picks which ones you
see; it starts on **People**.
