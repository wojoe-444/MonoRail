---
audience: human, ai
summary: The form used to create or resolve one kind of task. OpenMetadata's Task Form Schema entity.
---

# Task Form Schema

The form used to create or resolve one kind of task. It is OpenMetadata's
[Task Form Schema](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/feed/taskFormSchema.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Collaboration](README.md).

- **Type:** `taskFormSchema`
- **Required:** `id`, `name`, `taskType`, `formSchema`
- **API:** `/v1/taskFormSchemas`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields taskFormSchema -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier (UUID) for this form schema. |
| `name` | `entityName` | Yes | Unique key for this form schema (e.g., 'DescriptionSuggestion'). |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies an entity. |
| `displayName` | `string` |  | Display name for the form schema. |
| `description` | `markdown` |  | Description of the form schema. |
| `taskType` | `string` | Yes | The task type this form schema applies to. |
| `taskCategory` | `string` |  | The task category this form schema applies to. |
| `formSchema` | `object` | Yes | JSON Schema object defining the form fields and validation. |
| `uiSchema` | `object` |  | RJSF uiSchema object for customizing form rendering. |
| `workflowDefinitionRef` | `string` |  | Name of the WorkflowDefinition that orchestrates tasks created from this schema. |
| `workflowVersion` | `entityVersion` |  | Version of the bound workflow definition when this form schema was last saved. |
| `createFormSchema` | `object` |  | Optional JSON Schema override used specifically when creating a task. |
| `createUiSchema` | `object` |  | Optional uiSchema override used specifically when creating a task. |
| `transitionForms` | `object` |  | Per-transition form configuration keyed by transition identifier or formRef. |
| `defaultStageMappings` | `object` |  | Default workflow stage to coarse task status mappings keyed by stage identifier. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedBy` | `string` |  | User who last updated the form schema. |
| `updatedAt` | `timestamp` |  | Last update timestamp. |
| `href` | `href` |  | Link to the resource. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When true indicates the entity has been soft deleted. |

<!-- /standard -->
