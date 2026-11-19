---
audience: human, ai
summary: A built-in chart over the catalog itself, such as description coverage. OpenMetadata's Data Insight Chart entity.
---

# Data Insight Chart

A built-in chart over the catalog itself, such as description coverage. It is OpenMetadata's
[Data Insight Chart](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/dataInsight/dataInsightChart.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Insights](README.md).

- **Type:** `dataInsightChart`
- **Required:** `name`
- **API:** `/v1/analytics/dataInsights/charts`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields dataInsightChart -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this table instance. |
| `name` | `entityName` | Yes | Name that identifies this data insight chart. |
| `displayName` | `string` |  | Display Name that identifies this data insight chart. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` |  | Description of the data insight chart. |
| `dataIndexType` | `dataReportIndex` |  | Index where data are stored |
| `dimensions` | `chartParameterValues[]` |  | This schema defines the parameter values for a chart. |
| `metrics` | `chartParameterValues[]` |  | This schema defines the parameter values for a chart. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `owners` | `entityReferenceList` |  | Owners of this Pipeline. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
