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

Everything MonoRail keeps is in one folder:

```
%APPDATA%\MonoRail
```

Paste that into the Explorer address bar to open it. (Older installs may use
a folder with an earlier name, such as `command-hub`. MonoRail keeps using
whichever one already holds your data and never moves it.)

Inside, each page has its own subfolder: settings, caches it can rebuild, and
encrypted secrets.

## Passwords and tokens are encrypted

When you paste an API key or token into MonoRail, it is encrypted with
Windows' own protection for your user account before it is saved. If
encryption is not available, MonoRail refuses to save the secret instead of
writing it in plain text. Pages never get to see a secret once it is saved;
only the part of MonoRail that needs it reads it.

Some connections don't store anything at all: they use a login you already
have, such as the GitHub CLI or an entry in Windows Credential Manager, and
read it each time.

## What MonoRail reads, and leaves alone

- **Agent chats** are read where Claude Code and pi keep them. MonoRail does
  not copy them or keep a cache of what was said. It only keeps small flags
  per chat (read or unread, archived) and running cost totals.
- **Email** is fetched when you open it and never written to disk.
- **Your folders** are measured, browsed or backed up only when you ask.
  MonoRail never deletes, moves or renames them on its own.

## Nothing runs until you ask

Connections, account checks and tools stay off until you set them up. A fresh
MonoRail does not go looking for accounts or programs on your computer.

## What does leave your computer

Only what you ask for: a message you send to an agent goes to that agent's
provider, an issue you choose to publish goes to GitHub, a team Jira ticket is
fetched from Jira. MonoRail itself checks GitHub for new versions of the app,
and that is all.

## For the curious

The detailed rules for caches and files are in
[Caching in MonoRail](../caching.md) (written for developers).
