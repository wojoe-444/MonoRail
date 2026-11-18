---
audience: human, ai
summary: A folder in the context center drive; folders can hold folders. OpenMetadata's Folder entity.
---

# Folder

A folder in the context center drive; folders can hold folders. It is OpenMetadata's
[Folder](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/folder.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Context center](README.md).

- **Type:** `folder`
- **Required:** `id`, `name`
- **API:** `/v1/contextCenter/drive/folders`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields folder -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the folder. |
| `name` | `entityName` | Yes | Name of the folder. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the folder. |
| `displayName` | `string` |  | Display name of the folder. |
| `description` | `markdown` |  | Description of the folder. |
| `icon` | `string` |  | Optional icon identifier for UI display. |
| `color` | `string` |  | Optional color for the folder icon. |
| `parent` | `entityReference` |  | Parent folder (for nested folders). |
| `children` | `entityReferenceList` |  | Child folders. |
| `childrenCount` | `integer` |  | Count of direct children (folders + files). |
| `owners` | `entityReferenceList` |  | Owners of this folder. |
| `tags` | `tagLabel[]` |  | Tags associated with this folder. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to this resource. |
| `changeDescription` | `changeDescription` |  | Change that led to this version. |
| `incrementalChangeDescription` | `changeDescription` |  | Incremental change that led to this version. |
| `deleted` | `boolean` |  | When true indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains this folder belongs to. |
| `followers` | `entityReferenceList` |  | Followers of this folder. |

<!-- /standard -->
