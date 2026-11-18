---
audience: human, ai
summary: A generic stored JSON document, used for things like email templates. OpenMetadata's Document entity.
---

# Document

A generic stored JSON document, used for things like email templates. It is OpenMetadata's
[Document](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/docStore/document.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `document`
- **Required:** `name`, `fullyQualifiedName`, `entityType`, `data`
- **API:** `/v1/docStore`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields document -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Name of the DocStore |
| `displayName` | `string` |  | Display Name that identifies this column name. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` | Yes | A unique name that identifies an entity. |
| `description` | `string` |  | Description of the DocStore Entity. |
| `entityType` | `string` | Yes | Type of the Entity stored in DocStore. |
| `data` | `data` | Yes | (OpenMetadata gives no description for data.) |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
