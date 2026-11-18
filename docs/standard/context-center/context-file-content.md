---
audience: human, ai
summary: A stored snapshot of a context file's content. OpenMetadata's Context File Content entity.
---

# Context File Content

A stored snapshot of a context file's content. It is OpenMetadata's
[Context File Content](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/contextFileContent.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Context center](README.md).

- **Type:** `contextFileContent`
- **Required:** `id`, `name`, `contextFile`
- **API:** none of its own; it is read through its Context File

## In MonoRail

MonoRail keeps none itself, and OpenMetadata serves no list of them, so the
[OpenMetadata page](../../guide/openmetadata.md) does not show them on their
own. [Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields contextFileContent -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the content snapshot. |
| `name` | `entityName` | Yes | Name of the content snapshot. |
| `displayName` | `string` |  | Display name of the content snapshot. |
| `description` | `markdown` |  | Description of the content snapshot. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the content snapshot. |
| `contextFile` | `entityReference` | Yes | The file this content snapshot belongs to. |
| `assetId` | `string` |  | Reference to the Asset entity storing the actual file blob. |
| `contentType` | `string` |  | MIME type of the stored content. |
| `size` | `integer` |  | Content size in bytes. |
| `checksum` | `string` |  | SHA-256 checksum of the stored content. |
| `sourceVersion` | `string` |  | Provider revision or version token for synced files. |
| `ingestedAt` | `timestamp` |  | Time the content snapshot was ingested. |
| `isCurrent` | `boolean` |  | Whether this is the current content snapshot for the file. |
| `processingStatus` | `processingStatus` |  | Processing status for this content snapshot. |
| `processingError` | `string` |  | Processing failure details for this snapshot. |
| `extractedText` | `string` |  | Canonical extracted text for this content snapshot. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to this resource. |
| `changeDescription` | `changeDescription` |  | Change that led to this version. |
| `incrementalChangeDescription` | `changeDescription` |  | Incremental change that led to this version. |
| `deleted` | `boolean` |  | When true indicates the entity has been soft deleted. |

<!-- /standard -->
