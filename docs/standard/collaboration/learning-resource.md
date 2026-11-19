---
audience: human, ai
summary: A tutorial, video or link to guidance, shown where it helps in the product. OpenMetadata's Learning Resource entity.
---

# Learning Resource

A tutorial, video or link to guidance, shown where it helps in the product. It is OpenMetadata's
[Learning Resource](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/learning/learningResource.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Collaboration](README.md).

- **Type:** `learningResource`
- **Required:** `id`, `name`, `resourceType`, `categories`, `source`, `contexts`
- **API:** `/v1/learning/resources`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields learningResource -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies an entity. |
| `displayName` | `string` |  | Display label presented to users. |
| `description` | `markdown` |  | Text in Markdown format. |
| `resourceType` | `resourceType` | Yes | Kind of learning asset represented. |
| `categories` | `resourceCategory[]` | Yes | Topic categories the resource belongs to. |
| `difficulty` | `resourceDifficulty` |  | Suggested proficiency tier for the resource. |
| `source` | `resourceSource` | Yes | Embedding configuration for rendering the resource inline. |
| `estimatedDuration` | `integer` |  | Approximate viewing time in seconds. |
| `contexts` | `resourceContext[]` | Yes | List of contexts where this resource should surface. |
| `status` | `enum` |  | Lifecycle state for controllable publishing. |
| `tags` | `tagLabel[]` |  | Tags attached to the learning resource. |
| `owners` | `entityReferenceList` |  | Owners accountable for maintaining this resource. |
| `reviewers` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `followers` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `changeDescription` | `changeDescription` |  | Description of the change. |
| `incrementalChangeDescription` | `changeDescription` |  | Description of the change. |
| `deleted` | `boolean` |  | Soft delete marker. |
| `version` | `entityVersion` |  | Metadata version of the entity in the form `Major.Minor`. |
| `updatedAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | URI that points to a resource. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |

<!-- /standard -->
