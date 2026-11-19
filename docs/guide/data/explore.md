---
audience: human
summary: Browse everything MonoRail knows in one tree, organized by the MonoRail standard with every field explained.
---

# Explore

**Explore** (under Home) lists everything MonoRail knows about across the app —
[subagents](../glossary.md#subagent), [flows](../agents/flows.md),
[notes](../workspace/notes.md), bookmarks, [flashcards](../workspace/flashcards.md),
[semantic models](semantic.md) and cataloged tables — read live from existing
data without duplicating anything.

## How it is sorted

The left tree follows the [MonoRail standard](../../standard/README.md):
MonoRail's own sections first (Agents, Workspace, Learning, Semantic, Tracker),
then OpenMetadata's categories (Databases, Dashboards, Governance, Teams &
users, Data quality and more). Each category lists its
[entity](../glossary.md#entity) types (empty types still show `0` so you can see
what fits). Prompt templates live under **AI assets**, matching OpenMetadata.

Select any field to see its value, standard definition and link to its type
page.

## Searching

Press **Ctrl+K** anywhere and type a type name (`table`, `subagent`) to jump
straight to it in Explore ([search](../search.md)). Inside Explore, the search
box matches names, field names and values across all sources; use the category
filter to narrow down, **Clear filters** to reset, or **Refresh** to reload.

## Where Databases come from

The **Databases** category uses OpenMetadata's hierarchy (`database`,
`databaseSchema`, `table`, explained in
[Databases](../../standard/data-assets/databases/README.md)):

- **[Semantic (MetricFlow)](semantic.md)**: tables referenced by your connected
  dbt semantic models.
- **[Ingestion pipelines](services.md)**: tables, views, columns, profiler row
  counts (SQLite) and dbt models/sources/[lineage](openmetadata.md#lineage) run
  locally.
- **[BigQuery metadata](openmetadata.md#bigquery-as-the-source-of-truth)**: all
  non-deleted entities from MonoRail's local mirror (sync on the OpenMetadata
  page, then press **Refresh** here).

To browse a live OpenMetadata server directly, open
[OpenMetadata](openmetadata.md). Explore is strictly read-only and never sends
data anywhere ([private data stays local](../private-data.md)).
