---
audience: human
summary: One page for every kind of entity, from MonoRail's local database or your OpenMetadata server, with every field, relationship, lineage link and version.
---

# Browse your OpenMetadata server

**OpenMetadata**, the shapes icon under **Insights** in the menu, shows everything
in an [OpenMetadata](https://open-metadata.org) catalog on one page: tables,
databases and schemas, dashboards, pipelines, glossaries, tags, test cases,
users, roles and every other kind of thing OpenMetadata keeps. It shows each
one the way OpenMetadata stores it, in the same words the
[MonoRail standard](../standard/README.md) uses.

## Without a server: MonoRail's local database

You don't need a server to use the page. Until you connect one, it shows
MonoRail's own [local database](../local-database.md): a small SQLite file in
MonoRail's [data folder](glossary.md#data-folder) that keeps entities the way
OpenMetadata does. [Ingestion pipelines](setup/services.md) that run on your
PC fill it: the tables and columns of a SQLite database, row counts from a
profiler run, a dbt project's models and lineage, and the pipelines
themselves. You can edit descriptions there too; every edit is kept as a new
version. Nothing in it leaves your PC.

A new database starts empty, and connecting a SQLite database or a dbt
project does not fill it by itself: you add an ingestion pipeline first
([how](setup/services.md#add-a-pipeline)). While the page is empty, the note
at the top says what is missing: no data source connected yet, a source with
no pipeline (with an **Add ingestion** button that opens that dialog on
[Services](setup/services.md)), a pipeline that has not run, or a run that
failed.

## With your own OpenMetadata server

Connecting a server is optional, and MonoRail contacts none until you add the
**OpenMetadata** connection on [Connections](setup/connections.md). Once you
do, the page shows the server instead of the local database. There is no
switch: the page always shows one catalog, picked for you (BigQuery when
that is set up, then the server, then this PC).

### Set it up

1. Have an OpenMetadata 2.0 or 2.1 server running. On your own computer that is
   usually OpenMetadata's Docker setup, at `http://localhost:8585`.
2. In OpenMetadata, open **Settings > Bots**, pick a bot (or make one) and
   copy its token.
3. In MonoRail, open [Connections](setup/connections.md), add
   **OpenMetadata**, enter the server and paste the token. You can sign in
   with an email and password instead, if your server uses its own logins.

The token is encrypted and stays on this computer
([passwords and tokens are encrypted](private-data.md#passwords-and-tokens-are-encrypted)).
A server on another computer must use https.

## BigQuery as the source of truth

If your team keeps its metadata in BigQuery, you can make one BigQuery
dataset the source of truth: for example the `METADATA` dataset in your
`chicago-transit` project, where `chicago-transit.METADATA.entity` holds one
row per entity. Keeping that dataset up to date is up to you or your team's
pipelines. MonoRail only connects to it and reads it. The one exception: if
you use the default `METADATA` dataset and it doesn't exist yet, MonoRail
creates it for you, with empty tables.

To avoid running BigQuery queries every time you open the page, MonoRail
keeps a **copy on your PC** and reads that. The first sync downloads
everything, which is free in BigQuery because it runs no query. After that,
each sync only fetches what changed, by default once an hour while MonoRail
is open. You can also press **Sync now**, or **Full refresh** to download
everything again. When a sync finishes while the page is open, whatever
you are looking at updates by itself.

### Set it up

1. Add the **Google Cloud** connection on [Connections](setup/connections.md):
   MonoRail reads BigQuery with your own `gcloud` login.
2. Add **BigQuery metadata** under it: your project, and the dataset
   (`METADATA` unless you choose another one). If `METADATA` doesn't exist
   yet, MonoRail creates it when you save, in the location you pick (`US`
   unless you change it). Your Google account needs permission to create
   datasets in that project. You can also choose how often the copy is
   refreshed and the most a refresh may scan.
3. Open this page. It shows your BigQuery catalog by itself, and the first
   copy is made within a minute. From then on everything on the page is read
   from that copy on your PC, so it is fast and works offline; the sync only
   keeps it fresh.

If you chose another dataset and it doesn't exist yet, or is empty,
**Setup SQL** on the page shows the statements that create MonoRail's tables
in it. Run them yourself in the BigQuery console. Either way, fill the tables
from your own pipeline. The [layout reference](../bigquery-metadata.md)
describes every table and column.

Descriptions can't be edited while you look at BigQuery, because MonoRail
doesn't write to it yet. Change them in BigQuery and the next sync brings
them in. Removing the connection empties the copy on your PC. Your BigQuery
dataset stays as it is.

## The tabs

The page's sections sit as tabs in the bar at the top of the window, where
the page title would be. Each tab has its own address, so going back and
forward works, and **Guide** and **Refresh** stay on the right for every tab.

- **Home**: totals, what changed lately, and shortcuts to the other tabs.
- **Catalog**: every kind of entity, described in
  [Find your way around](#find-your-way-around) below.
- **Explore**: search and filter the data assets (tables, dashboards,
  pipelines and more) by name, type, service, owner or tag. The search looks
  through the whole catalog, however many thousands of tables it holds, and
  lists the best matches first (an exact name, then names that start with
  what you typed).
- **Lineage**: pick an asset and see its [lineage](#lineage) as a graph.
- **Semantic models** and **Query builder**: your semantic layer. By
  default they show your [Malloy](setup/malloy.md) models: every source with
  its joins and fields, and a builder that runs queries on BigQuery. A
  **Malloy / MetricFlow** switch shows your [MetricFlow](setup/semantic.md)
  project instead.
- **Metrics**: your MetricFlow metrics, with their definitions and lineage.
- **Malloy models**: each Malloy file, compiled, with any errors, its sources
  and fields, and a workbench to run its views or a query you type.
  These tabs need the Malloy or MetricFlow connection, not an OpenMetadata
  catalog.
- **Glossary**, **Classifications** and **Domains**: business terms, tags
  such as PII or Tier, and domains with their data products.
- **Data quality**: test cases and suites with their latest results.
- **Insights**: how complete the catalog is: how many assets have a
  description, an owner, a tier and tags.
- **Services**: the services the catalog reads from and their ingestion
  pipelines. To add or run pipelines, open [Services](setup/services.md).
- **Teams and users**: teams, users and roles.

Clicking an entity on any tab opens it in **Catalog** with everything about
it.

## Find your way around

In the **Catalog** tab, the list on the left has every kind of [entity](glossary.md#entity)
OpenMetadata has, in its groups (data assets, AI assets, services,
governance, ontology, data quality, teams and access, collaboration and
context, platform), with how many your server holds. Kinds with none are
greyed out but still there, so you can see what OpenMetadata could hold. A
server older than 2.1 has no ontology kinds, so those stay greyed out.

- **Overview** shows the totals, which server you are connected to, and what
  changed most recently.
- **Pick a kind** to list its entities, with their owners and tags. Type in
  the box to search every entity of that kind by name (not just the rows on
  screen), and switch on **Include deleted** to see deleted ones too.
- **Pick an entity** to see everything about it: owners, tags and domains,
  its description, every other field, its columns (for tables and the like),
  the other entities it points to, its [lineage](#lineage), its earlier
  versions, and the raw data OpenMetadata sent. For the kinds MonoRail has adopted into the standard,
  like tables and databases, each field also says what it means, with a link
  to the kind's page in the standard.

## Lineage

Lineage shows where data comes from and where it goes. Open a table (or a
dashboard, pipeline, model or other data asset) and pick the **Lineage** tab:

- **Upstream** lists what this one is made from, for example the staging
  table a report table is built on.
- **Downstream** lists what is made from it.

It starts with the direct neighbours. Pick **2 steps** or **3 steps** to follow
the chain further; each row then says how many steps away it is, and where
the link came from (dbt, a query, a pipeline). Click a row to open that
entity. If nothing is recorded, the tab says so.

Where it comes from depends on what you are looking at:

- **This PC**: a [dbt pipeline](setup/services.md) records which models are
  built from which, each time it runs.
- **Your OpenMetadata server**: whatever lineage the server keeps.
- **[BigQuery](#bigquery-as-the-source-of-truth)**: the dataset's lineage
  table. A dataset MonoRail creates for you has one. Older datasets don't, and
  the tab tells you so; the
  [layout reference](../bigquery-metadata.md#lineage-and-the-layout-versions)
  says how to add it.

[Explore](explore.md) also lists a table's neighbours. The
[layout reference](../bigquery-metadata.md#lineage-and-the-layout-versions)
and the [local database](../local-database.md#lineage) describe how lineage
is stored.

## Editing

You can change an entity's **description** (the pencil beside it). It is
saved to OpenMetadata, which keeps the old text as an earlier version, so
nothing is lost. Everything else on the page only reads. There is no pencil
while you look at [BigQuery](#bigquery-as-the-source-of-truth).

## What it sends where

The page talks only to the server in your connection, and only while it is
open. It keeps nothing of the server on your computer. With
[BigQuery](#bigquery-as-the-source-of-truth), MonoRail calls only Google's
BigQuery service, with your own login, and keeps the copy in its
[data folder](glossary.md#data-folder) on your PC. See
[private data stays local](private-data.md).

## Related

- [Explore](explore.md) lists what MonoRail itself knows, sorted the same way.
- [Services and ingestion pipelines](setup/services.md) runs, deploys and adds
  the server's ingestion pipelines, and runs pipelines on your PC too.
- [BigQuery metadata layout](../bigquery-metadata.md): the tables MonoRail
  expects in the dataset, and how the copy is kept in step.
- [The MonoRail standard](../standard/README.md) explains every kind, with all
  its fields; [Databases](../standard/data-assets/databases/README.md) is the
  one MonoRail fills itself too.
