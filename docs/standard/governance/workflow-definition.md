---
audience: human, ai
summary: A governance workflow: its trigger, nodes and edges, such as a glossary approval. OpenMetadata's Workflow Definition entity.
---

# Workflow Definition

A governance workflow: its trigger, nodes and edges, such as a glossary approval. It is OpenMetadata's
[Workflow Definition](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/governance/workflows/workflowDefinition.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `workflowDefinition`
- **Required:** `name`, `description`
- **API:** `/v1/governance/workflowDefinitions`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields workflowDefinition -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this workflow definition. |
| `name` | `entityName` | Yes | Name that identifies this workflow definition. |
| `displayName` | `string` |  | Display Name that identifies this workflow definition. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` | Yes | Description of the workflow definition. |
| `owners` | `entityReferenceList` |  | Owners of this workflow definition. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `deployed` | `boolean` |  | When `true` indicates the workflow is deployed. |
| `suspended` | `boolean` |  | When `true` indicates the workflow is suspended and not accepting new executions. |
| `config` | `workflowConfiguration` |  | (OpenMetadata gives no description for config.) |
| `trigger` | `object` |  | Workflow Trigger. |
| `nodes` | `object[]` |  | List of nodes used on the workflow. |
| `edges` | `edge[]` |  | List of edges that connect the workflow elements and guide its flow. |

<!-- /standard -->
