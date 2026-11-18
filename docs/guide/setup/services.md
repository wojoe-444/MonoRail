---
audience: human
summary: Read your data sources into a catalog on a schedule with ingestion pipelines, on this PC or on your OpenMetadata server.
---

# Services and ingestion pipelines

**Settings > Services** is where your data lives and how MonoRail learns
what is in it. It follows [OpenMetadata](../openmetadata.md), the open data
catalog MonoRail is built around:

- A **service** is one data source: a SQLite database, a dbt project, or a
  warehouse your team's OpenMetadata server knows about.
- An **ingestion pipeline** is a job that reads a service and writes what it
  finds (databases, schemas, tables, columns, row counts, lineage) into a
  catalog. It has a type, filters and a schedule.

What a pipeline reads shows up on [Explore](../explore.md) as databases,
schemas and tables, with their columns and, for profiled tables, row and null
counts.

## Services and accounts

Not every connection is a data source. Your Claude login, GitHub or Docker
are **accounts**: MonoRail signs in with them but does not catalog them.
Connections that are data sources are tagged **Data service** on
[Connections](connections.md), and those are the ones listed here. You still
add and edit them on Connections, where passwords are kept encrypted.

## Two places a pipeline can run

**On this PC.** MonoRail runs the pipeline itself, while it is open. This
needs no server. Today it can read:

| Service | Pipeline types |
| --- | --- |
| SQLite | **Metadata** (tables, views, columns) and **Profiler** (row counts, nulls and distinct values per column) |
| dbt project (the MetricFlow connection) | **dbt** (models, sources, columns, descriptions and lineage from `target/manifest.json`) |

SQLite databases are opened read-only. No row data is copied: only names,
types and counts.

**On your OpenMetadata server.** If you added your OpenMetadata server on
[Connections](connections.md), its services are listed too, with every
ingestion pipeline the server has. You can run them, deploy them, pause and
resume them, stop a running one, read their last log, and add new
Metadata, Usage, Lineage, Profiler and Auto classification pipelines. The
server keeps each service's connection and runs the pipelines on its own
Airflow, even while your PC is off. MonoRail never sends it a password.

## Add a pipeline

1. Open **Settings > Services** and pick a service.
2. Press **Add ingestion** and choose a type.
3. **Configure**: give it a name and, if you like, filters. Filters are
   regular expressions matched from the start of a name, ignoring case:
   `sales.*` includes everything starting with "sales", an exclude of
   `.*_tmp` skips names ending in "_tmp".
4. **Schedule**: pick Hourly, Every 6 hours, Daily, Weekly, your own cron
   line, or Manual only. Choose how many times a failed scheduled run is
   retried.
5. **Review** shows the pipeline as OpenMetadata stores it. Press **Deploy**
   to start its schedule, or **Save without deploying** to keep it for
   later.

**Run** starts one run now, deployed or not. **Runs and logs** shows each
run's steps with how many records were read, changed, filtered, warned
about or failed, plus the log.

## Nothing runs until you ask

Adding a data source creates no pipelines, and a pipeline only runs on its
schedule after you deploy it. **Pause** keeps a deployed pipeline but stops
its schedule. This is MonoRail's
[nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)
rule; OpenMetadata's automatic "Auto Pilot" pipelines are deliberately left
out.

Pipelines on this PC run only while MonoRail is open. A run missed while it
was closed runs once when it opens, and they are listed under
**Workspace > Scheduled > In-App** with your other background jobs.

## Where things are kept

Pipelines on this PC, their last 30 runs and what they read go into
MonoRail's [local database](../../local-database.md), a SQLite file in its data
folder on your PC (see [private data stays local](../private-data.md)). The
[OpenMetadata page](../openmetadata.md) shows all of it, as **This PC**, even
without a server. Server pipelines and their runs stay on your server and are
read when you open the page.

## Related

- [Connect your accounts](connections.md): add SQLite, MetricFlow or your
  OpenMetadata server first.
- [Semantic (MetricFlow)](semantic.md): the same dbt project, for metrics.
- [Browse your OpenMetadata server](../openmetadata.md): every entity the
  server holds.
- [Ingestion Pipeline in the standard](../../standard/platform/ingestion-pipeline.md):
  every field of a pipeline.
- For developers: [Services and ingestion pipelines reference](../../ingestion.md).
