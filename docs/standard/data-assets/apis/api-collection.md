---
audience: human, ai
summary: A group of API endpoints, like a tag in an OpenAPI specification. OpenMetadata's API Collection entity.
---

# API Collection

A group of API endpoints, like a tag in an OpenAPI specification. It is OpenMetadata's
[API Collection](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/api-collections) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [APIs](README.md).

- **Type:** `apiCollection`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/apiCollections`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields apiCollection -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies a API Collection instance. |
| `name` | `entityName` | Yes | Name that identifies this API Collection. |
| `displayName` | `string` |  | Display Name that identifies this API Collection. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a API Collection in the format 'ServiceName.ApiCollectionName'. |
| `description` | `markdown` |  | Description of the API Collection, what it is, and how to use it. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `endpointURL` | `string` |  | EndPoint URL for the API Collection. |
| `apiEndpoints` | `entityReferenceList` |  | All the APIs included in this API Collection. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this API Collection. |
| `tags` | `tagLabel[]` |  | Tags for this API Collection. |
| `service` | `entityReference` | Yes | Link to service where this API Collection is hosted in. |
| `serviceType` | `apiServiceType` |  | Service type where this API Collection is hosted in. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `domains` | `entityReferenceList` |  | Domains the API Collection belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `entityStatus` | `status` |  | Status of the API Collection. |

<!-- /standard -->
