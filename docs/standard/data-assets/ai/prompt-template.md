---
audience: human, ai
summary: A reusable prompt for AI agents, with variables, a system prompt and examples. OpenMetadata's Prompt Template entity.
---

# Prompt Template

A reusable prompt for AI agents, with variables, a system prompt and examples. It is OpenMetadata's
[Prompt Template](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/promptTemplate.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `promptTemplate`
- **Required:** `id`, `name`, `templateContent`
- **API:** `/v1/promptTemplates`

## In MonoRail

MonoRail's own prompt templates, kept on the Catalog's Prompts page, are
Prompt Templates. [Explore](../../../guide/explore.md) lists each one in
OpenMetadata's shape:

| Field | From MonoRail's template |
| --- | --- |
| `id` | The template's id |
| `name`, `displayName`, `fullyQualifiedName` | The name of its newest version |
| `templateContent` | The text of its newest version |
| `templateVersion` | Its newest version number |
| `updatedAt` | When its newest version was saved |
| `extension.versions` | Every saved version's number, name and time (MonoRail keeps them all; OpenMetadata has no field for that) |

The [OpenMetadata page](../../../guide/openmetadata.md) shows the ones in
your own OpenMetadata server.

## Fields

<!-- standard:fields promptTemplate -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the Prompt Template |
| `name` | `entityName` | Yes | Name that identifies this Prompt Template |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the Prompt Template |
| `displayName` | `string` |  | Display name for the Prompt Template |
| `description` | `markdown` |  | Description of the Prompt Template and its purpose |
| `templateContent` | `string` | Yes | The actual prompt template content with variables in {{variable}} format |
| `systemPrompt` | `string` |  | System prompt to set the AI's behavior and context |
| `variables` | `templateVariable[]` |  | Variables used in this template |
| `examples` | `promptExample[]` |  | Examples demonstrating how to use this template |
| `templateType` | `enum` |  | Type of prompt template |
| `templateVersion` | `string` |  | Template version for tracking changes |
| `parentTemplate` | `entityReference` |  | Reference to parent template if this is a version/fork |
| `usedByAgents` | `entityReferenceList` |  | AI Agents using this template |
| `metrics` | `promptMetrics` |  | Usage and performance metrics for the prompt template |
| `tags` | `tagLabel[]` |  | Tags for this Prompt Template |
| `version` | `entityVersion` |  | Metadata version of the entity |
| `owners` | `entityReferenceList` |  | Owners of this Prompt Template |
| `followers` | `entityReferenceList` |  | Followers of this Prompt Template |
| `domain` | `entityReference` |  | Domain the Prompt Template belongs to |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch milliseconds |
| `updatedBy` | `string` |  | User who made the update |
| `href` | `href` |  | Link to this resource |
| `changeDescription` | `changeDescription` |  | Change that led to this version |
| `incrementalChangeDescription` | `changeDescription` |  | Change that led to this version |
| `deleted` | `boolean` |  | When true, indicates the entity has been soft deleted |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes |
| `domains` | `entityReferenceList` |  | Domains the Prompt Template belongs to |
| `votes` | `votes` |  | Votes on the entity |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |

<!-- /standard -->
