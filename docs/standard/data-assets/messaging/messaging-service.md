---
audience: human, ai
summary: A service such as Kafka, Pulsar or Kinesis that carries event streams. OpenMetadata's Messaging Service entity.
---

# Messaging Service

A service such as Kafka, Pulsar or Kinesis that carries event streams. It is OpenMetadata's
[Messaging Service](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/messaging-services) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Messaging](README.md).

- **Type:** `messagingService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/messagingServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields messagingService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this messaging service instance. |
| `name` | `entityName` | Yes | Name that identifies this messaging service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `serviceType` | `messagingServiceType` | Yes | Type of messaging service such as Kafka or Pulsar... |
| `description` | `markdown` |  | Description of a messaging service instance. |
| `displayName` | `string` |  | Display Name that identifies this messaging service. |
| `connection` | `messagingConnection` |  | Dashboard Connection. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this messaging service to extract topic configs and schemas. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this Message Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `owners` | `entityReferenceList` |  | Owners of this messaging service. |
| `href` | `href` |  | Link to the resource corresponding to this messaging service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `entityStatus` | `status` |  | Status of the entity. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `domains` | `entityReferenceList` |  | Domains the Messaging service belongs to. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
