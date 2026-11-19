---
audience: human
summary: Browse every catalog entity, relationship, version and lineage graph from MonoRail's local database, BigQuery or your OpenMetadata server.
---

# OpenMetadata

**Insights > OpenMetadata** puts every entity in an
[OpenMetadata](https://open-metadata.org) catalog on one page — tables,
databases, dashboards, pipelines, glossaries, tags, test cases, users and more —
using the exact names from the [MonoRail standard](../../standard/README.md).

MonoRail automatically displays one catalog in priority order: **BigQuery
metadata** (if configured) → **OpenMetadata server** (if connected) → **This PC**
(local database).

## Without a server: MonoRail's local database

No server is required. By default the page reads MonoRail's
[local database](../../local-database.md) (a SQLite file in your
[data folder](../glossary.md#data-folder)), populated by local
[ingestion pipelines](services.md#add-a-pipeline) (SQLite metadata/profiler and
dbt models/lineage). Descriptions are editable with full version history, and
nothing leaves your PC. While empty, a banner tells you what is missing and
links straight to **Add ingestion**.

## With your own OpenMetadata server

Optional — MonoRail contacts nothing until you add **OpenMetadata** in
[Connections](../setup/connections.md):

1. Run an OpenMetadata 2.0 or 2.1 server (typically `http://localhost:8585`;
   remote servers require `https`).
2. Copy a bot token from OpenMetadata's **Settings > Bots** (or use email +
   password).
3. Add **OpenMetadata** in [Connections](../setup/connections.md) and paste the
   token ([tokens are encrypted](../private-data.md#passwords-and-tokens-are-encrypted)).

## Feeding the catalog from BigQuery

If your team stores metadata in BigQuery (e.g. `project.METADATA.entity`),
MonoRail keeps it in a SQLite database on your PC, so browsing is instant and
works offline. SQLite is the database the page reads; BigQuery only sends it
changes:

1. Add **Google Cloud** in [Connections](../setup/connections.md) (`gcloud` login).
2. Add **BigQuery metadata** underneath with your project and dataset (default
   `METADATA` — if missing, MonoRail creates empty tables for you; for custom
   datasets, run the **Setup SQL** shown on the page).
3. MonoRail reads the dataset once into SQLite for free (no query). After
   that, every sync (hourly while open, or **Sync now**) asks BigQuery only
   for rows changed since the second the last sync started. Nothing is ever
   downloaded again unless you choose **Rebuild…** and confirm it. Mark
   removed rows `deleted = TRUE` in BigQuery so the next sync carries the
   removal.

BigQuery catalogs are read-only in MonoRail (edit upstream and sync). Removing
the connection clears only the local copy, never BigQuery. See the
[BigQuery metadata reference](../../bigquery-metadata.md) for table schemas.

## The tabs

Each section lives in the top tab bar with browser history, **Guide** and
**Refresh**:

- **Home**: catalog totals, recent updates and shortcuts.
- **Catalog**: browse every entity kind ([details](#find-your-way-around)).
- **Explore**: full-catalog search and filters (name, type, service, owner,
  tag), ranked exact-match first.
- **Lineage**: interactive upstream/downstream [lineage graph](#lineage).
- **Semantic models** & **Query builder**: browse sources/fields and run
  queries using [Malloy](malloy.md) (default) or switch to
  [MetricFlow](semantic.md).
- **Metrics** / **Malloy models**: MetricFlow definitions & lineage (needs its
  connection), or compiled `.malloy` files with a query workbench (built in —
  pick your models folder on the tab). None of these tabs needs an OpenMetadata
  catalog.
- **Glossary**, **Classifications** & **Domains**: business terms, tags (PII,
  Tier) and data products.
- **Data quality** & **Insights**: test cases/suites and catalog completeness
  (descriptions, owners, tiers, tags).
- **Services** & **Teams and users**: catalog sources/pipelines (manage on
  [Services](services.md)) and users/teams/roles.

Clicking any entity opens its full view in **Catalog**.

## Find your way around

In **Catalog**, the left sidebar groups every OpenMetadata
[entity](../glossary.md#entity) kind with counts (empty kinds stay visible,
greyed out; pre-2.1 servers omit Ontology).

- **Search tables by name**: use the search box above the list from anywhere in
  Catalog to match every table (best matches first); click to open or press
  **Esc** to return.
- **Overview**: totals, active source and recent edits.
- **Pick a kind**: search all entities of that kind server-wide, optionally with
  **Include deleted**.
- **Pick an entity**: inspect owners, tags, domains, description, columns,
  relationships (long lists like a schema's tables have their own name filter),
  [lineage](#lineage), version history, raw JSON and standard field docs. A
  data asset's page shows its [downstream end products](#downstream-end-products)
  right under the header.

## Downstream end products

Every data asset's page (tables, views, dashboards, pipelines, models...) has a
**Downstream end products** card right below its owners and tags. It follows
the [lineage](#lineage) downstream to the very end and lists the assets that
nothing further is made from: usually dashboards, charts, ML models and the
last tables in a chain. Each shows its type and how many steps away it is;
click one to open it, or **See lineage** for the whole graph. Dashboards,
charts and models are listed first. With no lineage recorded, the card says
so.

## Lineage

Open any data asset's **Lineage** tab (or the top-level **Lineage** tab) to
trace upstream inputs and downstream dependents. Pick how many steps to follow
(1, 2, 3, 5, 10) or **All** to follow the lineage to its ends. A very large
lineage stops after 10,000 assets and says so. An OpenMetadata server answers
at most 3 steps per request, so deeper reads take a little longer.

- **Graph** (default): centers the asset with upstream left and downstream
  right, every asset in the column of its step, so arrows always run left to
  right. Click a **+N** badge to expand neighbours, **Collapse branch** or
  **Expand all** to adjust, drag/zoom (semantic zoom switches dots → labels →
  cards; zoomed out, the picked and selected assets stay named), or switch to
  **Layered** layout. Clicking highlights connected paths. A step with very
  many assets wraps into several side-by-side columns so the whole graph still
  fits the screen. On the top-level tab, a lineage of more than 250 assets is
  drawn with this same graph.
- **List**: flat **Upstream** / **Downstream** tables showing hop distance and
  source (dbt, query, pipeline).

Lineage comes from local [dbt pipelines](services.md), your OpenMetadata server,
or BigQuery's lineage table
([schema details](../../bigquery-metadata.md#lineage-and-the-layout-versions),
[local storage](../../local-database.md#lineage)).

## Editing

Click the pencil next to an entity's **description** to update it (saved as a
new version on local DB or OpenMetadata server; disabled on BigQuery mirrors).
All other views are read-only.

## What it sends where

Talks only to your configured OpenMetadata server (nothing cached on disk) or
Google BigQuery via your `gcloud` login (mirrored in your
[data folder](../glossary.md#data-folder)). See
[private data stays local](../private-data.md).

## Related

- [Explore](explore.md) · [Services & ingestion](services.md) ·
  [BigQuery metadata reference](../../bigquery-metadata.md) ·
  [The MonoRail standard](../../standard/README.md)
