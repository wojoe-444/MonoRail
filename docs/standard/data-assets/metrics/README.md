---
audience: human, ai
folder: Metrics
summary: Business metrics and the groups that organize them.
---

# Metrics

Business metrics and the groups that organize them. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)).

## Entity types

<!-- standard:entities metrics -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Metric](metric.md) | `metric` | A measurement computed from data, such as monthly active users, with its formula. | `/v1/metrics` |
| [Metric Group](metric-group.md) | `metricGroup` | A named collection of metrics, such as Profitability. | `/v1/metricGroups` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
