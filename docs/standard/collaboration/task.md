---
audience: human, ai
summary: A work item, such as an access request or a glossary approval, assigned to people. OpenMetadata's Task entity.
---

# Task

A work item, such as an access request or a glossary approval, assigned to people. It is OpenMetadata's
[Task](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/tasks/task.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Collaboration](README.md).

- **Type:** `task`
- **Required:** `id`, `name`, `category`, `type`, `status`, `createdBy`
- **API:** `/v1/tasks`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields task -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier (UUID) for this task. |
| `taskId` | `string` |  | Human-readable task identifier (e.g., TASK-00001). |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `displayName` | `string` |  | Display name for the task. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies an entity. |
| `description` | `markdown` |  | Description of the task in Markdown format. |
| `category` | `taskCategory` | Yes | Category of task for grouping similar task types. |
| `type` | `taskType` | Yes | Type of task determining the workflow and required payload. |
| `status` | `taskStatus` | Yes | Current status of the task in its lifecycle. |
| `priority` | `taskPriority` |  | Priority level of the task. |
| `about` | `entityReference` |  | Reference to the entity this task is about. |
| `aboutFqnHash` | `string` |  | Hash of the target entity's fully qualified name for efficient querying. |
| `domains` | `entityReferenceList` |  | Domains this task belongs to, inherited from the target entity for visibility scoping. |
| `createdBy` | `entityReference` | Yes | User who created this task. |
| `createdById` | `string` |  | UUID of the user who created this task. |
| `approvedBy` | `entityReference` |  | User who approved this task (set when an approval transition fires; distinct from resolution.resolvedBy which is set only on terminal transitions). |
| `approvedById` | `string` |  | UUID of the user who approved this task. |
| `approvedAt` | `timestamp` |  | Timestamp when the task was approved. |
| `assignees` | `entityReferenceList` |  | Users or teams assigned to complete this task. |
| `useEntityOwnerFallback` | `boolean` |  | Whether to assign entity owners when this task is created without assignees. |
| `reviewers` | `entityReferenceList` |  | Users or teams who should review this task. |
| `watchers` | `entityReferenceList` |  | Users following this task for updates. |
| `payload` | `object` |  | Task-specific payload validated at runtime by the resolved TaskFormSchema for the task type and category. |
| `resolution` | `taskResolution` |  | Resolution details when task is completed. |
| `dueDate` | `timestamp` |  | Due date for task completion. |
| `externalReference` | `externalReference` |  | Reference to external system (JIRA, ServiceNow, etc.). |
| `workflowInstanceId` | `uuid` |  | ID of the workflow instance managing this task. |
| `workflowDefinitionId` | `uuid` |  | ID of the workflow definition bound to this task lifecycle. |
| `workflowStageId` | `string` |  | Current workflow stage identifier for this task. |
| `workflowStageDisplayName` | `string` |  | Human-readable workflow stage name shown to users. |
| `availableTransitions` | `taskAvailableTransition[]` |  | Transitions available from the current workflow stage. |
| `taskFormSchemaId` | `uuid` |  | ID of the resolved TaskFormSchema used to validate and render this task. |
| `taskFormSchemaVersion` | `entityVersion` |  | Version of the resolved TaskFormSchema captured when this task was created. |
| `comments` | `taskComment[]` |  | Comments on this task. |
| `commentCount` | `integer` |  | Number of comments on this task. |
| `tags` | `tagLabel[]` |  | Tags for this task. |
| `createdAt` | `timestamp` |  | Timestamp when the task was created. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update timestamp. |
| `updatedBy` | `string` |  | User who made the last update. |
| `href` | `href` |  | Link to the resource. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the task. |
| `deleted` | `boolean` |  | When true indicates the entity has been soft deleted. |
| `ontologyReview` | `ontologyReviewTarget` |  | Immutable, server-managed review target for ontology approval tasks. |
| `reviewVotes` | `taskReviewVote[]` |  | Counted votes on a workflow approval task, one per voter in each workflow stage, including the deciding vote. |

<!-- /standard -->
