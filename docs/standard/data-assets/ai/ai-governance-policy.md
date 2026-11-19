---
audience: human, ai
summary: An organizational rule for AI and LLM usage, compliance and risk. OpenMetadata's AI Governance Policy entity.
---

# AI Governance Policy

An organizational rule for AI and LLM usage, compliance and risk. It is OpenMetadata's
[AI Governance Policy](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/aiGovernancePolicy.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `aiGovernancePolicy`
- **Required:** `id`, `name`, `policyType`
- **API:** `/v1/aiGovernancePolicies`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields aiGovernancePolicy -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the AI Governance Policy |
| `name` | `entityName` | Yes | Name that identifies this AI Governance Policy |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the AI Governance Policy |
| `displayName` | `string` |  | Display name for the AI Governance Policy |
| `description` | `markdown` |  | Description of the policy and its purpose |
| `policyType` | `policyType` | Yes | (OpenMetadata gives no description for policyType.) |
| `rules` | `policyRule[]` |  | Rules that make up this policy |
| `biasThresholds` | `biasThreshold` |  | Bias threshold limits for LLM models |
| `dataAccessControls` | `dataAccessControl` |  | Data access controls for AI agents |
| `costControls` | `costControl` |  | Cost control limits |
| `complianceRequirements` | `complianceRequirement[]` |  | Compliance requirements this policy enforces |
| `performanceStandards` | `performanceStandard` |  | Performance standards for AI agents |
| `appliesTo` | `entityReferenceList` |  | Entities this policy applies to |
| `enforcementLevel` | `enum` |  | How strictly to enforce this policy |
| `enabled` | `boolean` |  | Whether this policy is currently active |
| `effectiveDate` | `timestamp` |  | Date when policy becomes effective |
| `expirationDate` | `timestamp` |  | Date when policy expires |
| `approvedBy` | `string` |  | Who approved this policy |
| `violations` | `policyViolation[]` |  | Recent policy violations |
| `owners` | `entityReferenceList` |  | Owners of this AI Governance Policy |
| `followers` | `entityReferenceList` |  | Followers of this AI Governance Policy |
| `domain` | `entityReference` |  | Domain the policy belongs to |
| `tags` | `tagLabel[]` |  | Tags for this AI Governance Policy |
| `version` | `entityVersion` |  | Metadata version of the entity |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch milliseconds |
| `updatedBy` | `string` |  | User who made the update |
| `href` | `href` |  | Link to this resource |
| `changeDescription` | `changeDescription` |  | Change that led to this version |
| `incrementalChangeDescription` | `changeDescription` |  | Change that led to this version |
| `deleted` | `boolean` |  | When true, indicates the entity has been soft deleted |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes |
| `domains` | `entityReferenceList` |  | Domains the policy belongs to |
| `votes` | `votes` |  | Votes on the entity |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |

<!-- /standard -->
