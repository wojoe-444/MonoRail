---
audience: human, ai
summary: A service that finds and manages MCP (Model Context Protocol) servers. OpenMetadata's MCP Service entity.
---

# MCP Service

A service that finds and manages MCP (Model Context Protocol) servers. It is OpenMetadata's
[MCP Service](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/services/mcpService.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `mcpService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/mcpServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields mcpService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this MCP service instance |
| `name` | `entityName` | Yes | Name that identifies this MCP service |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name` |
| `serviceType` | `mcpServiceType` | Yes | Type of MCP service |
| `description` | `markdown` |  | Description of the MCP service |
| `displayName` | `string` |  | Display Name that identifies this MCP service |
| `version` | `entityVersion` |  | Metadata version of the entity |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds |
| `updatedBy` | `string` |  | User who made the update |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this MCP service to extract metadata |
| `connection` | `mcpConnection` |  | MCP Service Connection. |
| `testConnectionResult` | `testConnectionResult` |  | Result of the last test connection performed on this service |
| `tags` | `tagLabel[]` |  | Tags for this MCP Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `owners` | `entityReferenceList` |  | Owners of this MCP service |
| `href` | `href` |  | Link to the resource corresponding to this entity |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity |
| `incrementalChangeDescription` | `changeDescription` |  | Change that led to this version of the entity |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of |
| `followers` | `entityReferenceList` |  | Followers of this entity |
| `domains` | `entityReferenceList` |  | Domains the MCP service belongs to |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline |

<!-- /standard -->
