---
audience: human, ai
summary: One control within an AI governance framework. OpenMetadata's AI Framework Control entity.
---

# AI Framework Control

One control within an AI governance framework. It is OpenMetadata's
[AI Framework Control](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/aiFrameworkControl.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `aiFrameworkControl`
- **Required:** `id`, `name`, `framework`
- **API:** `/v1/aiFrameworkControls`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields aiFrameworkControl -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Control name (typically the code, e.g. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies an entity. |
| `displayName` | `string` |  | Human-readable label (e.g. |
| `description` | `markdown` |  | Text in Markdown format. |
| `framework` | `entityReference` | Yes | Framework this control belongs to. |
| `code` | `string` |  | Stable short code for the control within its framework (e.g. |
| `category` | `controlCategory` |  | (OpenMetadata gives no description for category.) |
| `evidenceRequirements` | `string[]` |  | What evidence assessors should attach to demonstrate this control is met. |
| `owners` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `tags` | `tagLabel[]` |  | This schema defines the type for labeling an entity with a Tag. |
| `version` | `entityVersion` |  | Metadata version of the entity in the form `Major.Minor`. |
| `updatedAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | URI that points to a resource. |
| `changeDescription` | `changeDescription` |  | Description of the change. |
| `incrementalChangeDescription` | `changeDescription` |  | Description of the change. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `domains` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `lifeCycle` | `lifeCycle` |  | This schema defines Life Cycle Properties. |
| `sourceHash` | `string` |  | Source hash of the entity. |

<!-- /standard -->
