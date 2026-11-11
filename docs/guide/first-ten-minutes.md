---
audience: human
summary: A short tour of the pages worth opening first, and what to set up on day one.
---

# Your first ten minutes

A tour of the handful of things worth doing on day one. None of them is
required: MonoRail works without any setup and only does more once you ask
it to, because [nothing runs until you ask](private-data.md#nothing-runs-until-you-ask).

## 1. Pick a look

Open **Settings > Appearance** and choose a color scheme and light or dark
mode. [Make it look right](setup/appearance.md) shows the choices.

## 2. Open Chat

Go to **Agents > Chat**. If you have used Claude Code or pi on this computer,
your recent conversations are listed on the left.

The first time, the list may be empty: Chat only shows chats from
[allowed folders](agents/chat.md#which-chats-are-listed). By default that is
any git [repository](glossary.md#repository) directly inside the `Repos`
folder in your home folder. [Chat with your agents](agents/chat.md) covers the
rest, including the difference between **Ask** and **Agent** mode.

## 3. Connect the accounts you use

**Configure > Connections** is where MonoRail signs in to things: your Claude
login, GitHub, Jira, Google Cloud, pi and more. Add only the ones you use;
[connect your accounts](setup/connections.md) explains each one, and
[private data stays local](private-data.md#passwords-and-tokens-are-encrypted)
explains what happens to the passwords.

## 4. Look at your spending

**Insights > Claude Stats** reads the usage logs your agents already keep and
charts them. [Keep an eye on spending](agents/spend.md) explains the charts
and the one number worth watching.

## 5. Open a repository

**Workspace > GitHub+** opens any git repository on your computer in a
GitHub-style view. Try one you know: [browse your repos](workspace/browse-repos.md).

## 6. Turn on backups

**Settings > Backups** copies your local work to a folder of your choice, for
example one OneDrive already syncs. It takes a minute:
[backups and updates](setup/backups-and-updates.md).

## Where next

- Make a helper of your own: [create an agent](agents/create-an-agent.md).
- Let Claude Code use what MonoRail knows: [agent access](agents/agent-access.md).
- Everything else, by area: [agents](agents/README.md),
  [your workspace](workspace/README.md) and [setup](setup/README.md).
