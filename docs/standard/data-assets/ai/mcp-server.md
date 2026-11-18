---
audience: human, ai
summary: An MCP server deployment and the tools, resources and prompts it offers. OpenMetadata's MCP Server entity.
---

# MCP Server

An MCP server deployment and the tools, resources and prompts it offers. It is OpenMetadata's
[MCP Server](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/mcpServer.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `mcpServer`
- **Required:** `id`, `name`, `serverType`
- **API:** `/v1/mcpServers`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields mcpServer -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the MCP Server. |
| `name` | `entityName` | Yes | Name that identifies this MCP Server. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the MCP Server. |
| `displayName` | `string` |  | Display name for the MCP Server. |
| `description` | `markdown` |  | Description of the MCP Server, its purpose, and capabilities. |
| `service` | `entityReference` |  | Reference to the MCP Service that contains this MCP Server. |
| `serverType` | `serverType` | Yes | Type of MCP server based on its primary function |
| `transportType` | `transportType` |  | Transport protocol used by the MCP server |
| `protocolVersion` | `string` |  | MCP protocol version supported by this server |
| `developmentStage` | `developmentStage` |  | Development stage of the MCP server. |
| `serverInfo` | `serverInfo` |  | Information about the MCP server software |
| `connectionConfig` | `connectionConfig` |  | Connection configuration for the MCP server |
| `capabilities` | `serverCapabilities` |  | Capabilities supported by the MCP server |
| `tools` | `mcpTool[]` |  | Tools exposed by this MCP Server |
| `resources` | `mcpResource[]` |  | Resources exposed by this MCP Server |
| `prompts` | `mcpPrompt[]` |  | Prompt templates exposed by this MCP Server |
| `governanceMetadata` | `governanceMetadata` |  | Governance metadata for compliance and risk management of the MCP server |
| `dataAccessSummary` | `dataAccessSummary` |  | Summary of data access patterns for this MCP server |
| `usageMetrics` | `usageMetrics` |  | Usage metrics for the MCP server |
| `securityMetrics` | `securityMetrics` |  | Security metrics and settings for the MCP server |
| `usedByApplications` | `entityReferenceList` |  | AI Applications that use this MCP Server |
| `sourceCode` | `string` |  | Link to source code repository |
| `deploymentUrl` | `string` |  | Deployment endpoint URL |
| `documentation` | `string` |  | Link to external documentation |
| `owners` | `entityReferenceList` |  | Owners of this MCP Server |
| `followers` | `entityReferenceList` |  | Followers of this MCP Server |
| `domain` | `entityReference` |  | Domain the MCP Server belongs to |
| `dataProducts` | `entityReferenceList` |  | Data products this MCP Server is part of |
| `tags` | `tagLabel[]` |  | Tags for this MCP Server |
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
| `domains` | `entityReferenceList` |  | Domains the MCP Server belongs to |
| `votes` | `votes` |  | Votes on the entity |
| `reviewers` | `entityReferenceList` |  | Risk Council reviewers responsible for approving this MCP Server. |
| `entityStatus` | `status` |  | Governance approval status of the MCP Server. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |

<!-- /standard -->
