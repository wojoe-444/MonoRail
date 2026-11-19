---
audience: human, ai
summary: The fields asked for when someone creates or changes a domain, data product or glossary term. OpenMetadata's Intake Form entity.
---

# Intake Form

The fields asked for when someone creates or changes a domain, data product or glossary term. It is OpenMetadata's
[Intake Form](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/governance/intakeForm.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `intakeForm`
- **Required:** `id`, `name`, `entityType`
- **API:** `/v1/governance/intakeForms`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields intakeForm -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique ID of the IntakeForm. |
| `name` | `entityName` | Yes | Unique name of the IntakeForm. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the IntakeForm. |
| `displayName` | `string` |  | Name used for display purposes. |
| `description` | `markdown` |  | Description of what governance policy this IntakeForm enforces. |
| `entityType` | `targetEntityType` | Yes | The entity type this IntakeForm applies to. |
| `enabled` | `boolean` |  | Whether this IntakeForm is currently enforced. |
| `formFields` | `intakeFormField[]` |  | Fields included in this IntakeForm. |
| `requiredFields` | `requiredField[]` |  | Deprecated compatibility view of the required entries in formFields. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this IntakeForm configuration. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Incremental change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |

<!-- /standard -->
