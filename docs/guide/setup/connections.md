---
audience: human
summary: Manage opt-in logins and integrations for Claude, GitHub, Jira, Google Cloud, pi, Docker and data services in one place.
---

# Connect your accounts

**Settings > Connections** manages every external account or local tool MonoRail
talks to. Each [connection](../glossary.md#connection) row shows status, account,
dependent pages and last check time — click any row for full check details or
re-authentication. Broken connections also surface in **Needs attention** on
General ([Settings overview](README.md#finding-your-way-around-settings)).

## Nothing runs until you add it

Unconfigured connections run zero checks, commands or network calls
([nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)).
Checks run when you open the page, click **Check**, or finish signing in.

## The connections

- **Claude**: your Claude Code login used by [Chat](../agents/chat.md), with
  detected billing type (subscription, API key, Enterprise) for
  [Claude Stats](../agents/spend.md#subscription-or-api) and
  [spending limits](spending-limit.md). Its optional **Playwright browser**
  add-on configures terminal `claude` to use your Chrome/Edge tabs (never
  overwrites an existing server of the same name; not used by in-app Chat).
- **GitHub**: GitHub CLI login (default) or pasted token for
  [GitHub+](../workspace/browse-repos.md#your-github-repositories) and opt-in
  [issue publishing](../workspace/local-issues.md#also-on-github-if-you-want).
- **Atlassian**: Jira site, email and API token for
  [Tasks](../workspace/tasks.md#your-teams-jira).
- **Google Cloud**: `gcloud` login for [BigQuery](../data/bigquery.md) and
  [Malloy](../data/malloy.md), with an add-on for
  [BigQuery metadata](../data/openmetadata.md#feeding-the-catalog-from-bigquery).
- **pi**: detected pi version, providers, default [models](../glossary.md#model)
  and browser add-ons.
- **OpenAI**: API key and Codex CLI (also used by the PR reviewer in
  [Template Catalog](../agents/catalog.md)).
- **git**: verifies your git author name and email for
  [commits](../glossary.md#commit).
- **Docker**: optional local Docker / WSL engine and lazydocker for
  [Docker](../workspace/docker.md).
- **MetricFlow**: optional dbt project folder for
  [Semantic](../data/semantic.md) (query execution off by default).
- **OpenMetadata**: optional OpenMetadata server and bot token / login for
  [OpenMetadata](../data/openmetadata.md).

SQLite, MetricFlow and OpenMetadata carry the **Data service** badge and manage
their ingestion pipelines on [Services](../data/services.md).

## Where secrets go

Pasted tokens are encrypted for your Windows account on disk; CLI-backed
connections store no secret at all
([encryption details](../private-data.md#passwords-and-tokens-are-encrypted)).

## Agents and connections

Connected agents ([agent access](../agents/agent-access.md)) can check whether
connections are healthy, never read secrets.

## Related

- [Setup overview](README.md) · [Email sign-in](../workspace/email.md)
