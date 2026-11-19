---
audience: human
summary: Connect a dbt project's MetricFlow semantic layer so Explore, OpenMetadata, Services and agents can browse and query metrics.
---

# Semantic (MetricFlow)

Connect a [dbt](https://www.getdbt.com/) project with a semantic layer to browse
its metrics, semantic models and saved queries on the
[OpenMetadata](openmetadata.md#the-tabs) page (**Semantic models**, **Metrics**
and **Query builder** tabs — switch from [Malloy](malloy.md) to **MetricFlow**)
and let agents query them with `mf`.

## It is optional, twice

1. **Read metadata**: off until you add **MetricFlow** in
   [Connections](../setup/connections.md)
   ([nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)).
   MonoRail never installs Python, dbt or MetricFlow.
2. **Run queries**: controlled by a second switch (**Run queries with
   MetricFlow**, off by default).

## Set it up

1. Install MetricFlow with your warehouse adapter in your dbt project's venv
   (e.g. `pip install "dbt-metricflow[dbt-snowflake]"`). MonoRail checks `.venv`
   / `venv` first, then `PATH`.
2. Run `dbt parse` (or `mf validate-configs`) to generate
   `target/semantic_manifest.json`.
3. In **Settings > Connections > MetricFlow**, enter the project folder (with
   `dbt_project.yml`), choose whether to enable queries, and press **Save and
   check**.

The check reports project name, metric count, parse time, tool versions and
whether `profiles.yml` exists (never opened, since it holds warehouse
credentials). With queries enabled, **Validate project** runs
`mf validate-configs`. Re-run `dbt parse` whenever you edit models.

## What uses the connection

- **[Explore](explore.md)**: lists semantic models, metrics and backing tables.
- **[Services](services.md)**: ingests the dbt project into the local catalog.
- **Agents**: list and optionally query metrics via MCP (below).

## Where your data goes

Queries invoke your local `mf` binary using your dbt profile. Results are read
from a temporary file that is deleted immediately — nothing is saved in your
data folder ([private data stays local](../private-data.md)).

## Let agents use it

Connected agents can call `list_semantic_metrics` (read-only) through
[agent access](../agents/agent-access.md). `query_semantic_metrics` requires
both **Run queries** enabled on the connection and per-agent approval in
**Settings > Agent access** (every call is logged).

## Related

- [Connections](../setup/connections.md) · [Agent access](../agents/agent-access.md)
  · [Claude Stats](../agents/spend.md) · [Data & catalog](README.md) ·
  [Developer reference](../../semantic.md)
