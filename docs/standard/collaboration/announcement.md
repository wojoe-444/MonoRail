---
audience: human, ai
summary: A notice on a data asset, shown between a start and an end time. OpenMetadata's Announcement entity.
---

# Announcement

A notice on a data asset, shown between a start and an end time. It is OpenMetadata's
[Announcement](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/feed/announcement.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Collaboration](README.md).

- **Type:** `announcement`
- **Required:** `id`, `name`, `description`, `startTime`, `endTime`
- **API:** `/v1/announcements`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields announcement -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier (UUID) for this announcement. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies an entity. |
| `displayName` | `string` |  | Display name for the announcement. |
| `description` | `markdown` | Yes | Announcement content in Markdown format. |
| `type` | `announcementType` |  | Severity/category of the announcement, used to style it in the UI. |
| `entityLink` | `entityLink` |  | Link to the entity this announcement is about. |
| `startTime` | `timestamp` | Yes | Start time from when the announcement should be shown. |
| `endTime` | `timestamp` | Yes | End time when the announcement expires. |
| `color` | `announcementColor` |  | Palette family the announcement is rendered with. |
| `customTypeName` | `string` |  | Label shown in place of the type name when the type is `Custom`. |
| `status` | `announcementStatus` |  | Status of the announcement based on its time window. |
| `createdBy` | `string` |  | User who created the announcement. |
| `updatedBy` | `string` |  | User who last updated the announcement. |
| `owners` | `entityReferenceList` |  | Owners of this announcement. |
| `domains` | `entityReferenceList` |  | Domains this announcement belongs to. |
| `reactions` | `reactionList` |  | Reactions to the announcement. |
| `createdAt` | `timestamp` |  | Timestamp when the announcement was created. |
| `updatedAt` | `timestamp` |  | Last update timestamp. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `href` | `href` |  | Link to the resource. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the announcement. |
| `deleted` | `boolean` |  | When true indicates the entity has been soft deleted. |

<!-- /standard -->
