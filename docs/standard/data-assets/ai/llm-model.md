---
audience: human, ai
summary: A registered large language model: a base model, deployment or fine-tune. OpenMetadata's LLM Model entity.
---

# LLM Model

A registered large language model: a base model, deployment or fine-tune. It is OpenMetadata's
[LLM Model](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/llmModel.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `llmModel`
- **Required:** `id`, `name`, `modelType`, `baseModel`
- **API:** `/v1/llmModels`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields llmModel -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the LLM Model |
| `name` | `entityName` | Yes | Name that identifies this LLM Model |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the LLM Model |
| `displayName` | `string` |  | Display name for the LLM Model |
| `description` | `markdown` |  | Description of the LLM Model, its purpose, and capabilities |
| `service` | `entityReference` |  | OPTIONAL reference to LLMService where this model is hosted |
| `modelType` | `modelType` | Yes | Type of LLM model |
| `baseModel` | `string` | Yes | Base model name (e.g., 'gpt-4', 'claude-3-opus', 'llama-2-70b') |
| `modelVersion` | `string` |  | Version of the model |
| `modelProvider` | `string` |  | Model provider (e.g., 'OpenAI', 'Anthropic', 'Meta') |
| `providerModelId` | `string` |  | Provider's internal model ID |
| `capabilities` | `modelCapability[]` |  | Capabilities of this model |
| `modelSpecifications` | `modelSpecifications` |  | Technical specifications of the model |
| `trainingMetadata` | `trainingMetadata` |  | Training or fine-tuning metadata - critical for data lineage and impact analysis |
| `modelEvaluation` | `modelEvaluation` |  | Comprehensive evaluation metrics for the LLM model |
| `usedByAgents` | `entityReferenceList` |  | AI Agents that use this model |
| `governanceStatus` | `enum` |  | Governance status - tracks unauthorized/shadow AI models |
| `detection` | `aiDetection` |  | Origin of Shadow AI detection — auto-discovered from outbound API traffic, SSO logs, connector audits, etc. |
| `evidence` | `aiEvidence` |  | Supporting documentation URLs (DPIA, model card, fairness analysis, technical docs) |
| `remediationActions` | `remediationAction[]` |  | Structured remediation actions with assignee, due date, priority, and status |
| `certifications` | `string[]` |  | Certifications this model has received |
| `regulatoryCompliance` | `string[]` |  | Regulatory compliance standards met |
| `costMetrics` | `costMetrics` |  | Cost metrics for using this model |
| `deploymentInfo` | `deploymentInfo` |  | Deployment information for the model |
| `owners` | `entityReferenceList` |  | Owners of this LLM Model |
| `followers` | `entityReferenceList` |  | Followers of this LLM Model |
| `domain` | `entityReference` |  | Domain the LLM Model belongs to |
| `dataProducts` | `entityReferenceList` |  | Data products this model is part of |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `tags` | `tagLabel[]` |  | Tags for this LLM Model |
| `version` | `entityVersion` |  | Metadata version of the entity |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch milliseconds |
| `updatedBy` | `string` |  | User who made the update |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this resource |
| `changeDescription` | `changeDescription` |  | Change that led to this version |
| `incrementalChangeDescription` | `changeDescription` |  | Change that led to this version |
| `deleted` | `boolean` |  | When true, indicates the entity has been soft deleted |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes |
| `domains` | `entityReferenceList` |  | Domains the LLMModel belongs to |
| `votes` | `votes` |  | Votes on the entity |
| `reviewers` | `entityReferenceList` |  | Risk Council reviewers responsible for approving this LLM Model. |
| `entityStatus` | `status` |  | Governance approval status of the LLM Model. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |

<!-- /standard -->
