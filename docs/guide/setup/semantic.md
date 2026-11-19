---
audience: human
summary: Connect your dbt project's semantic layer and MetricFlow, so Explore, Services and your agents can read its metrics.
---

# Semantic (MetricFlow)

If your team keeps its business metrics in a [dbt](https://www.getdbt.com/)
project with a semantic layer, you can connect it to MonoRail. MonoRail reads
its metrics, semantic models and saved queries, and with MetricFlow (dbt's
semantic layer engine, the `mf` command) your agents can query them.

You browse it on the [OpenMetadata](../openmetadata.md#the-tabs) page (the
shapes icon under **Insights**), in its **Semantic models**, **Metrics** and
**Query builder** tabs. The **Malloy models** tab shows any Malloy files in
the same project folder.

## It is optional, twice

MonoRail does nothing about dbt or MetricFlow until you add the
**MetricFlow** connection on [Connections](connections.md). Until then
nothing reads the project: MonoRail does not look for dbt projects or
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

## What uses the connection

- **[Explore](../explore.md)** lists the project's semantic models and
  metrics, and the databases and tables they read.
- **[Services](services.md)** can read the dbt project into the catalog.
- **Agents** can list the metrics and, with your permission, query them (see
  below).

After you change the dbt project, run `dbt parse` again so the files MonoRail
reads are current.

## Where your data goes

A query runs your own `mf` program in the project folder, which connects to
your warehouse with your own dbt profile, exactly as if you typed the command.
The results go back to the agent that asked and are kept only while the call runs:
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
- [Agent spend](../agents/spend.md): Claude Stats, a tab of Bots > Dashboard.
- The rest of [setup](README.md).
- For developers and agents: the [Semantic reference](../../semantic.md).
