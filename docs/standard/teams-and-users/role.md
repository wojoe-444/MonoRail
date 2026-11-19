---
audience: human, ai
summary: A set of policies that grants access; given to users and teams. OpenMetadata's Role entity.
---

# Role

A set of policies that grants access; given to users and teams. It is OpenMetadata's
[Role](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/teams/role.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Teams & users](README.md).

- **Type:** `role`
- **Required:** `id`, `name`
- **API:** `/v1/roles`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields role -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Name used for display purposes. |
| `description` | `markdown` |  | Description of the role. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `allowDelete` | `boolean` |  | Some system roles can't be deleted |
| `allowEdit` | `boolean` |  | Some system roles can't be edited |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `policies` | `entityReferenceList` |  | Policies that is attached to this role. |
| `users` | `entityReferenceList` |  | Users that have this role assigned to them. |
| `teams` | `entityReferenceList` |  | Teams that have this role assigned to them. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `disabled` | `boolean` |  | System policy can't be deleted. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
