---
audience: human, ai
summary: An index and its field mapping in a search service. OpenMetadata's Search Index entity.
---

# Search Index

An index and its field mapping in a search service. It is OpenMetadata's
[Search Index](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/searchIndex.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Search](README.md).

- **Type:** `searchIndex`
- **Required:** `id`, `name`, `service`, `fields`
- **API:** `/v1/searchIndexes`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields searchIndex -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this SearchIndex instance. |
| `name` | `entityName` | Yes | Name that identifies the SearchIndex. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Name that uniquely identifies a SearchIndex in the format 'searchServiceName.searchIndexName'. |
| `displayName` | `string` |  | Display Name that identifies this SearchIndex. |
| `description` | `markdown` |  | Description of the SearchIndex instance. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `service` | `entityReference` | Yes | Link to the search cluster/service where this SearchIndex is hosted in. |
| `serviceType` | `searchServiceType` |  | Service type where this SearchIndex is hosted in. |
| `fields` | `searchIndexField[]` | Yes | Fields in this SearchIndex. |
| `searchIndexSettings` | `searchIndexSettings` |  | Contains key/value pair of searchIndex settings. |
| `indexType` | `indexType` |  | Whether the entity is index or index template. |
| `sampleData` | `searchIndexSampleData` |  | Sample data for a searchIndex. |
| `owners` | `entityReferenceList` |  | Owners of this searchIndex. |
| `followers` | `entityReferenceList` |  | Followers of this searchIndex. |
| `tags` | `tagLabel[]` |  | Tags for this searchIndex. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `domains` | `entityReferenceList` |  | Domains the SearchIndex belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `entityStatus` | `status` |  | Status of the SearchIndex. |

<!-- /standard -->
