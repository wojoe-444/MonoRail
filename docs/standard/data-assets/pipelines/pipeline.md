---
audience: human, ai
summary: A chain of processing steps that moves data from sources to destinations. OpenMetadata's Pipeline entity.
---

# Pipeline

A chain of processing steps that moves data from sources to destinations. It is OpenMetadata's
[Pipeline](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/pipelines) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Pipelines](README.md).

- **Type:** `pipeline`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/pipelines`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields pipeline -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies a pipeline instance. |
| `name` | `entityName` | Yes | Name that identifies this pipeline instance uniquely. |
| `displayName` | `string` |  | Display Name that identifies this Pipeline. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a pipeline in the format 'ServiceName.PipelineName'. |
| `description` | `markdown` |  | Description of this Pipeline. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `sourceUrl` | `sourceUrl` |  | Pipeline URL to visit/manage. |
| `concurrency` | `integer` |  | Concurrency of the Pipeline. |
| `pipelineLocation` | `string` |  | Pipeline Code Location. |
| `startDate` | `dateTime` |  | Start date of the workflow. |
| `endDate` | `dateTime` |  | End date of the workflow. |
| `tasks` | `task[]` |  | All the tasks that are part of pipeline. |
| `pipelineStatus` | `pipelineStatus` |  | Latest Pipeline Status. |
| `state` | `pipelineState` |  | State of the Pipeline. |
| `followers` | `entityReferenceList` |  | Followers of this Pipeline. |
| `tags` | `tagLabel[]` |  | Tags for this Pipeline. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this pipeline. |
| `service` | `entityReference` | Yes | Link to service where this pipeline is hosted in. |
| `serviceType` | `pipelineServiceType` |  | Service type where this pipeline is hosted in. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this pipeline. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `scheduleInterval` | `string` |  | Scheduler Interval for the pipeline in cron format. |
| `domains` | `entityReferenceList` |  | Domains the Pipeline belongs to. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `entityStatus` | `status` |  | Status of the Pipeline. |

<!-- /standard -->
