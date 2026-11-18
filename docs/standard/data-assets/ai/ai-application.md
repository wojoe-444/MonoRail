---
audience: human, ai
summary: A running AI system such as a chatbot, agent or copilot, with the models and tools it uses. OpenMetadata's AI Application entity.
---

# AI Application

A running AI system such as a chatbot, agent or copilot, with the models and tools it uses. It is OpenMetadata's
[AI Application](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/aiApplication.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `aiApplication`
- **Required:** `id`, `name`, `applicationType`, `modelConfigurations`
- **API:** `/v1/aiApplications`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields aiApplication -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the AI Application. |
| `name` | `entityName` | Yes | Name that identifies this AI Application. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the AI Application. |
| `displayName` | `string` |  | Display name for the AI Application. |
| `description` | `markdown` |  | Description of the AI Application, its purpose, and usage. |
| `applicationType` | `applicationType` | Yes | Type of AI application based on primary function and interaction pattern |
| `developmentStage` | `developmentStage` |  | Development stage of the AI application. |
| `modelConfigurations` | `modelConfiguration[]` | Yes | Multiple LLM models this application can use for different purposes |
| `primaryModel` | `entityReference` |  | Primary/default LLM model used by this application |
| `promptTemplates` | `entityReferenceList` |  | Prompt templates used by this application |
| `tools` | `entityReferenceList` |  | MCP tools or other tools available to this application |
| `mcpServers` | `entityReferenceList` |  | MCP servers this application connects to for tools, resources, and prompts |
| `dataSources` | `entityReferenceList` |  | Data sources (tables, APIs, etc.) this application can access |
| `knowledgeBases` | `entityReferenceList` |  | Vector databases, document stores used for RAG |
| `upstreamApplications` | `entityReferenceList` |  | Other AI applications this application depends on (multi-agent orchestration) |
| `downstreamApplications` | `entityReferenceList` |  | AI applications that depend on this application |
| `framework` | `frameworkInfo` |  | Information about the framework used to build the application |
| `governanceMetadata` | `governanceMetadata` |  | AI governance metadata for compliance and risk management |
| `biasMetrics` | `biasMetrics` |  | Bias evaluation metrics for the AI application |
| `performanceMetrics` | `performanceMetrics` |  | Runtime performance metrics for the AI application |
| `qualityMetrics` | `qualityMetrics` |  | Quality metrics for AI application responses |
| `safetyMetrics` | `safetyMetrics` |  | Safety metrics for AI application |
| `testSuites` | `entityReferenceList` |  | Test suites for validating this AI application |
| `sourceCode` | `string` |  | Link to source code repository |
| `deploymentUrl` | `string` |  | Production deployment endpoint |
| `documentation` | `string` |  | Link to external documentation |
| `owners` | `entityReferenceList` |  | Owners of this AI Application |
| `followers` | `entityReferenceList` |  | Followers of this AI Application |
| `domain` | `entityReference` |  | Domain the AI Application belongs to |
| `dataProducts` | `entityReferenceList` |  | Data products this AI Application is part of |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `tags` | `tagLabel[]` |  | Tags for this AI Application |
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
| `domains` | `entityReferenceList` |  | Domains the AI Application belongs to |
| `votes` | `votes` |  | Votes on the entity |
| `reviewers` | `entityReferenceList` |  | Risk Council reviewers responsible for approving this AI Application. |
| `entityStatus` | `status` |  | Governance approval status of the AI Application. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |

<!-- /standard -->
