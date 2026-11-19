---
audience: human
summary: Connect a folder of Malloy models, browse their sources and run their queries on BigQuery with your own Google login.
---

# Malloy

[Malloy](https://www.malloydata.dev) is a language for describing data: you
write **sources** (a table plus its joins), **dimensions** (values to group
by), **measures** (sums, counts, averages) and **views** (saved queries) in
`.malloy` files. MonoRail compiles those files with the real Malloy compiler
and runs their queries on BigQuery.

You use it on the [OpenMetadata](../openmetadata.md#the-tabs) page:

- **Semantic models** lists every source in your models, with its joins and
  fields.
- **Query builder** lets you pick dimensions and measures, add filters and
  run the query, without writing Malloy.
- **Malloy models** shows each file with the compiler's errors, its sources
  and its source text, and lets you run its views or a query you type.

The **Malloy / MetricFlow** switch on the first two tabs goes back to your
[MetricFlow](semantic.md) semantic layer, if you use that too.

## It is optional, twice

MonoRail reads nothing until you add the **Malloy** connection on
[Connections](connections.md). It is an add-on of **Google Cloud**, because it
uses your own `gcloud` login, so set that up first. MonoRail never installs
anything and never changes your model files.

Adding the connection lets MonoRail **compile** your models and show the SQL a
query would run. Compiling reads table schemas from BigQuery, which is free.
**Running** queries is a second switch, **Run queries on BigQuery**, which is
off until you turn it on.

## Set it up

1. Set up the **Google Cloud** connection on [Connections](connections.md)
   and sign in.
2. Under it, add **Malloy**:
   - **Models folder**: the folder with your `.malloy` files. Subfolders are
     read too.
   - **Bill queries to**: the Google Cloud project that pays for queries.
     Leave it empty to use the project set in `gcloud`.
   - **BigQuery location**: optional, for example `US` or `EU`.
   - **Run queries on BigQuery**: leave it off if you only want to browse.
   - **Most a query may scan**: 1 GB unless you change it.
3. Press **Save and check**. The check says how many Malloy files it found.

Your models must use the `bigquery` connection, for example
`source: orders is bigquery.table('my-project.shop.orders')`. Other
databases, such as DuckDB, are not supported yet.

## What a query costs

BigQuery bills by the data a query scans. Before every run, MonoRail asks
BigQuery for a free estimate (a dry run) and shows it, for example "Scans
18.4 MB of your 1 GB limit". A query that would scan more than your limit
does not run; add a filter or raise the limit on the connection. BigQuery
enforces the limit as well. **Show SQL** never runs anything.

## Where your data goes

Queries run in your own BigQuery project with your own Google login, exactly
as if you ran them in the BigQuery console. Results go to the page and are
kept only while it is open, at most 1,000 rows. Nothing about your models or
results is saved in MonoRail's [data folder](../glossary.md#data-folder). See
[Private data stays local](../private-data.md).

## Related

- [OpenMetadata](../openmetadata.md): the page with the Malloy tabs.
- [Semantic (MetricFlow)](semantic.md): the other semantic layer MonoRail
  reads.
- [BigQuery](../workspace/bigquery.md): MonoRail's BigQuery console, which
  uses the same Google login.
- [Connect your accounts](connections.md).
- For developers and agents: the [Malloy reference](../../malloy.md).
