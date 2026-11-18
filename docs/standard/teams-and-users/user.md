---
audience: human, ai
summary: A person who uses the catalog, in zero or more teams. OpenMetadata's User entity.
---

# User

A person who uses the catalog, in zero or more teams. It is OpenMetadata's
[User](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/teams-and-users/users) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Teams & users](README.md).

- **Type:** `user`
- **Required:** `id`, `name`, `email`
- **API:** `/v1/users`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields user -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies a user entity instance. |
| `name` | `entityName` | Yes | A unique name of the user, typically the user ID from an identity provider. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` |  | Used for user biography. |
| `externalId` | `string` |  | External identifier from identity provider (used for SCIM). |
| `identityProviderSubject` | `string` |  | Subject ('sub') claim recorded from the identity provider on first email-first login. |
| `scimUserName` | `string` |  | Raw user name from SCIM. |
| `displayName` | `string` |  | Name used for display purposes. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `email` | `email` | Yes | Email address of the user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `timezone` | `string` |  | Timezone of the user. |
| `isBot` | `boolean` |  | When true indicates a special type of user called Bot. |
| `isAdmin` | `boolean` |  | When true indicates user is an administrator for the system with superuser privileges. |
| `allowImpersonation` | `boolean` |  | When true, this bot is allowed to impersonate users (subject to policy checks). |
| `authenticationMechanism` | `authenticationMechanism` |  | User/Bot Authentication Mechanism. |
| `profile` | `profile` |  | Profile of the user. |
| `teams` | `entityReferenceList` |  | Teams that the user belongs to. |
| `defaultPersona` | `entityReference` |  | Default Persona for the user from list of personas. |
| `defaultDomain` | `entityReference` |  | The domain the user selects in the navbar to scope list views. |
| `personas` | `entityReferenceList` |  | Personas that the user assigned to. |
| `owns` | `entityReferenceList` |  | List of entities owned by the user. |
| `follows` | `entityReferenceList` |  | List of entities followed by the user. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `roles` | `entityReferenceList` |  | Roles that the user has been assigned. |
| `inheritedRoles` | `entityReferenceList` |  | Roles that a user is inheriting through membership in teams that have set team default roles. |
| `inheritedPersonas` | `entityReferenceList` |  | Personas inherited through membership in teams that have set a team default persona. |
| `isEmailVerified` | `boolean` |  | If the User has verified the mail |
| `domains` | `entityReferenceList` |  | Domain the User belongs to. |
| `lastLoginTime` | `timestamp` |  | Last time the user logged in. |
| `lastActivityTime` | `timestamp` |  | Last time the user was active in the system. |
| `isFirstTimeUser` | `boolean` |  | When true indicates the user is accessing the product for the first time. |
| `personaPreferences` | `personaPreferences[]` |  | User's personal preferences for each persona. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |

<!-- /standard -->
