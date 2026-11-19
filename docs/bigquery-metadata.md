---
audience: ai
summary: BigQuery as the source of truth for MonoRail's metadata: the dataset layout, the connection, the copy on this PC, how it syncs, rules.
---

# BigQuery metadata

People: the [OpenMetadata guide](guide/openmetadata.md#bigquery-as-the-source-of-truth)
explains it in plain words.

A BigQuery dataset can be the source of truth for the
[OpenMetadata page](guide/openmetadata.md). Something outside MonoRail keeps
the dataset up to date. MonoRail **connects and reads**: for this source,
ingestion means connecting. It keeps a copy in SQLite on this PC and every
read goes to the copy, so browsing never runs a BigQuery query.

Writing back (create, update, delete on the source of truth) is a later goal.
The layout is MonoRail's own so that such writes will be plain DML with a
version check. Today MonoRail writes to BigQuery only to
[create the default dataset](#creating-the-default-dataset) when it does not
exist yet.

## The layout (`monorail.metadata/1`)

The [local database](local-database.md)'s tables as BigQuery tables, in one
dataset (default name `METADATA`, case-sensitive). Every `json` column holds an
entity (or record) as OpenMetadata's API returns it: owners, tags, domains
and columns inside, field names and meanings as in the
[MonoRail standard](standard/README.md). This is not OpenMetadata's own
MySQL/Postgres schema (`table_entity` plus `entity_relationship` and
`tag_usage`), which strips relationships out of the JSON.

| Table | Columns | Needed |
| --- | --- | --- |
| `entity` | `id` STRING, `type` STRING (entity type as OpenMetadata spells it), `fqn` STRING, `name` STRING, `version` FLOAT64, `updated_at` TIMESTAMP, `deleted` BOOL, `json` JSON | yes |
| `meta` | `key` STRING, `value` STRING; a row `layout` = `monorail.metadata/1` | yes |
| `entity_version` | `id`, `version`, `updated_at`, `json`: every version of every entity | no |
| `record` | `kind`, `owner` (entity id), `key`, `at` TIMESTAMP, `json`: non-entities such as `tableProfile` | no |

`version` may also be NUMERIC or INT64; `json` may be STRING holding JSON.
Partition `entity` and `entity_version` on `DATE(updated_at)` and `record` on
``DATE(`at`)`` (`at` is a reserved word in BigQuery, so it is quoted). Without partitioning, each incremental sync scans the whole
`json` column. `setupSql(project, dataset, location)` in
`electron/localdb/bigquery-mirror.cjs` returns the DDL: every statement `IF NOT
EXISTS`, and the layout row inserted only when missing, so it is safe to run
again. The page shows it under **Setup SQL**. MonoRail runs it itself only
for the default dataset (below); for any other dataset the user runs it.

A dataset is accepted only when `entity` and `meta` exist with the columns
above and `meta` has the layout row. A dataset that holds other tables is
reported as foreign. A newer layout number is refused.

## Creating the default dataset

When the dataset is the default `METADATA` and it does not exist, or exists
with no tables at all, MonoRail creates it: `ensureDataset()` runs
`setupSql()` as one script job in the billing project, at the connection's
location (default `US`; an existing dataset keeps its own). That makes the
dataset, the four empty layout tables and the `meta` layout row. DDL is not
billed; the layout row's `NOT EXISTS` check reads the empty `meta` table.
It runs from the connection's `afterSave` (right after saving; a failure never
refuses the save) and at the start of every sync. A refused create fails the
sync with `create-failed` and says the account needs permission to create
datasets. Any other dataset name, and a `METADATA` that already holds tables
(foreign or not), is never created or changed.

## Files

| File | What it does |
| --- | --- |
| `electron/localdb/bigquery-mirror.cjs` | Layout, `configOf`, `setupSql`, `inspectDataset` (metadata only), `syncMirror`, `gcloudClient`. No Electron |
| `electron/localdb/index.cjs` | `mirrorDb()` / `mirrorDbExists()`: the copy, `databases/bigquery.sqlite3`, same schema as `local.sqlite3`; `putExact`, `putVersionExact`, `clearAll` |
| `electron/modules/openmetadata-bigquery.cjs` | `createBigQuerySource`: status, `sync` (one at a time), the schedule `tick`, the Scheduled > In-App row |
| `electron/modules/openmetadata.cjs` | Source `bigquery` (read-only), `syncBigQuery`, `bigquerySetupSql`, `start()` |
| `electron/connections/connectors/bigquery-metadata.cjs` | The connection, a subconnector of Google Cloud |
| `electron/localdb/bigquery-mirror.test.cjs` | Tests with an in-memory BigQuery |
| `src/modules/openmetadata/BigQueryNote.tsx` | Sync state, Sync now, Full refresh, Setup SQL |

## The connection

**BigQuery metadata** (`bigquery-metadata`, `parent: 'gcloud'`) on
[Connections](guide/setup/connections.md): project, dataset (default
`METADATA`), the location for a new `METADATA` dataset (default `US`), an
optional project to bill sync queries to, how often to
refresh (15 minutes, hourly (default), 6 hours, daily, manual) and the most an
incremental refresh may scan (1 (default), 10 or 100 GB). It signs in with
the Google Cloud connection's `gcloud` login (`credentials()`), so it needs
Google Cloud set up first. Its check reads only metadata: the dataset, the
table list and schemas, and `meta` through `tabledata.list`. No query runs
and nothing is billed; a missing `METADATA` is reported as "MonoRail creates
it". `afterSave` creates it ([above](#creating-the-default-dataset)).
`afterRemove` empties the copy; the dataset is never touched. Opt-in like every connector: nothing runs before it is added.

## The copy and the sync

`bigquery.sqlite3` sits next to the local database in the profile's
`databases` folder, so BigQuery's entities and This PC's never mix. Rows go
in exactly as BigQuery has them (id, version, `updatedAt`); `put()` is not
used, so no version is bumped. Sync state lives in the copy's `meta`:
`bq.source` (`project.dataset`), `bq.layout`, `bq.watermark.<table>` (ms) and
`bq.last` (the last result or error).

- **Full**: every table through `tabledata.list`, which runs no query, so
  BigQuery bills nothing. Runs the first time, when `bq.source` or the layout
  changed (the copy is emptied first), and on Full refresh. Duplicate ids keep
  the newest `updated_at`; ids no longer in BigQuery are removed at the end,
  so the copy stays readable while it runs.
- **Incremental**: per table, `SELECT ... WHERE <time> >= TIMESTAMP_MILLIS(watermark - 10 min)`
  (the overlap catches late writers; applying a row twice changes nothing).
  `entity` deduplicates with `QUALIFY ROW_NUMBER()`. Every query is dry-run
  first; when the sum is over the limit nothing runs (`over-cap`). Queries run
  in the billing project at the dataset's location with `maximumBytesBilled`.
- **Removals**: when the copy has more entities than BigQuery's `numRows` plus
  streaming rows (free table metadata), BigQuery's ids are listed with
  `tabledata.list` (`id` only, free) and the rest leave the copy. Duplicate
  ids in BigQuery can hide a removal until the next Full refresh.
- **Schedule**: `start()` ticks every minute (first after 30 s). A sync is due
  at once for a dataset not yet copied, then after the chosen interval; a
  failure retries after 15 minutes (or sooner on a 15-minute interval).
  Manual never runs by itself. One sync runs at a time; Sync now joins a
  running one. It shows on Scheduled > In-App (provider `openmetadata`).

## On Explore

[Explore](guide/explore.md#where-databases-come-from) lists the copy's
entities next to its other sources: `openmetadata.explore` returns every
entity that is not deleted (`everything()` in the store, by type and full
name, at most 5,000, with `truncated` and `total`), and the page makes each
one an entry of its standard type (types the standard lacks are skipped). It
only reads the copy: it never syncs and never creates the copy file, so
nothing shows before the first sync.

## On the Services page

The connector declares `service: { category: 'metadataService', serviceType:
'BigQuery' }`. `BigQuery` is a
[metadata service type MonoRail adds](standard/platform/metadata-service.md#service-types)
to OpenMetadata's list. It is a [connect-only service](ingestion.md#services-and-accounts)
(`bigquery_metadata`) on the
[Services page](guide/setup/services.md): no pipelines, the copy's size and
freshness, Sync now and Full refresh (`ingestion.syncConnected`, which runs
the same shared sync as the OpenMetadata page).

## The page

While the connection is set up, `bigquery` is the page's default source,
before the server and the local database. A saved choice of BigQuery falls
back to the default once the connection is gone. The header switch offers
This PC, BigQuery and Server (each only when available). The copy is read
through the same `createLocalService` as the local database, with
`setDescription` refused: MonoRail does not write to the source of truth yet,
and editing the copy would drift from BigQuery. The pencil is hidden
(`canEdit()` in `api.ts`).

## Related

- [Local database](local-database.md): the schema the copy shares.
- [BigQuery console](guide/workspace/bigquery.md): the same `gcloud` login.
- [Services and ingestion pipelines](ingestion.md): pipelines that fill This
  PC's catalog.
- [Caching rules](caching.md): `bigquery.sqlite3` is a declared data file.
