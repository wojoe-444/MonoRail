---
audience: human, ai
summary: An automation account, such as the ingestion bot, that acts with its own user. OpenMetadata's Bot entity.
---

# Bot

An automation account, such as the ingestion bot, that acts with its own user. It is OpenMetadata's
[Bot](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/bot.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Teams & users](README.md).

- **Type:** `bot`
- **Required:** `id`, `name`, `botUser`
- **API:** `/v1/bots`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields bot -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of a bot instance. |
| `name` | `entityName` | Yes | Name of the bot. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Name used for display purposes. |
| `description` | `markdown` |  | Description of the bot. |
| `botUser` | `entityReference` | Yes | Bot user created for this bot on behalf of which the bot performs all the operations, such as updating description, responding on the conversation threads, etc. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this bot. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
