---
audience: human, ai
summary: A REST API service whose collections and endpoints are catalogued. OpenMetadata's API Service entity.
---

# API Service

A REST API service whose collections and endpoints are catalogued. It is OpenMetadata's
[API Service](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/services/apiService.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [APIs](README.md).

- **Type:** `apiService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/apiServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields apiService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this API service instance. |
| `name` | `entityName` | Yes | Name that identifies this API service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this API service. |
| `serviceType` | `apiServiceType` | Yes | Type of API service such as REST, WEBHOOK.. |
| `description` | `markdown` |  | Description of a API service instance. |
| `connection` | `apiConnection` |  | API Service Connection. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this API service to extract metadata, usage, lineage etc.. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this API Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this API service. |
| `owners` | `entityReferenceList` |  | Owners of this API service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `entityStatus` | `status` |  | Status of the entity. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `domains` | `entityReferenceList` |  | Domains the API service belongs to. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
