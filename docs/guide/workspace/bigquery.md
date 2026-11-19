---
audience: human, ai
summary: Browse BigQuery datasets and run SQL inside MonoRail, signed in with your own Google Cloud account. Editor tabs, cost estimates before you run, results, charts and query history.
---

# BigQuery

**Tools > BigQuery** lets you work with Google BigQuery without opening the
Google Cloud console: browse projects, datasets and tables, write SQL in
tabs, see what a query will cost before you run it, and look at the
results as a table, as JSON or as a chart.

## Setting it up

BigQuery is optional. It uses the **Google Cloud** connection on
[Connections](../setup/connections.md#the-connections), which is your own
`gcloud` login. Until you add that connection, the page only shows a
"Set up Google Cloud" button and MonoRail contacts nothing, as
[nothing runs until you add it](../setup/connections.md#nothing-runs-until-you-add-it)
promises.

Queries run as you, with exactly the access your Google account has, and
are billed to the project you pick at the top of the left panel, the same as
in Google's own console.

## The left panel

- **Run queries in** picks the billing project: the project queries run in
  and are charged to.
- **Explorer** lists your starred projects and the billing project. Open a
  project to see its datasets, and a dataset to see its tables and views.
  Click a dataset or table to open it in a tab, or use the magnifier next to
  a table to start a `SELECT *` query on it. The search box filters what you
  have opened so far.
- **Star a project by name** adds any project you can read, for example
  `bigquery-public-data` for Google's public datasets.
- **History** shows your recent queries (**Personal**) or everyone's in the
  project (**Project**, if your account may see them). Open one to read the
  SQL or open it in a new tab. The history is BigQuery's own job list;
  MonoRail keeps no copy.

## Writing and running queries

- **+** opens a new query tab. Double-click a tab's name to rename it. Your
  tabs and their SQL come back the next time you open the page; they are
  kept with your other preferences on this computer, per
  [profile](../glossary.md#profile).
- While you type, the toolbar says how much data the query will read
  ("This query will process 1.2 GB when run"), or points at the mistake with
  the line number marked. Those checks are dry runs, which cost nothing.
- **Run** (Ctrl+Enter) runs the query. Select part of the text first to run
  only that part. **Stop** cancels a running query.
- **Format** (Ctrl+Shift+F) tidies the SQL: keywords in capitals, one clause
  per line. Text inside quotes and comments is left alone.
- **Settings** sets the data location, a **maximum bytes billed** limit (a
  query that would bill more fails without charge) and whether to reuse
  cached results.

## Results

Below the editor, **Query results** has five views:

- **Results**: a table, page by page, with nested records spread into
  columns. **Save results** saves the current page as CSV or JSON, or copies
  it for a spreadsheet.
- **JSON**: the same rows as JSON.
- **Job information**: job ID, times, bytes processed and billed, slot time,
  destination table.
- **Execution details**: how long each stage of the query spent waiting,
  reading, computing and writing, and how many rows went in and out.
- **Chart**: a bar or line chart of the numeric columns against any column.

## Tables and datasets

A table tab has **Schema** (every field, nested ones indented),
**Details** (size, row count, partitioning, clustering, labels, and the SQL
behind a view) and **Preview**, which reads stored rows directly without
running a query, so it is free.

## Good to know

- MonoRail only talks to Google's BigQuery service, using a short-lived
  sign-in from `gcloud` that it keeps in memory and never saves. Results are
  never written to disk. See [private data stays local](../private-data.md).
- Anything you could do in Google's console, including changing or deleting
  data with SQL, works here too, because it is your own account.
- For a dbt project's metrics, use [Semantic](../setup/semantic.md); for a
  catalog of your data, see [OpenMetadata](../openmetadata.md). More pages
  like this one are in [your workspace](README.md).

## For developers

Page `apps/command-hub/src/modules/bigquery` (sample data for the browser
dev server in `sample.ts`); backend `electron/modules/bigquery.cjs` gated on
`hasConnection('gcloud')`, token from the gcloud connector's `credentials()`
cached in memory for 30 minutes; REST client `electron/modules/bigquery-api.cjs`
(fixed URL shapes on `bigquery.googleapis.com`, ids validated, rows converted
by schema). Keeps no files; tabs live in `prefs` (`monorail.bigquery.*`).
