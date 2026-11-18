---
audience: human, ai
summary: Access rules applied across data assets and other entities. OpenMetadata's Policy entity.
---

# Policy

Access rules applied across data assets and other entities. It is OpenMetadata's
[Policy](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/policies/policy.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Teams & users](README.md).

- **Type:** `policy`
- **Required:** `id`, `name`, `rules`
- **API:** `/v1/policies`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields policy -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this Policy. |
| `name` | `entityName` | Yes | Name that uniquely identifies this Policy. |
| `fullyQualifiedName` | `entityName` |  | Name that uniquely identifies a Policy. |
| `displayName` | `string` |  | Display name for this Policy. |
| `description` | `markdown` |  | A short description of the Policy, comprehensible to regular users. |
| `owners` | `entityReferenceList` |  | Owners of this Policy. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `enabled` | `boolean` |  | Is the policy enabled. |
| `version` | `entityVersion` |  | Metadata version of the Policy. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the Policy in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `changeDescription` | `changeDescription` |  | Change that led to this version of the Policy. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `rules` | `rules` | Yes | Set of rules that the policy contains. |
| `teams` | `entityReferenceList` |  | Teams that use this policy directly and not through roles. |
| `roles` | `entityReferenceList` |  | Roles that use this policy. |
| `location` | `entityReference` |  | Location to which a policy is applied. |
| `allowDelete` | `boolean` |  | Some system policies can't be deleted |
| `allowEdit` | `boolean` |  | Some system roles can't be edited |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `disabled` | `boolean` |  | System policy can't be deleted. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
