---
audience: ai
summary: MonoRail's local SQLite database: OpenMetadata entities, versions and records per profile; what uses it, schema, rules.
---

# The local database

People: the [OpenMetadata guide](guide/data/openmetadata.md#without-a-server-monorails-local-database)
explains it in plain words.

One SQLite file per [profile](profiles.md),
`<profile data folder>\databases\local.sqlite3` (folder `databases`, profile
scope in `SCOPES`; files declared in `electron/cache/declared.cjs`). It is the
home for in-app data kept in the [MonoRail standard](standard/README.md)'s
OpenMetadata shape, so the [OpenMetadata page](guide/data/openmetadata.md) can
show MonoRail's own catalog with no server.

## Engine and cost

`node:sqlite` (`DatabaseSync`), the SQLite built into the Node runtime inside
Electron (Electron 45: SQLite 3.53). Nothing is bundled, so it adds nothing
to the installer. Synchronous calls in the main process; queries are small
(a page of entities, one entity, counts). WAL mode, 5 s busy timeout.

## Files

| File | What it does |
| --- | --- |
| `electron/localdb/index.cjs` | `openDatabase(dir)`, `localDb()` (the active profile's, main process), `localDbExists()`, `fqnOf`, `stableStringify` |
| `electron/localdb/localdb.test.cjs` | Tests: versions, paging, damaged and newer files, lineage and the schema 1 to 2 step, the OpenMetadata page on it, importing older ingestion files |

## Schema (version 2, `PRAGMA user_version`)

- `entity`: `id`, `type` (an entity type of the standard), `fqn`, `name`,
  `version`, `updated_at`, `deleted`, `json` (the OpenMetadata entity);
  unique by `(type, fqn)`.
- `entity_version`: every version's JSON, keyed `(id, version)`.
- `record`: JSON documents that are not entities, keyed `(kind, owner,
  key)` with a time `at`: `pipelineStatus`, `pipelineSchedule`,
  `tableProfile`.
- `lineage` (since version 2): `from_id`, `from_type`, `to_id`, `to_type`,
  `updated_at`, `deleted`, `json`; keyed `(from_id, to_id)`, indexed on
  `to_id`. The same columns as the
  [BigQuery layout's `lineage` table](bigquery-metadata.md#lineage-and-the-layout-versions).
- `meta`: key/value (`import.ingestion`, `catalog.updatedAt.<service>`).

A schema change adds a step to `MIGRATIONS` and bumps `SCHEMA_VERSION`.
Version 1 files get the `lineage` table on the next open; their data is left
as it is. As with every schema bump, an older MonoRail then refuses the file
as "made by a newer version" and leaves it alone.

## Lineage

OpenMetadata keeps lineage as edges between entities, apart from their JSON
(its `/api/v1/lineage` API), so the local database does too. One edge per
upstream/downstream pair; `json` is OpenMetadata's EntitiesEdge
(`{ fromEntity, toEntity, lineageDetails }`, both ends EntityReferences).
Store methods: `putLineage(edge)` (checks both ends have an id and a type and
differ; unchanged content keeps its time), `putLineageExact` (the BigQuery
copy), `removeLineage`, `removeLineageOf(id)`, `lineageInto` / `lineageFrom`,
`lineageKeys`, `countLineage` and `lineageOf(id, { upstreamDepth,
downstreamDepth })`, which walks up to 3 levels each way (OpenMetadata's
limit) and returns OpenMetadata's EntityLineage shape: `{ entity, nodes,
upstreamEdges, downstreamEdges }` with edges as `{ fromEntity: id, toEntity:
id, lineageDetails }`. An end that is not stored keeps the reference the edge
carries. Deleted edges are kept (the BigQuery copy) but never walked.
[dbt ingestion](ingestion.md#runners) writes its edges here; the
[OpenMetadata page](guide/data/openmetadata.md#lineage)'s Lineage tab reads them
through `openmetadata.getLineage`.

## Updates keep your data

An update to MonoRail never resets this database or the
[OpenMetadata](guide/data/openmetadata.md) entities and [pipelines](ingestion.md) in it:

- The file stays in the [data folder](profiles.md), which the installer never
  touches (`deleteAppDataOnUninstall` is off) and MonoRail never moves.
- **Migrations only add.** A step in `MIGRATIONS` may create tables, columns
  and indexes; it never drops, renames, updates or deletes anything
  (`localdb.test.cjs` greps the steps). Data that needs a new shape is read
  in both shapes, as lineage still reads the older `extension.monorail.lineage`.
- **A copy before every upgrade.** Before an existing database with rows is
  upgraded, `openDatabase` writes a whole copy next to it,
  `local.sqlite3.before-schema-<n>.bak` (`VACUUM INTO`, so the WAL is
  included; never overwritten, a second one gets `-2`). If the copy fails,
  the upgrade does not run and the file is left as it was. An empty database
  needs no copy.
- Each step runs in one transaction with its `user_version`, so a crash
  mid-upgrade leaves the old schema and data.
- **Before the installer runs**, the global backup folder's
  [before-update backup](backups.md) includes this database (item
  `local-database`), and it is on the regular schedule too.
- Older ingestion files are imported once (`import.ingestion` in `meta`)
  and never imported again over what is in the database.
- The [BigQuery copy](#the-bigquery-copy) is different: it is refilled from
  BigQuery and emptied when its source changes. This file never is.

## Rules

- **OpenMetadata's bookkeeping.** `put(type, entity)` matches by id, then by
  type and full name; a new entity gets a UUID and version 0.1, and a real
  change (compared without `version`, `updatedAt`, `updatedBy`,
  `changeDescription`, `href`, key order ignored) adds 0.1 and keeps the old
  JSON in `entity_version`. Full names quote parts that hold a dot, as
  OpenMetadata does (`fqnOf`).
- **Never overwritten.** A file that is not a database ("damaged") or has a
  newer `user_version` is refused with a readable error and left as it is;
  `localDb()` repeats the error until restart.
- **Created on first use**, by the OpenMetadata page (local source), saving a
  pipeline, or importing older ingestion files. The ingestion scheduler and
  read-only views (Explore, Services, Scheduled) do not create it
  (`localDbExists`).
- **Never leaves the PC.** No sync, no remote. Secrets never go in it:
  connections and their secrets stay in [Connections](guide/setup/connections.md).
- **Profiles go in records, not versions.** Profiler results change every
  run, so they are `tableProfile` records (newest 30 per table) and the page
  attaches the latest to a table, as OpenMetadata keeps profiles apart from
  entity versions.

## Who uses it

- **OpenMetadata page** (`electron/modules/openmetadata.cjs`,
  `createLocalService`): the default source until the OpenMetadata
  connection is set up (the backend picks the source; the page has no
  switch). `search` runs SQL over every entity (store `search()`: each
  word in name, display name, full name, description, owners or tags; exact
  and prefix name matches first; at most 500 rows plus the total), so search
  never depends on a capped load. `setDescription` writes a new version
  locally.
- **Local ingestion pipelines** (`electron/modules/ingestion-store.cjs`,
  [reference](ingestion.md)): `ingestionPipeline` entities (`this-pc`), run
  statuses, schedule state, and the catalog as `databaseService`,
  `database`, `databaseSchema` and `table` entities with
  `extension.monorail.catalog = true`, and dbt's table-to-table lineage as
  `lineage` edges. Older versions' `pipelines.json`,
  `runs.json` and `catalog.json` are copied in once and left in place.
- **Tracker** (`electron/apps/tracker`, [reference](tracker.md)): teams and
  members as `team` and `user` entities with `extension.tracker`, and its own
  types (issues, workflow states, labels, projects, milestones, updates,
  cycles, initiatives, views, comments). Issue history is read from the
  entity versions.

## The BigQuery copy

When a BigQuery dataset is the source of truth
([BigQuery metadata](bigquery-metadata.md)), its copy is a second file with
this same schema, `databases\bigquery.sqlite3` (`mirrorDb()`,
`mirrorDbExists()`). It holds only what came from BigQuery, written with
`putExact` and `putLineageExact` (BigQuery's ids, versions and times; no
bump), and is emptied when
the source changes or the connection is removed. `local.sqlite3` is never
synced anywhere.

Other modules keep their own files for now (Notes and Tasks in git repos,
Flashcards in `decks.json`, ...). Moving one in is a separate change per
module, never automatic, and must leave the old data where it is.

## Related

- [Services and ingestion pipelines](ingestion.md)
- [BigQuery metadata](bigquery-metadata.md): BigQuery as the source of truth, read through a copy.
- [Caching rules](caching.md): declared files and the "not cached" policy.
- [Profiles](profiles.md): why the folder is per profile.
