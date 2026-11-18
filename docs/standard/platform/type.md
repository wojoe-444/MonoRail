---
audience: human, ai
summary: A property or entity type; custom properties are defined on these. OpenMetadata's Type entity.
---

# Type

A property or entity type; custom properties are defined on these. It is OpenMetadata's
[Type](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/type.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `type`
- **Required:** `name`, `description`
- **API:** `/v1/metadata/types`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields type -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of the type instance. |
| `name` | `entityName` | Yes | Unique name that identifies the type. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this type. |
| `description` | `markdown` | Yes | Optional description of entity. |
| `category` | `category` |  | Metadata category to which a type belongs to. |
| `nameSpace` | `string` |  | Namespace or group to which this type belongs to. |
| `schema` | `jsonSchema` |  | JSON schema encoded as string that defines the type. |
| `customProperties` | `customProperty[]` |  | Custom properties added to extend the entity. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this table resource. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |

<!-- /standard -->
