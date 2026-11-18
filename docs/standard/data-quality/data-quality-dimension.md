---
audience: human, ai
summary: What a test checks, such as Completeness or Accuracy. OpenMetadata's Data Quality Dimension entity.
---

# Data Quality Dimension

What a test checks, such as Completeness or Accuracy. It is OpenMetadata's
[Data Quality Dimension](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/tests/dataQualityDimension.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data quality](README.md).

- **Type:** `dataQualityDimension`
- **Required:** `name`
- **API:** `/v1/dataQuality/dimensions`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields dataQualityDimension -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this data quality dimension instance. |
| `name` | `entityName` | Yes | Name that identifies this data quality dimension. |
| `displayName` | `string` |  | Display Name that identifies this data quality dimension. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName of the data quality dimension, same as the name. |
| `description` | `markdown` |  | Description of what this dimension measures and when to use it. |
| `style` | `style` |  | UI style, holding the colour the dimension is rendered with. |
| `provider` | `providerType` |  | System dimensions ship with OpenMetadata and can neither be edited nor deleted. |
| `owners` | `entityReferenceList` |  | Owners of this data quality dimension. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |

<!-- /standard -->
