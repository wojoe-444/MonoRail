---
audience: human, ai
summary: Browse BigQuery datasets and run SQL in tabs with free cost estimates, charts and query history via your gcloud login.
---

# BigQuery

**Tools > BigQuery** lets you browse projects, datasets and tables, write SQL in
tabs with live dry-run cost estimates, and view results as tables, JSON or
charts — all using your own Google Cloud account.

## Setting it up

Add the optional **Google Cloud** connection on
[Connections](../setup/connections.md#the-connections) (`gcloud` login). Until
then MonoRail contacts nothing
([nothing runs until you add it](../setup/connections.md#nothing-runs-until-you-add-it)).
Queries run with your Google account's permissions and bill to the selected
project.

## The left panel

- **Run queries in**: selects the billing project.
- **Explorer**: lists the billing project and starred projects (use **Star a
  project by name** for others like `bigquery-public-data`). Click a table to
  inspect it or its magnifier for a starter `SELECT *`.
- **History**: BigQuery's live **Personal** or **Project** job history (never
  cached locally).

## Writing and running queries

- **+** opens a new tab (double-click to rename); open tabs persist per
  [profile](../glossary.md#profile).
- As you type, free dry runs show estimated bytes processed or highlight SQL
  syntax errors by line.
- **Run** (`Ctrl+Enter`) executes the full query or highlighted selection;
  **Stop** cancels.
- **Format** (`Ctrl+Shift+F`) formats SQL keywords and clauses (ignoring
  strings/comments).
- **Settings** configures location, **maximum bytes billed** (queries exceeding
  it fail free of charge) and result caching.

## Results

Five views below the editor: **Results** (paginated table with CSV/JSON export
and clipboard copy), **JSON**, **Job information** (job ID, bytes
processed/billed, slot time), **Execution details** (per-stage timing and row
counts), and **Chart** (bar/line chart of numeric columns).

## Tables and datasets

Table tabs show **Schema** (including nested fields), **Details** (size, rows,
partitioning, clustering, labels, view SQL) and **Preview** (free direct row
read, no query billed).

## Good to know

- Short-lived `gcloud` tokens stay in memory only and query results are never
  written to disk ([private data stays local](../private-data.md)).
- Queries run as your account, so DDL/DML statements modify real data just like
  in the Google Cloud console.
- See also [SQLX files](sqlx.md), [Malloy](malloy.md),
  [Semantic (MetricFlow)](semantic.md), [OpenMetadata](openmetadata.md) and
  [Data & catalog](README.md).

## For developers

Page `apps/command-hub/src/modules/bigquery` (browser preview in `sample.ts`);
backend `electron/modules/bigquery.cjs` gated on `hasConnection('gcloud')`
(30-min in-memory token cache); REST client `electron/modules/bigquery-api.cjs`
(fixed `bigquery.googleapis.com` URL shapes, validated IDs). No files written;
tabs stored in `prefs` (`monorail.bigquery.*`).
