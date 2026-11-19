---
audience: human, ai
summary: A security service such as Apache Ranger. OpenMetadata's Security Service entity.
---

# Security Service

A security service such as Apache Ranger. It is OpenMetadata's
[Security Service](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/services/securityService.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `securityService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/securityServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields securityService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this security service instance. |
| `name` | `entityName` | Yes | Name that identifies this security service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `serviceType` | `securityServiceType` | Yes | Type of security service such as Apache Ranger... |
| `description` | `string` |  | Description of a security service instance. |
| `displayName` | `string` |  | Display Name that identifies this security service. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this Security Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `connection` | `securityConnection` |  | Security Connection. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this security service to extract metadata, usage, lineage etc.. |
| `owners` | `entityReferenceList` |  | Owners of this security service. |
| `href` | `href` |  | Link to the resource corresponding to this security service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `domains` | `entityReferenceList` |  | Domains the security service belongs to. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
