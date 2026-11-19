---
audience: human
folder: Data & catalog
summary: Browse your data catalog, run ingestion pipelines, query BigQuery and SQLX, and explore Malloy or MetricFlow models.
---

# Data & catalog

MonoRail brings your data catalog, warehouse queries and semantic models into
one local workspace — without requiring a server to start.

- **[Explore](explore.md)** lists everything MonoRail knows about across the
  app (agents, notes, flashcards, tables and metrics), sorted by the
  [MonoRail standard](../../standard/README.md).
- **[OpenMetadata](openmetadata.md)** browses your catalog entities, columns,
  versions and [lineage](openmetadata.md#lineage) from MonoRail's
  [local database](../glossary.md#local-database), a BigQuery metadata dataset,
  or your own OpenMetadata server.
- **[Services & ingestion](services.md)** schedules ingestion pipelines that
  read SQLite databases, dbt projects and OpenMetadata server sources into the
  catalog.
- **[BigQuery](bigquery.md)** runs SQL in tabs with free dry-run cost
  estimates, charts and query history using your own Google Cloud login.
- **[SQLX files](sqlx.md)** edits Dataform `.sqlx` files with their config as
  structured settings, column tables and checks.
- **[Malloy](malloy.md)** is built in — pick a folder of `.malloy` models to
  compile them and run queries on BigQuery from the OpenMetadata tabs.
- **[Semantic (MetricFlow)](semantic.md)** connects a dbt project's semantic
  layer so Explore, Services and [agents](../agents/agent-access.md) can read
  and query its metrics.

Every data source is opt-in on [Connections](../setup/connections.md), and
nothing leaves your computer unless you ask
([private data stays local](../private-data.md)).
