---
audience: human
summary: Sign MonoRail in to Claude, GitHub, Jira, Google Cloud, pi and more, in one place.
---

# Connect your accounts

**Settings > Connections** is the one place MonoRail signs in to the
services it works with. Each [connection](../glossary.md#connection) is a
row in one table: whether it still works, which account it uses, what in
MonoRail uses it and when it was last checked, with a button to sign in again
when it doesn't. Click a row to see everything the check found. A connection
that stops working is also listed on the Settings home page (see
[finding your way around Settings](README.md#finding-your-way-around-settings)).

## Nothing runs until you add it

A connection you have not added does nothing at all: no checks, no programs
started, no network requests. Add only what you use. Checks run when you open
the page, press **Check**, or come back after signing in. This is MonoRail's
[nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)
rule.

## The connections

- **Claude**: the login Claude Code uses, which [Chat](../agents/chat.md)
  runs with. MonoRail also works out whether it is a subscription, an API key
  or an enterprise login, because that changes what your usage costs in
  [Claude Stats](../agents/spend.md#subscription-or-api). You can correct it
  if it guesses wrong.
- **GitHub**: your github.com account, used by
  [GitHub+](../workspace/browse-repos.md#your-github-repositories) to list
  your repositories and, if you ask, publish
  [issues](../workspace/local-issues.md#also-on-github-if-you-want). Uses your
  GitHub CLI login by default, or a token you paste.
- **Atlassian**: your Jira site, email and API token, used by
  [Jira+](../workspace/jira-plus.md#your-teams-jira).
- **Google Cloud**: your `gcloud` login.
- **pi**: the pi coding agent, its version and which providers it is signed
  in to, plus the [models](../glossary.md#model) it offers by default.
  Add-ons under it, like the **Playwright browser**, let pi use your own
  browser tabs.
- **OpenAI**: an API key and the Codex command line tool.
- **git**: your git name and email, a quick check that your
  [commits](../glossary.md#commit) will carry the name you expect.

## Where secrets go

Tokens you paste are encrypted for your Windows account before they are
saved, and stay on this computer. Many connections store nothing at all and
use a login you already have.
[Passwords and tokens are encrypted](../private-data.md#passwords-and-tokens-are-encrypted)
explains how.

## Agents and connections

Agents connected through [agent access](../agents/agent-access.md) can see
whether each connection works, never the passwords or tokens behind it.

## Related

- The rest of [setup](README.md).
- Email has its own sign-in on its setup screen: [Email](../workspace/email.md).
