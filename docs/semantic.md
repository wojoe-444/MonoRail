---
audience: ai
summary: Reference for the MetricFlow connector and the Semantic page: files, what it reads, what it runs, opt-in and privacy rules.
---

# Semantic page and MetricFlow connector

People: see the guide, [Semantic (MetricFlow)](guide/setup/semantic.md).

## Files

| File | What it does |
| --- | --- |
| `electron/modules/semantic-mf.cjs` | All MetricFlow code, no Electron (the [MCP server](mcp.md) uses it). Reading: `readProject` (top-level `name`, `profile`, `target-path` of `dbt_project.yml`, plain text), `readManifest` / `parseManifest` (`<target>/semantic_manifest.json`, 64 MB cap), `manifestMeta` (first 8 KB of `manifest.json` for `dbt_version` and `generated_at`), `findProfiles` (looks for `profiles.yml`, never opens it), `findMf` (the project's `.venv`/`venv`/`env`, `VIRTUAL_ENV`, then PATH, by file), `packageVersions` (`*.dist-info` folder names next to mf). Running: `queryArgs`, `runQuery`, `explainQuery`, `validateConfigs`. |
| `electron/modules/semantic.cjs` | Page backend: `getProject`, `query`, `explain`. No `start()`, keeps no files. At most 2 mf runs at a time. |
| `electron/connections/connectors/metricflow.cjs` | Connector `metricflow` on [Connections](guide/setup/connections.md). Settings `project` (absolute folder) and `run` (`off` default / `on`). `credentials()` returns `{ project, run }`. Action `validate` (`mf validate-configs --skip-dw`, only while `run` is on). |
| `src/modules/semantic/` | The page (`/semantic`, Insights): Query, Metrics, Semantic models, Saved queries. `sample.ts` is a fictional project for the browser dev server; `query.ts` builds filters and the copyable `mf query` command. |
| `electron/modules/semantic.test.cjs` | Manifest parsing, opt-in, argument checks, CSV, connector states, MCP tools. |

## Rules

- **Opt-in, twice.** Every page method reads the connection through
  `hasConnection('metricflow')` first and returns `block: 'not-set-up'`
  without touching the disk. Adding the connection allows reading files only.
  `query` and `explain` (page and MCP) refuse unless `run === 'on'`. Nothing
  installs Python, dbt or MetricFlow.
- **The check runs no program.** Versions come from dist-info folder names,
  dbt's version from the head of `manifest.json`. `profiles.yml` (warehouse
  passwords) is only looked for; a test fails if the check opens it.
- **No shell.** mf is started with `spawn(file, args, { shell: false })` in the
  project folder. On Windows only a real `mf.exe` runs (pip makes one); a
  `.cmd`/`.bat` on PATH is reported and refused. A test greps for `shell:
  true` and `exec(`.
- **Checked arguments.** Metric names must exist in the manifest, group-bys
  must be known dimensions (with an optional grain suffix), sort keys must be
  chosen metrics or group-bys, dates are `YYYY-MM-DD`, filters are single
  lines up to 2000 characters (each its own `--where`), limit 1 to 10,000.
- **Results are not kept.** mf writes `--csv` into a fresh
  `os.tmpdir()/monorail-mf-*` folder that is deleted before `runQuery`
  returns. The parsed manifest and results live in memory only; nothing goes
  in the data folder. The page never receives the project's full path, only
  its folder name.
- **Dimensions per metric** are worked out from the manifest: a semantic
  model's own dimensions through each of its entities, plus models one join
  away (whose primary or unique entity is one of its entities), intersected
  across the metric's measures. mf itself is the final word when a query runs.
- Phone ([Remote access](remote-access.md)) may call `query` and `explain`:
  they change nothing and need `run` on.

## MCP tools

`list_semantic_metrics` (read, files only) and `query_semantic_metrics`
(`consent: true`: off per agent until allowed on Agent access; also needs
`run` on; `explain: true` returns the SQL). The MCP server reads the two
settings straight from Connections' `connections.json` (no secrets there).

## Related

- [Docker](docker.md): the same optional-connector pattern.
- [Caching](caching.md): why this page caches nothing on disk.
