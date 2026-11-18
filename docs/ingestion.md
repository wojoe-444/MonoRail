---
audience: ai
summary: Reference for Settings > Services: data sources as OpenMetadata services, ingestion pipelines on this PC or an OpenMetadata server, files, runners, rules.
---

# Services and ingestion pipelines

People: see the guide, [Services and ingestion pipelines](guide/setup/services.md).

MonoRail adopts OpenMetadata's model for data sources: a **service** (an
entity of a `*Service` type, e.g. `databaseService`) and its
[ingestion pipelines](standard/platform/ingestion-pipeline.md)
(`ingestionPipeline` entities: `pipelineType`, `sourceConfig.config`,
`airflowConfig.scheduleInterval`, `enabled`, `deployed`, run statuses in
`pipelineStatus` shape). Where MonoRail's older Connections model disagreed,
OpenMetadata's shape wins, except for the rules under
[Deliberate differences](#deliberate-differences).

## Files

| File | What it does |
| --- | --- |
| `electron/modules/ingestion.cjs` | Backend `ingestion`: services, local pipelines, scheduler, In-App rows, server (OpenMetadata) pipelines, Explore data |
| `electron/modules/ingestion-local.cjs` | The This PC runner: SQLite metadata and profiler (worker thread), dbt manifest; filter rules; catalog merge |
| `electron/modules/ingestion-store.cjs` | `pipelines.json`, `runs.json`, `catalog.json` in `modules/ingestion` (profile scope) |
| `electron/modules/ingestion-cron.cjs` | Cron parsing, next run, plain-language schedule |
| `electron/modules/ingestion.test.cjs` | Tests, including a real SQLite run |
| `src/modules/ingestion/` | The Services page (`/services`, Settings group "Data"), pipeline dialog, runs dialog, browser sample |

## Services and accounts

A connector in `electron/connections/connectors` that declares
`service: { category, serviceType }` is a data source; the rest are
accounts. Today: `sqlite` (`databaseService`, SQLite), `metricflow`
(`databaseService`, dbt) and `openmetadata` (`metadataService`, also the
server for server pipelines). Connections still owns them (fields, secrets,
checks); `describeConnector` passes `service` to the page, which tags those
rows "Data service". Local services get fixed OpenMetadata names
(`local_sqlite`, `local_dbt`, `LOCAL_SERVICES` in `ingestion.cjs`) because a
connection kind exists once per profile.

**Test connection** is the connection's own check (`connections.check(kind,
{ force: true })`), its details shown as OpenMetadata-style steps.

## Runners

`extension.monorail.runner` says where a pipeline runs.

**`this-pc`.** Kept in `pipelines.json`; types per service in
`LOCAL_TYPES`: SQLite `metadata` + `profiler`, MetricFlow `dbt`. Runs go
through `runLocal`; SQLite work runs in an eval'd worker thread opened
read-only (`node:sqlite` is synchronous), so Kill is `worker.terminate()`.
Only names, types and counts leave the worker. dbt reads
`target/manifest.json` (64 MB limit): models, seeds, snapshots (not
ephemeral) and sources, columns, descriptions (`dbtUpdateDescriptions`),
tags (`includeTags`) and `depends_on` lineage. Results merge into
`catalog.json` per service: `markDeletedTables` keeps vanished tables
marked `deleted`, profiles survive a metadata run. Filters follow
OpenMetadata: regex anchored at the start, case-insensitive, includes then
excludes.

The scheduler (`start(ctx)`: first tick after 20 s, then every minute) runs
only pipelines that are `deployed && enabled` with a schedule, when the cron
time after the last scheduled time (or the deploy time) has passed; missed
times run once. Failed scheduled runs retry `airflowConfig.retries` times,
`retryDelay` seconds apart. Deployed pipelines register as In-App rows
(provider `ingestion`, group "Ingestion pipelines").

**`server`.** Read live from the OpenMetadata connection through
`openmetadata.cjs`'s client (`post` was added for this). Lists services of
every category in `SERVICE_COLLECTIONS` and up to 500 pipelines
(`fields=pipelineStatuses,owners`). Actions by UUID only:
`trigger`, `deploy`, `kill`, `toggleIngestion` under
`/services/ingestionPipelines/<verb>/<id>`; runs from
`/<fqn>/pipelineStatus` (30 days); logs from `/logs/<id>/last` (last 400
lines). `serverCreate` posts a `CreateIngestionPipeline` for the server's
own service (types in `SERVER_CREATE_TYPES`; `sourceConfig.config.type`
from `SOURCE_TYPES`); dbt is left to OpenMetadata's UI because the server
must reach the dbt files. MonoRail never sends a service connection or
password to the server: server pipelines use what the server already keeps.

## Files in the data folder

Declared in `electron/cache/declared.cjs` (`DATA_FILES`, `NOT_CACHED`).
`pipelines.json` (entities), `runs.json` (newest 30 statuses per pipeline,
up to 200 log lines each, last scheduled time), `catalog.json` (names,
types, descriptions, lineage, counts; never row data). Writes are atomic and
queued; a damaged or other-version file throws and is never overwritten.

## Deliberate differences

- **No Auto Pilot.** OpenMetadata creates and deploys default pipelines when
  a service is added. MonoRail creates none and runs nothing until the user
  deploys ([private data](guide/private-data.md#nothing-runs-until-you-ask)).
- **A local runner.** OpenMetadata assumes Airflow; MonoRail must work with
  no server.
- **Secrets stay put.** Local pipelines read credentials in the main process
  through `getCredentials`; server pipelines send none.
- **The name.** Recent OpenMetadata UIs call pipelines "Agents"; MonoRail
  already has agents, so it uses the API's name.
- **Connections stays.** Data-source connections are still added on
  Connections (one place for secrets); Services lists and runs them.

## Explore

`ingestion.explore` returns added local services, local pipelines and the
catalog. Explore adds them as `databaseService`, `ingestionPipeline`,
`database`, `databaseSchema` and `table` entries with full names that start
at the service (`local_sqlite.main.main.notes`); lineage goes in a table's
`extension.lineage.upstream`.

## Related

- [Connections guide](guide/setup/connections.md) and the connector contract
  at the top of `electron/connections/index.cjs`.
- [Semantic page reference](semantic.md): the same dbt project.
- [Caching rules](caching.md) for declared files.
- [The MonoRail standard](standard/README.md).
