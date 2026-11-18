---
audience: human, ai
summary: A kind of usage event collected from the catalog UI, such as page views. OpenMetadata's Web Analytic Event entity.
---

# Web Analytic Event

A kind of usage event collected from the catalog UI, such as page views. It is OpenMetadata's
[Web Analytic Event](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/analytics/webAnalyticEvent.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Insights](README.md).

- **Type:** `webAnalyticEvent`
- **Required:** `name`, `eventType`
- **API:** `/v1/analytics/web/events`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields webAnalyticEvent -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of the report. |
| `name` | `entityName` | Yes | Name that identifies this event. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this web analytics event. |
| `description` | `markdown` |  | Description of the event. |
| `eventType` | `webAnalyticEventType` | Yes | event type |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `owners` | `entityReferenceList` |  | Owners of this report. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who performed the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `enabled` | `boolean` |  | Weather the event is enable (i.e. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
