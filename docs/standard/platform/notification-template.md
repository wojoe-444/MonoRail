---
audience: human, ai
summary: How notifications about one entity type are worded. OpenMetadata's Notification Template entity.
---

# Notification Template

How notifications about one entity type are worded. It is OpenMetadata's
[Notification Template](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/events/notificationTemplate.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `notificationTemplate`
- **Required:** `id`, `name`, `templateSubject`, `templateBody`
- **API:** `/v1/notificationTemplates`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields notificationTemplate -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this template instance. |
| `name` | `entityName` | Yes | Name for the notification template (e.g., 'Default Table Template', 'Custom Pipeline Alerts'). |
| `displayName` | `string` |  | Display Name that identifies this template. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name for the template. |
| `description` | `markdown` |  | Description of the template purpose and usage. |
| `version` | `entityVersion` |  | Metadata version of the template. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the template. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this template resource. |
| `templateSubject` | `string` | Yes | Handlebars template for the email subject line with placeholders. |
| `templateBody` | `string` | Yes | Handlebars HTML template body with placeholders. |
| `provider` | `providerType` |  | Provider of the template. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the template. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the template has been soft deleted. |
| `isModifiedFromDefault` | `boolean` |  | Indicates if this system template has been modified from its default version. |

<!-- /standard -->
