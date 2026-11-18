---
audience: human, ai
summary: A service such as Google Drive or SharePoint that stores documents. OpenMetadata's Drive Service entity.
---

# Drive Service

A service such as Google Drive or SharePoint that stores documents. It is OpenMetadata's
[Drive Service](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/services/driveService.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Drives](README.md).

- **Type:** `driveService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/driveServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields driveService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this drive service instance. |
| `name` | `entityName` | Yes | Name that identifies this drive service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this drive service. |
| `serviceType` | `driveServiceType` | Yes | Type of drive service such as Google Drive... |
| `description` | `markdown` |  | Description of a drive service instance. |
| `connection` | `driveConnection` |  | Drive Connection. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this drive service to extract metadata, usage, lineage etc.. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this drive Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this drive service. |
| `owners` | `entityReferenceList` |  | Owners of this drive service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `domains` | `entityReferenceList` |  | Domains the Drive service belongs to. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
