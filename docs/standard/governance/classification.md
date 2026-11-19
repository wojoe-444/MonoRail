---
audience: human, ai
summary: A set of tags for classifying data, such as PII or Tier. OpenMetadata's Classification entity.
---

# Classification

A set of tags for classifying data, such as PII or Tier. It is OpenMetadata's
[Classification](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/governance/classifications) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `classification`
- **Required:** `id`, `name`, `description`
- **API:** `/v1/classifications`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields classification -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this entity instance. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this entity. |
| `description` | `markdown` | Yes | Description of the classification. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `termCount` | `integer` |  | Total number of children tag terms under this classification. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to the classification. |
| `usageCount` | `integer` |  | Count of how many times the tags from this classification are used. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `disabled` | `boolean` |  | System classifications can't be deleted. |
| `mutuallyExclusive` | `boolean` |  | Tags under this classification are mutually exclusive. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `owners` | `entityReferenceList` |  | Owners of this Classification. |
| `reviewers` | `entityReferenceList` |  | User references of the reviewers for this tag. |
| `entityStatus` | `status` |  | Status of the tag. |
| `autoClassificationConfig` | `object` |  | Configuration for automatic classification behavior |

<!-- /standard -->
