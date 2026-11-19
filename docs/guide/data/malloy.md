---
audience: human
summary: Connect a folder of Malloy models, inspect compiled sources and run queries on BigQuery via your Google login.
---

# Malloy

[Malloy](https://www.malloydata.dev) models tables as **sources** (with joins),
**dimensions**, **measures** and **views** in `.malloy` files. MonoRail compiles
them with the real Malloy compiler and runs queries on BigQuery from three tabs
on [OpenMetadata](openmetadata.md#the-tabs):

- **Semantic models**: browse every source, join and field.
- **Query builder**: pick dimensions, measures and filters to query without
  writing Malloy.
- **Malloy models**: inspect each file, compiler errors, source text and run
  views or ad-hoc queries.

Use the **Malloy / MetricFlow** switch on the first two tabs to toggle to
[MetricFlow](semantic.md).

## Nothing runs until you say so

Malloy is built into MonoRail (not a separate connection), reads nothing until
you pick a models folder, and never modifies your files:

1. **Read & compile**: pick your folder on the **Malloy models** tab. Compiling
   fetches BigQuery table schemas (free) using your **Google Cloud** login on
   [Connections](../setup/connections.md).
2. **Run queries**: requires explicitly turning on **Run queries on BigQuery**
   in Malloy **Settings** (off by default).

## Set it up

1. Connect **Google Cloud** on [Connections](../setup/connections.md) (`gcloud`
   login).
2. Open **OpenMetadata > Malloy models** and press **Choose folder** to pick
   your `.malloy` folder (subfolders included).
3. Press **Settings** on that tab to set an optional billing project, BigQuery
   location, **Run queries on BigQuery**, and a scan cap (default 1 GB). Any
   settings from an earlier version's Malloy connection are carried over
   automatically.

Models must target `bigquery` (e.g.
`source: orders is bigquery.table('project.dataset.orders')`; other backends
like DuckDB are not yet supported).

## What a query costs

Before every run, a free BigQuery dry run checks bytes scanned against your cap
(e.g. *"Scans 18.4 MB of your 1 GB limit"*). Queries exceeding the cap are
blocked before billing (add a filter or raise the cap in Malloy settings), and
BigQuery enforces the same limit. **Show SQL** never runs a query.

## Where your data goes

Queries execute in your BigQuery project as your Google account. Results stay in
memory (up to 1,000 rows) and nothing is saved to your
[data folder](../glossary.md#data-folder)
([private data stays local](../private-data.md)).

## Related

- [OpenMetadata](openmetadata.md) · [Semantic (MetricFlow)](semantic.md) ·
  [BigQuery](bigquery.md) · [Connections](../setup/connections.md) ·
  [Developer reference](../../malloy.md)
