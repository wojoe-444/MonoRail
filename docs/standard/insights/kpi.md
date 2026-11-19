---
audience: human, ai
summary: A target for a data insight metric, such as 80% of tables described. OpenMetadata's KPI entity.
---

# KPI

A target for a data insight metric, such as 80% of tables described. It is OpenMetadata's
[KPI](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/dataInsight/kpi/kpi.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Insights](README.md).

- **Type:** `kpi`
- **Required:** `name`, `description`, `metricType`, `dataInsightChart`, `targetValue`, `startDate`, `endDate`
- **API:** `/v1/kpi`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields kpi -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this KPI Definition instance. |
| `name` | `entityName` | Yes | Name that identifies this KPI Definition. |
| `displayName` | `string` |  | Display Name that identifies this KPI Definition. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` | Yes | Description of the KpiObjective. |
| `metricType` | `kpiTargetType` | Yes | This enum defines the type of key Result |
| `dataInsightChart` | `entityReference` | Yes | Data Insight Chart Referred by this Kpi Objective. |
| `targetValue` | `number` | Yes | Metrics from the chart and the target to achieve the result. |
| `kpiResult` | `kpiResult` |  | Result of the Kpi |
| `startDate` | `timestamp` | Yes | Start Date for the KPIs |
| `endDate` | `timestamp` | Yes | End Date for the KPIs |
| `owners` | `entityReferenceList` |  | Owners of this KPI definition. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
