---
audience: human, ai
folder: Insights
summary: Data insight charts, KPIs and web analytic events.
---

# Insights

Data insight charts, KPIs and web analytic events. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)).

## Entity types

<!-- standard:entities insights -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Data Insight Chart](data-insight-chart.md) | `dataInsightChart` | A built-in chart over the catalog itself, such as description coverage. | `/v1/analytics/dataInsights/charts` |
| [Data Insight Custom Chart](data-insight-custom-chart.md) | `dataInsightCustomChart` | A chart someone defined over the catalog itself. | `/v1/analytics/dataInsights/system/charts` |
| [KPI](kpi.md) | `kpi` | A target for a data insight metric, such as 80% of tables described. | `/v1/kpi` |
| [Web Analytic Event](web-analytic-event.md) | `webAnalyticEvent` | A kind of usage event collected from the catalog UI, such as page views. | `/v1/analytics/web/events` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
