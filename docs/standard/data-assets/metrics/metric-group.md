---
audience: human, ai
summary: A named collection of metrics, such as Profitability. OpenMetadata's Metric Group entity.
---

# Metric Group

A named collection of metrics, such as Profitability. It is OpenMetadata's
[Metric Group](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/metricGroup.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Metrics](README.md).

- **Type:** `metricGroup`
- **Required:** `id`, `name`
- **API:** `/v1/metricGroups`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields metricGroup -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this Metric Group instance. |
| `name` | `entityName` | Yes | Name that identifies this Metric Group uniquely. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a Metric Group. |
| `displayName` | `string` |  | Display Name that identifies this Metric Group. |
| `description` | `markdown` |  | Description of the Metric Group, summarising what the metrics inside it have in common. |
| `metrics` | `entityReferenceList` |  | Metrics that belong to this group. |
| `metricCount` | `integer` |  | Count of non-deleted metrics in this group. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this Metric Group. |
| `followers` | `entityReferenceList` |  | Followers of this Metric Group. |
| `tags` | `tagLabel[]` |  | Tags for this Metric Group. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the Metric Group belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `votes` | `votes` |  | Votes on the entity. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `entityStatus` | `status` |  | Status of the Metric Group. |
| `provider` | `providerType` |  | Type of provider of an entity. |

<!-- /standard -->
