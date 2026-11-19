---
audience: human, ai
summary: One label in a classification, used to tag data assets. OpenMetadata's Tag entity.
---

# Tag

One label in a classification, used to tag data assets. It is OpenMetadata's
[Tag](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/governance/tags) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `tag`
- **Required:** `id`, `name`, `description`
- **API:** `/v1/tags`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields tag -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this entity instance. |
| `name` | `entityName` | Yes | Name of the tag. |
| `displayName` | `string` |  | Display Name that identifies this tag. |
| `fullyQualifiedName` | `string` |  | Unique name of the tag of format `Classification.tag1.tag2`. |
| `description` | `markdown` | Yes | Description of the tag. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `classification` | `entityReference` |  | Reference to the classification that this tag is part of. |
| `parent` | `entityReference` |  | Reference to the parent tag. |
| `children` | `entityReferenceList` |  | Children tags under this tag. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to the tag. |
| `usageCount` | `integer` |  | Count of how many times this tag and children tags are used. |
| `deprecated` | `boolean` |  | If the tag is deprecated. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `disabled` | `boolean` |  | System tags can't be deleted. |
| `mutuallyExclusive` | `boolean` |  | Children tags under this group are mutually exclusive. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `owners` | `entityReferenceList` |  | Owners of this glossary term. |
| `reviewers` | `entityReferenceList` |  | User references of the reviewers for this tag. |
| `entityStatus` | `status` |  | Status of the tag. |
| `recognizers` | `recognizer[]` |  | List of recognizers configured for automatic detection of this tag |
| `autoClassificationEnabled` | `boolean` |  | Whether automatic classification is enabled for this tag |
| `autoClassificationPriority` | `integer` |  | Priority for conflict resolution when multiple tags match (higher number = higher priority) |

<!-- /standard -->
