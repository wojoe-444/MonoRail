---
audience: human
summary: Where MonoRail stores your data, how secrets are encrypted, and what ever leaves your PC.
---

# Private data stays local

MonoRail follows one rule: **your private data stays on your computer**. Keys,
tokens, settings, chat history and logs live in your Windows user profile, never
in the MonoRail repository, and are never uploaded on their own.

## Where your data lives

Everything MonoRail writes goes inside one [data folder](glossary.md#data-folder):

```
%APPDATA%\MonoRail
```

Older installs may still use an earlier folder name (such as `command-hub`);
MonoRail keeps reading whichever folder already holds your data and never moves
it.

Inside, each feature has its own subfolder for settings, rebuildable caches and
encrypted secrets. `databases\` holds MonoRail's
[local database](../local-database.md) for catalog entities and
[ingestion pipelines](data/services.md). Check sizes in
[Storage](workspace/storage.md) and copy what matters with
[backups](setup/backups-and-updates.md).

## Passwords and tokens are encrypted

Secrets pasted into [Connections](setup/connections.md) are encrypted with
Windows' user-account protection before saving. If encryption is unavailable,
MonoRail refuses to save rather than writing plain text. UI pages never see a
saved secret again — only the backend that needs it reads it.

Many connections store no secret at all, reusing an existing login such as the
GitHub CLI or Windows Credential Manager.

## What MonoRail reads, and leaves alone

- **Agent chats** are read in place from Claude Code and pi;
  [Chat](agents/chat.md) stores only small per-chat flags (read/archived) and
  cost totals.
- **Email** is fetched on demand and never written to disk
  ([Email](workspace/email.md)).
- **Your folders** are never moved, renamed or deleted automatically.
  [Storage](workspace/storage.md) and [GitHub+](workspace/browse-repos.md) are
  read-only, and [Files](workspace/files.md) changes files only when you act
  (deleting only to the Recycle Bin).

## Nothing runs until you ask

[Connections](setup/connections.md), account checks and optional tools stay off
until you add them. Connected agents can read what MonoRail knows, but
[write tools stay off](agents/agent-access.md#reading-is-on-writing-is-up-to-you)
until you allow each one per agent.

## What does leave your computer

Only requests you explicitly trigger: messages sent in [Chat](agents/chat.md),
[local issues](workspace/local-issues.md) you choose to publish to GitHub, team
tickets fetched from [Jira](workspace/tasks.md), and periodic GitHub checks for
[app updates](setup/backups-and-updates.md#updates).

If you opt into [Remote access](setup/remote-access.md), only your paired phones
over private Tailscale can connect — never the public internet.
[Extensions](setup/extensions.md) can contact only the hosts you approve at
install time.

## For the curious

Exact file policies and cache contracts live in
[Caching in MonoRail](../caching.md).
