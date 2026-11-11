---
audience: human
summary: Sign MonoRail in to Claude, GitHub, Jira, Google Cloud, pi and more, in one place.
---

# Connect your accounts

**Configure > Connections** is the one place MonoRail signs in to the
services it works with. Each connection is a card that shows whether it still
works, with a button to sign in again when it doesn't.

## Nothing runs until you add it

A connection you have not added does nothing at all: no checks, no programs
started, no network requests. Add only what you use. Checks run when you open
the page, press **Check**, or come back after signing in.

## The connections

- **Claude**: the login Claude Code uses. MonoRail also works out whether it
  is a subscription, an API key or an enterprise login, because that changes
  what your usage costs. You can correct it if it guesses wrong.
- **GitHub**: your github.com account, used by GitHub+. Uses your GitHub CLI
  login by default, or a token you paste.
- **Atlassian**: your Jira site, email and API token, used by Jira+.
- **Google Cloud**: your `gcloud` login.
- **pi**: the pi coding agent, its version and which providers it is signed
  in to, plus the models it offers by default. Add-ons under it, like the
  **Playwright browser**, let pi use your own browser tabs.
- **OpenAI**: an API key and the Codex command line tool.
- **git**: your git name and email, for a quick check that your commits will
  carry the name you expect.

## Where secrets go

Tokens you paste are encrypted for your Windows account before they are saved,
and stay on this computer. Many connections store nothing at all and use a
login you already have. See [private data stays local](private-data.md).
