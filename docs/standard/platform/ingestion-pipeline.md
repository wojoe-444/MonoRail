---
audience: human, ai
summary: A scheduled job that reads metadata, usage, lineage or quality results from a service. OpenMetadata's Ingestion Pipeline entity.
---

# Ingestion Pipeline

A scheduled job that reads metadata, usage, lineage or quality results from a service. It is OpenMetadata's
[Ingestion Pipeline](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/ingestion-pipelines) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `ingestionPipeline`
- **Required:** `name`, `pipelineType`, `sourceConfig`, `airflowConfig`
- **API:** `/v1/services/ingestionPipelines`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields ingestionPipeline -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier that identifies this pipeline. |
| `name` | `entityName` | Yes | Name that identifies this pipeline instance uniquely. |
| `displayName` | `string` |  | Display Name that identifies this Pipeline. |
| `description` | `markdown` |  | Description of the Pipeline. |
| `pipelineType` | `pipelineType` | Yes | Type of Pipeline - metadata, usage |
| `owners` | `entityReferenceList` |  | Owners of this Pipeline. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Name that uniquely identifies a Pipeline. |
| `sourceConfig` | `sourceConfig` | Yes | Additional connection configuration. |
| `openMetadataServerConnection` | `openMetadataConnection` |  | OpenMetadata Connection Config |
| `airflowConfig` | `airflowConfig` | Yes | Properties to configure the Airflow pipeline that will run the workflow. |
| `service` | `entityReference` |  | Link to the service (such as database, messaging, storage services, etc. |
| `pipelineStatuses` | `pipelineStatus[]` |  | List of the most recent executions and status for the Pipeline. |
| `loggerLevel` | `logLevels` |  | Set the logging level for the workflow. |
| `raiseOnError` | `boolean` |  | Control if we want to flag the workflow as failed if we encounter any processing errors. |
| `deployed` | `boolean` |  | Indicates if the workflow has been successfully deployed to Airflow. |
| `enabled` | `boolean` |  | True if the pipeline is ready to be run in the next schedule. |
| `enableStreamableLogs` | `boolean` |  | Enable real-time log streaming to the OpenMetadata server. |
| `href` | `href` |  | Link to this ingestion pipeline resource. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `changeDescription` | `changeDescription` |  | Change that led to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `applicationType` | `string` |  | Type of the application when pipelineType is 'application'. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |
| `processingEngine` | `entityReference` |  | The processing engine responsible for executing the ingestion pipeline logic. |

<!-- /standard -->
