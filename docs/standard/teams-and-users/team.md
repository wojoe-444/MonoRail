---
audience: human, ai
summary: A group of users and other teams that can own data assets. OpenMetadata's Team entity.
---

# Team

A group of users and other teams that can own data assets. It is OpenMetadata's
[Team](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/teams-and-users/teams) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Teams & users](README.md).

- **Type:** `team`
- **Required:** `id`, `name`
- **API:** `/v1/teams`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields team -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `teamType` | `teamType` |  | Team type |
| `name` | `entityName` | Yes | A unique name of the team typically the team ID from an identity provider. |
| `email` | `email` |  | Email address of the team. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Name used for display purposes. |
| `externalId` | `string` |  | External identifier for the team from an external identity provider (e.g., Azure AD group ID). |
| `description` | `markdown` |  | Description of the team. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `profile` | `profile` |  | Team profile information. |
| `parents` | `entityReferenceList` |  | Parent teams. |
| `children` | `entityReferenceList` |  | Children teams. |
| `descendantTeams` | `entityReferenceList` |  | All teams nested under this team, resolved recursively (the full subtree, excluding this team itself). |
| `users` | `entityReferenceList` |  | Users that are part of the team. |
| `childrenCount` | `integer` |  | Total count of Children teams. |
| `userCount` | `integer` |  | Total count of users that are part of the team. |
| `owns` | `entityReferenceList` |  | List of entities owned by the team. |
| `owners` | `entityReferenceList` |  | Owner of this team. |
| `isJoinable` | `boolean` |  | Can any user join this team during sign up? |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `defaultRoles` | `entityReferenceList` |  | Default roles of a team. |
| `inheritedRoles` | `entityReferenceList` |  | Roles that a team is inheriting through membership in teams that have set team default roles. |
| `defaultPersona` | `entityReference` |  | Default persona for all users in this team. |
| `policies` | `entityReferenceList` |  | Policies that is attached to this team. |
| `domains` | `entityReferenceList` |  | Domain the Team belongs to. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |

<!-- /standard -->
