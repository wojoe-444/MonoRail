---
audience: ai
summary: Reference for the Malloy connector and backend: compiling models with the Malloy compiler and running them on BigQuery, opt-in and privacy rules.
---

# Malloy connector and backend

MonoRail compiles Malloy models with `@malloydata/malloy` and runs them on
BigQuery with `@malloydata/db-bigquery`, for the
[OpenMetadata](guide/openmetadata.md#the-tabs) page's **Semantic models**,
**Query builder** and **Malloy models** tabs. People: see the guide,
[Malloy](guide/setup/malloy.md). The MetricFlow semantic layer is separate:
[semantic.md](semantic.md).

## Files

| File | What it does |
| --- | --- |
| `electron/connections/connectors/malloy.cjs` | Connector `malloy`, `parent: 'gcloud'`. Fields: `folder`, `project` (billing, optional), `location`, `run` (`off` by default), `maxScanGb` (default 1). `status()` reads the folder (file count) and `hasConnection('gcloud')`; no network. `credentials()` returns `{ folder, project, location, maxBytes, run }`, nothing secret. |
| `electron/modules/malloy-lib.cjs` | Everything, no Electron. `createMalloy({ settings, credentials, fs?, malloy?, bigquery?, authLibrary? })` returns `status`, `listModels`, `compile`, `sql`, `run`. Also `listFiles`, `resolveModel`, `problemsOf`, `startsWithSelect`. |
| `electron/modules/malloy.cjs` | Backend module `malloy`: wires the service to `getCredentials('malloy')` and `getCredentials('gcloud')`. No `start()`, no files. |
| `electron/modules/malloy.test.cjs` | Offline tests: Malloy's real compiler against a `BigQueryConnection` subclass whose schema, dry-run and run calls are stubbed. |
| `src/modules/openmetadata/tabs/semantic/malloyClient.ts` | Page client and types (`malloyCall`), with the browser dev server's sample answers. |

## Methods

| Method | Does | Network |
| --- | --- | --- |
| `status` | Folder name, `run`, whether a gcloud token is available, billing project, limits. | gcloud token only |
| `listModels` | Every `*.malloy` file: relative path, size, time, text (200 files, 512 KB each). | none |
| `compile { path }` | Loads the model and returns its outline (sources, fields with kind, type, description, file and 1-based line; joins with relationship, source, table, nested fields; named queries) or `problems`. Kept in memory while the file's time, size and token are unchanged. | BigQuery `tables.get` (schemas, free) |
| `sql { path, query }` | The SQL a query compiles to and BigQuery's dry-run `estimate.bytes`. Runs nothing. | dry run (free) |
| `run { path, query }` | Only when `run` is on. Compiles, refuses SQL that does not start with SELECT or WITH, dry-runs, refuses over `maxBytes`, then runs with `rowLimit` 1000 (`maximumBytesBilled` is set on the job too). Returns `fields` (name, type, `isMeasure`), `rows`, `totalRows`, `truncated`, `ms`. At most 2 at a time. | query (billed) |

Blocks the page shows: `not-set-up` (no Malloy connection), `no-folder` /
`no-project`, `no-gcloud`, `run-off`.

## Rules

- **Opt-in twice.** Nothing is read until the Malloy connection is added
  (`settings()` returns undefined until then and no method touches the disk);
  running is a second switch, off by default.
- **Auth.** The Google Cloud connector's `credentials()` gives a short-lived
  access token (`gcloud auth print-access-token`); it goes into a
  `google-auth-library` `OAuth2Client` passed to `BigQueryConnection` as
  `authClient`, kept in memory 30 minutes and refreshed once on a 401. It is
  never stored, logged or sent to the page; errors are redacted
  (`ya29.*`, `Bearer *`).
- **Paths.** The page names a model by its relative path; `resolveModel`
  refuses absolute paths, `..`, non-`.malloy` names and anything whose real
  path leaves the folder. Imports go through a URL reader with the same
  checks. Listing skips dot folders, `node_modules`, `target`, links and
  junctions. Nothing the page receives holds an absolute path.
- **Read-only.** MonoRail never writes model files. Results are kept in
  memory only.
- **BigQuery only.** The runtime has one connection, named `bigquery`.
  Models that name another connection fail to compile with Malloy's own
  message.
