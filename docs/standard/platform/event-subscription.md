---
audience: human, ai
summary: An alert: which changes trigger it, its filters and where it sends notifications. OpenMetadata's Event Subscription entity.
---

# Event Subscription

An alert: which changes trigger it, its filters and where it sends notifications. It is OpenMetadata's
[Event Subscription](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/alerts) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `eventsubscription`
- **Required:** `id`, `name`, `alertType`, `destinations`
- **API:** `/v1/events/subscriptions`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields eventsubscription -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this Event Subscription. |
| `className` | `string` |  | Id of the registered consumer that runs this Event Subscription, such as `alert`, the consumer that sends its notifications. |
| `name` | `entityName` | Yes | Name that uniquely identifies this Event Subscription. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName that uniquely identifies a Event Subscription. |
| `displayName` | `string` |  | Display name for this Event Subscription. |
| `description` | `markdown` |  | A short description of the Event Subscription, comprehensible to regular users. |
| `owners` | `entityReferenceList` |  | Owners of this Event Subscription. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `version` | `entityVersion` |  | Metadata version of the Event Subscription. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the Event Subscription in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `changeDescription` | `changeDescription` |  | Change that led to this version of the Event Subscription. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `alertType` | `alertType` | Yes | Type of Alert |
| `trigger` | `trigger` |  | Trigger information for Alert. |
| `filteringRules` | `filteringRules` |  | Set of rules that the Event Subscription Contains to allow conditional control for alerting. |
| `destinations` | `destination[]` | Yes | Destination Config. |
| `notificationTemplate` | `entityReference` |  | Optional custom notification template for this subscription. |
| `enabled` | `boolean` |  | Is the event Subscription enabled. |
| `batchSize` | `integer` |  | Maximum number of events sent in a batch (Default 100). |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `retries` | `integer` |  | Number of times to retry callback on failure. |
| `pollInterval` | `integer` |  | Poll Interval in seconds. |
| `input` | `alertFilteringInput` |  | Input for the Filters. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `config` | `map` |  | A generic map that can be deserialized later. |

<!-- /standard -->
