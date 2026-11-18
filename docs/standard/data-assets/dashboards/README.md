---
audience: human, ai
folder: Dashboards
summary: Dashboard services, dashboards, charts, data models and reports.
---

# Dashboards

Dashboard services, dashboards, charts, data models and reports. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/dashboard-services).

## Entity types

<!-- standard:entities dashboards -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Dashboard Service](dashboard-service.md) | `dashboardService` | A service such as Looker, Tableau or Superset that hosts dashboards. | `/v1/services/dashboardServices` |
| [Dashboard](dashboard.md) | `dashboard` | A set of charts that present data, metrics and KPIs together. | `/v1/dashboards` |
| [Chart](chart.md) | `chart` | One visual presentation of data, usually part of a dashboard. | `/v1/charts` |
| [Dashboard Data Model](dashboard-data-model.md) | `dashboardDataModel` | The model a dashboard service builds charts on, with its own columns. | `/v1/dashboard/datamodels` |
| [Report](report.md) | `report` | Static information computed from data on a schedule: text, tables and visuals. | `/v1/reports` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
