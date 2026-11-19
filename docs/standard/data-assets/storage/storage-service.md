---
audience: human, ai
summary: A service such as S3, GCS or Azure Blob Storage that stores files. OpenMetadata's Storage Service entity.
---

# Storage Service

A service such as S3, GCS or Azure Blob Storage that stores files. It is OpenMetadata's
[Storage Service](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/storage-services) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Storage](README.md).

- **Type:** `storageService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/storageServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields storageService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this storage service instance. |
| `name` | `entityName` | Yes | Name that identifies this storage service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this storage service. |
| `serviceType` | `storageServiceType` | Yes | Type of storage service such as S3, GCS, AZURE... |
| `description` | `markdown` |  | Description of a storage service instance. |
| `connection` | `storageConnection` |  | Storage Connection. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this storage service to extract metadata, usage, lineage etc.. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this storage Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this storage service. |
| `owners` | `entityReferenceList` |  | Owners of this storage service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `entityStatus` | `status` |  | Status of the entity. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `domains` | `entityReferenceList` |  | Domains the Storage service belongs to. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
