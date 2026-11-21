---
audience: ai
summary: Architecture and compatibility rules for MonoRail’s desktop shell, agents, tools and data catalog.
folder: Developer reference
---

# Developer reference

Start with the [repository guide](../../CLAUDE.md) for commands and rules
that apply to every change. Code paths in this section are relative to
`apps/command-hub/` unless specified.

## Desktop app

- [Desktop shell](desktop-shell.md) covers module and app navigation, Settings,
  background jobs, Developer Mode, the tour and releases.
- [Design system](design-system.md) covers spacing, shared UI, charts and palette tokens.
- [Profiles](../profiles.md), [caching](../caching.md), [backups](../backups.md)
  and [Remote access](../remote-access.md) describe shared backend services.

## Agents and integrations

- [Agent Chat](agent-chat.md) covers transcript reads, Claude and pi turns,
  spending and the Coordinator.
- [Agent usage and catalog](agents.md) covers pricing, session usage,
  agent definitions and the Mochi characters.
- [Connections](connections.md) covers opt-in, credential storage and connector behavior.
- [Flows](../flows.md), [Agent access](../mcp.md) and
  [extension author docs](../extensions/README.md) cover workflow execution,
  tool consent and third-party code.

## Workspace and data

- [GitHub+ and Tasks](git-workspace.md) covers Git reads, issue storage, Jira
  compatibility and repository links.
- [Workspace tools](workspace-tools.md) covers Email, Files, Notes, Storage,
  Flashcards, BigQuery and SQLX.
- [Tracker](../tracker.md) and the [local database](../local-database.md)
  describe issue and entity storage.
- [OpenMetadata](openmetadata.md) covers catalog sources, search, lineage and
  refreshing the schema. See also the [MonoRail standard](../standard/README.md),
  [ingestion](../ingestion.md), [BigQuery metadata](../bigquery-metadata.md),
  [Malloy](../malloy.md) and [MetricFlow](../semantic.md).
