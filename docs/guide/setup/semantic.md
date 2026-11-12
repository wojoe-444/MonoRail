---
audience: human
summary: Browse your dbt project's metrics and dimensions, and chart them with MetricFlow, on the Semantic page.
---

# Semantic (MetricFlow)

If your team keeps its business metrics in a [dbt](https://www.getdbt.com/)
project with a semantic layer, **Insights > Semantic** shows them: every
metric with what it means and how it is worked out, the semantic models
behind it, and the saved queries your team defined. With MetricFlow (dbt's
semantic layer engine, the `mf` command) you can also chart any metric over
time or split it by a dimension, without writing SQL.

## It is optional, twice

MonoRail does nothing about dbt or MetricFlow until you add the
**MetricFlow** connection on [Connections](connections.md). Until then the
page only says it is not set up: MonoRail does not look for dbt projects or
Python, and it never installs Python, dbt or MetricFlow. This is MonoRail's
[nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)
rule.

Adding the connection only lets MonoRail **read** the project's files.
Running queries is a second switch, **Run queries with MetricFlow**, which is
off until you turn it on.

## Set it up

1. In your dbt project, install MetricFlow with your adapter into a virtual
   environment, for example `python -m venv .venv` then
   `.venv\Scripts\pip install "dbt-metricflow[dbt-snowflake]"` (use your own
   warehouse's adapter). MonoRail looks for `mf` in the project's `.venv` or
   `venv` first, then on your PATH.
2. Run `dbt parse` (or `mf validate-configs`) once, so dbt writes
   `target/semantic_manifest.json`.
3. Open **Settings > Connections**, find **MetricFlow** and press **Set up**.
4. Enter the project folder (the one with `dbt_project.yml`). Leave **Run
   queries** off if you only want to browse. Press **Save and check**.

The check shows the project's name, how many metrics it has and when it was
parsed, the MetricFlow and dbt versions it found, and whether it found a
`profiles.yml`. It never opens `profiles.yml`, because that file holds your
warehouse password. With queries on, **Validate project** runs
`mf validate-configs` for you.

## What the page shows

- **Query**: pick one or more metrics, a time grain (day to year), the
  dimensions to group by, filters, dates, sort order and a row limit. **Run
  query** shows a chart (a line over time, or bars by dimension) with the
  table of results below it. **SQL** shows the SQL MetricFlow would run,
  without running it. The copy button gives you the same query as an
  `mf query` command for a terminal, even while queries are off.
- **Metrics**: every metric with its type (simple, ratio, cumulative,
  derived, conversion), how it is worked out, any filter, where it comes from
  (input metrics, measures, semantic models, dbt models) and every dimension
  it can be split by. **Query this metric** opens it in Query.
- **Semantic models**: each model's entities, dimensions and measures, and
  which other models it joins.
- **Saved queries**: the ones your team defined in dbt. **Open in Query**
  loads one.

After you change the dbt project, run `dbt parse` again and press **Reload
project**.

## Where your data goes

A query runs your own `mf` program in the project folder, which connects to
your warehouse with your own dbt profile, exactly as if you typed the command.
The results come back to the page and are kept only while it is open:
MetricFlow writes them to a temporary file that MonoRail deletes as soon as it
has read it. Nothing about your project or results is saved in MonoRail's data
folder. See [Private data stays local](../private-data.md).

## Let agents use it

Through MonoRail's [agent tools](../agents/agent-access.md), an agent can list
your metrics (`list_semantic_metrics`, reads files only). Running a query
(`query_semantic_metrics`) is off for every agent until you allow it for that
agent on **Settings > Agent access**, and it also needs **Run queries** on in
the connection. Every call is logged there.

## Related

- [Connect your accounts](connections.md): every connection, and how they stay
  opt-in.
- [What agents can do in MonoRail](../agents/agent-access.md).
- [Agent spend](../agents/spend.md), the other page under Insights.
- The rest of [setup](README.md).
- For developers and agents: the [Semantic reference](../../semantic.md).
