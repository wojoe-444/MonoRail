---
audience: human, ai
summary: A job function such as Data Engineer, which shapes what a user sees. OpenMetadata's Persona entity.
---

# Persona

A job function such as Data Engineer, which shapes what a user sees. It is OpenMetadata's
[Persona](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/teams/persona.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Teams & users](README.md).

- **Type:** `persona`
- **Required:** `id`, `name`
- **API:** `/v1/personas`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields persona -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | A unique name of Persona. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Name used for display purposes. |
| `description` | `markdown` |  | Description of the persona. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `uiCustomization` | `entityReference` |  | Reference to the UI customization configuration. |
| `contextDefinition` | `personaContextDefinition` |  | Rules and settings used to materialize the shared AI context for this persona. |
| `users` | `entityReferenceList` |  | Users that are assigned a persona. |
| `userCount` | `integer` |  | Distinct active users assigned this persona directly, through a team, or as their default persona. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `default` | `boolean` |  | When true, this persona is the system-wide default persona that will be applied to users who don't have any persona assigned or no default persona set. |

<!-- /standard -->
