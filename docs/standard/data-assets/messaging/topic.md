---
audience: human, ai
summary: A feed or event stream in a messaging service that producers write to and consumers read. OpenMetadata's Topic entity.
---

# Topic

A feed or event stream in a messaging service that producers write to and consumers read. It is OpenMetadata's
[Topic](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/topics) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Messaging](README.md).

- **Type:** `topic`
- **Required:** `id`, `name`, `service`, `partitions`
- **API:** `/v1/topics`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields topic -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this topic instance. |
| `name` | `entityName` | Yes | Name that identifies the topic. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Name that uniquely identifies a topic in the format 'messagingServiceName.topicName'. |
| `displayName` | `string` |  | Display Name that identifies this topic. |
| `description` | `markdown` |  | Description of the topic instance. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `service` | `entityReference` | Yes | Link to the messaging cluster/service where this topic is hosted in. |
| `serviceType` | `messagingServiceType` |  | Service type where this topic is hosted in. |
| `messageSchema` | `schema` |  | This schema defines the Topic entity. |
| `partitions` | `integer` | Yes | Number of partitions into which the topic is divided. |
| `cleanupPolicies` | `cleanupPolicy[]` |  | Topic clean up policies. |
| `retentionTime` | `number` |  | Retention time in milliseconds. |
| `replicationFactor` | `integer` |  | Replication Factor in integer (more than 1). |
| `maximumMessageSize` | `integer` |  | Maximum message size in bytes. |
| `minimumInSyncReplicas` | `integer` |  | Minimum number replicas in sync to control durability. |
| `retentionSize` | `number` |  | Maximum size of a partition in bytes before old data is discarded. |
| `topicConfig` | `topicConfig` |  | Contains key/value pair of topic configuration. |
| `sampleData` | `topicSampleData` |  | Sample data for a topic. |
| `owners` | `entityReferenceList` |  | Owners of this topic. |
| `followers` | `entityReferenceList` |  | Followers of this table. |
| `tags` | `tagLabel[]` |  | Tags for this table. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `sourceUrl` | `sourceUrl` |  | Source URL of topic. |
| `domains` | `entityReferenceList` |  | Domains the Topic belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `entityStatus` | `status` |  | Status of the Topic. |

<!-- /standard -->
