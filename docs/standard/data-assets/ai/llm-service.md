---
audience: human, ai
summary: A provider of large language models, such as Anthropic, OpenAI or AWS Bedrock. OpenMetadata's LLM Service entity.
---

# LLM Service

A provider of large language models, such as Anthropic, OpenAI or AWS Bedrock. It is OpenMetadata's
[LLM Service](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/services/llmService.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `llmService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/llmServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields llmService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this LLM service instance |
| `name` | `entityName` | Yes | Name that identifies this LLM service |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name` |
| `serviceType` | `llmServiceType` | Yes | Type of LLM service provider |
| `description` | `string` |  | Description of this LLM service instance |
| `displayName` | `string` |  | Display Name that identifies this LLM service |
| `version` | `entityVersion` |  | Metadata version of the entity |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch milliseconds |
| `updatedBy` | `string` |  | User who made the update |
| `models` | `entityReferenceList` |  | LLM Models registered with this service |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this LLM service |
| `connection` | `llmConnection` |  | LLM Service Connection. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this LLM Service |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `owners` | `entityReferenceList` |  | Owners of this LLM service |
| `href` | `href` |  | Link to the resource corresponding to this LLM service |
| `changeDescription` | `changeDescription` |  | Change that led to this version of the entity |
| `incrementalChangeDescription` | `changeDescription` |  | Change that led to this version of the entity |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity |
| `domains` | `entityReferenceList` |  | Domains the LLM service belongs to |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline |

<!-- /standard -->
