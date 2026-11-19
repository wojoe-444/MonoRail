---
audience: human
summary: Schedule ingestion pipelines to read SQLite databases, dbt projects and OpenMetadata server sources into a catalog.
---

# Services and ingestion pipelines

**Settings > Services** manages your data sources and the jobs that catalog
them, following [OpenMetadata](openmetadata.md):

- **Service**: a data source (SQLite database, dbt project, or warehouse on an
  OpenMetadata server).
- **Ingestion pipeline**: a scheduled job that reads metadata, profiles or
  [lineage](openmetadata.md#lineage) into the catalog.

Results appear on [Explore](explore.md) and [OpenMetadata](openmetadata.md).

## Services and accounts

Only data-source connections (tagged **Data service** on
[Connections](../setup/connections.md)) appear here — accounts like Claude,
GitHub or Docker stay on Connections only. Manage credentials on Connections,
where secrets stay encrypted.

## Two places a pipeline can run

**On this PC** (runs while MonoRail is open; no server needed):

| Service | Pipeline types |
| --- | --- |
| SQLite | **Metadata** (tables, views, columns) and **Profiler** (row counts, nulls, distinct counts) |
| dbt project (MetricFlow connection) | **dbt** (models, sources, columns, descriptions and lineage from `target/manifest.json`) |

SQLite files open read-only and copy no row data — only schema and counts.

**BigQuery metadata** needs no pipeline (updated externally); it appears here
with **None needed**, sync status and **Sync now** (changes since the last
sync only).

**On your OpenMetadata server**: once connected on
[Connections](../setup/connections.md), its services and Airflow pipelines
appear here too. You can add (Metadata, Usage, Lineage, Profiler, Auto
classification), deploy, run, pause/resume, stop and read logs — MonoRail never
sends credentials to the server.

## Add a pipeline

1. Open **Settings > Services**, pick a service and press **Add ingestion**.
2. Choose a pipeline type and name. Optional regex include/exclude filters match
   from the start of a name (case-insensitive, e.g. `sales.*`, `.*_tmp`).
3. Pick a schedule (Hourly, Every 6 hours, Daily, Weekly, cron or Manual only)
   and retry count.
4. Review the OpenMetadata payload, then press **Deploy** (starts schedule) or
   **Save without deploying**.

Use **Run** for an immediate run and **Runs and logs** for step counts and
output.

## Nothing runs until you ask

Adding a source creates no pipelines, and schedules activate only once deployed
(use **Pause** to stop; OpenMetadata's automatic "Auto Pilot" is intentionally
omitted — see
[nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)).
Local pipelines run while MonoRail is open (missed runs catch up on launch) and
also appear under **Workspace > Scheduled > In-App**.

## Where things are kept

Local pipelines, their last 30 runs and cataloged entities live in MonoRail's
[local database](../../local-database.md) inside your data folder
([private data stays local](../private-data.md)). Server pipelines stay on your
server.

## Related

- [Connections](../setup/connections.md) · [Semantic (MetricFlow)](semantic.md)
  · [OpenMetadata](openmetadata.md) ·
  [Ingestion Pipeline standard](../../standard/platform/ingestion-pipeline.md) ·
  [Developer reference](../../ingestion.md)
