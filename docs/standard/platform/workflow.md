---
audience: human, ai
summary: An automation run by the server, such as testing a service connection. OpenMetadata's Workflow entity.
---

# Workflow

An automation run by the server, such as testing a service connection. It is OpenMetadata's
[Workflow](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/automations/workflow.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `workflow`
- **Required:** `id`, `name`, `workflowType`, `request`
- **API:** `/v1/automations/workflows`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields workflow -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this workflow instance. |
| `name` | `entityName` | Yes | Name of the workflow. |
| `displayName` | `string` |  | Display Name that identifies this workflow definition. |
| `description` | `markdown` |  | Description of the test connection def. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `workflowType` | `workflowType` | Yes | Type of the workflow. |
| `status` | `workflowStatus` |  | Workflow computation status. |
| `request` | `testServiceConnection \| reverseIngestionPipeline \| queryRunnerRequest \| testSparkEngineConnection` | Yes | Request body for a specific workflow type |
| `response` | `testConnectionResult \| reverseIngestionResponse \| queryRunnerResponse` |  | Response to the request. |
| `openMetadataServerConnection` | `openMetadataConnection` |  | OpenMetadata Connection Config |
| `owners` | `entityReferenceList` |  | Owners of this workflow. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |

<!-- /standard -->
