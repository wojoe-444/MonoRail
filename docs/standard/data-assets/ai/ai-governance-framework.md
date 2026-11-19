---
audience: human, ai
summary: A library of controls, such as the EU AI Act, that drives compliance assessments. OpenMetadata's AI Governance Framework entity.
---

# AI Governance Framework

A library of controls, such as the EU AI Act, that drives compliance assessments. It is OpenMetadata's
[AI Governance Framework](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/aiGovernanceFramework.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `aiGovernanceFramework`
- **Required:** `id`, `name`
- **API:** `/v1/aiGovernanceFrameworks`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields aiGovernanceFramework -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the AI Governance Framework. |
| `name` | `entityName` | Yes | Name that identifies this framework (e.g. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the framework. |
| `displayName` | `string` |  | Display name (e.g. |
| `description` | `markdown` |  | Description of what this framework covers. |
| `reference` | `string` |  | External reference for the framework (e.g. |
| `region` | `string` |  | Geographic jurisdiction this framework covers (e.g. |
| `source` | `frameworkSource` |  | Where the framework definition came from |
| `forkedFrom` | `entityReference` |  | When source is 'ForkedFrom', the framework this was forked from. |
| `enabled` | `boolean` |  | Whether this framework is enabled in the workspace. |
| `stewards` | `entityReferenceList` |  | Users or teams responsible for this framework's assessments. |
| `assessmentCadence` | `assessmentCadence` |  | How often this framework requires reassessment of in-scope assets |
| `autoApply` | `autoApplyRules` |  | Predicate that determines which AI assets this framework automatically applies to. |
| `nextDeadline` | `timestamp` |  | Next certification or assessment deadline. |
| `owners` | `entityReferenceList` |  | Owners of this framework configuration. |
| `tags` | `tagLabel[]` |  | Tags for this framework. |
| `version` | `entityVersion` |  | Metadata version of the entity |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch milliseconds |
| `updatedBy` | `string` |  | User who made the update |
| `href` | `href` |  | Link to this resource |
| `changeDescription` | `changeDescription` |  | Change that led to this version |
| `incrementalChangeDescription` | `changeDescription` |  | Change that led to this version |
| `deleted` | `boolean` |  | When true, indicates the entity has been soft deleted |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes |
| `domains` | `entityReferenceList` |  | Domains this framework belongs to |
| `lifeCycle` | `lifeCycle` |  | This schema defines Life Cycle Properties. |
| `sourceHash` | `string` |  | Source hash of the entity. |

<!-- /standard -->
