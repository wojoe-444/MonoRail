---
audience: human
summary: What MonoRail keeps, where it keeps it, and what it never sends anywhere.
---

# Private data stays local

MonoRail is built around one rule: **your private data stays on your
computer**. Keys, tokens, settings, chat history and logs live in a folder in
your Windows user profile, never in the MonoRail repository, and MonoRail
does not upload them anywhere.

## Where your data lives

Everything MonoRail keeps is in one folder, its [data
folder](glossary.md#data-folder):

```
%APPDATA%\MonoRail
```

Paste that into the Explorer address bar to open it. Older installs may use a
folder with an earlier name, such as `command-hub`; MonoRail keeps using
whichever one already holds your data and never moves it.

Inside, each page has its own subfolder: settings, caches it can rebuild, and
encrypted secrets. [Storage](../storage.md) shows how big it has grown, and
[backups](setup/backups-and-updates.md) can copy the parts worth keeping.

## Passwords and tokens are encrypted

When you paste an API key or token into [Connections](setup/connections.md),
it is encrypted with Windows' own protection for your user account before it
is saved. If encryption is not available, MonoRail refuses to save the secret
instead of writing it in plain text. Pages never see a secret once it is
saved; only the part of MonoRail that needs it reads it.

Some connections store nothing at all: they use a login you already have,
such as the GitHub CLI or an entry in Windows Credential Manager, and read it
each time.

## What MonoRail reads, and leaves alone

- **Agent chats** are read where Claude Code and pi keep them.
  [Chat](agents/chat.md) does not copy them or keep a cache of what was said.
  It only keeps small flags per chat (read or unread, archived) and running
  cost totals.
- **Email** is fetched when you open it and never written to disk; see
  [Email](workspace/email.md).
- **Your folders** are measured, browsed or backed up only when you ask.
  MonoRail never deletes, moves or renames them on its own. That is why
  [Storage](../storage.md) only looks and [GitHub+](workspace/browse-repos.md)
  only reads.

## Nothing runs until you ask

[Connections](setup/connections.md), account checks and tools stay off until
you set them up. A fresh MonoRail does not go looking for accounts or
programs on your computer. Agents get the same treatment: an agent that
connects to MonoRail can read, but [may write nothing](agents/agent-access.md#reading-is-on-writing-is-up-to-you)
until you allow it, tool by tool.

## What does leave your computer

Only what you ask for: a message you send in [Chat](agents/chat.md) goes to
that agent's provider, an issue you choose to publish goes to GitHub (see
[local issues](workspace/local-issues.md)), a team ticket is fetched from
[Jira](workspace/jira-plus.md). MonoRail itself checks GitHub for [new
versions](setup/backups-and-updates.md#updates) of the app, and that is all.

An [extension](setup/extensions.md) can only reach the websites you approved
when you installed it.

## For the curious

The exact rules for caches and files are in [Caching in
MonoRail](../caching.md), written for developers and agents.
