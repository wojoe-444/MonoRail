---
audience: human, ai
summary: A chart someone defined over the catalog itself. OpenMetadata's Data Insight Custom Chart entity.
---

# Data Insight Custom Chart

A chart someone defined over the catalog itself. It is OpenMetadata's
[Data Insight Custom Chart](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/dataInsight/custom/dataInsightCustomChart.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Insights](README.md).

- **Type:** `dataInsightCustomChart`
- **Required:** `name`, `chartDetails`
- **API:** `/v1/analytics/dataInsights/system/charts`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields dataInsightCustomChart -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this table instance. |
| `name` | `entityName` | Yes | Name that identifies this data insight chart. |
| `displayName` | `string` |  | Display Name the data insight chart. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` |  | Description of the data insight chart. |
| `chartType` | `enum` |  | Type of chart, used for UI to render the chart |
| `chartDetails` | `lineChart \| summaryCard` | Yes | Line Chart |
| `isSystemChart` | `boolean` |  | Flag to indicate if the chart is system generated or user created. |
| `owner` | `entityReference` |  | Owner of this chart |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `dashboard` | `entityReference` |  | Dashboard where this chart is displayed |

<!-- /standard -->
