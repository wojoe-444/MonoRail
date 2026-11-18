---
audience: human, ai
summary: One endpoint of an API, with its request and response schemas. OpenMetadata's API Endpoint entity.
---

# API Endpoint

One endpoint of an API, with its request and response schemas. It is OpenMetadata's
[API Endpoint](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/api-endpoints) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [APIs](README.md).

- **Type:** `apiEndpoint`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/apiEndpoints`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields apiEndpoint -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies a API Endpoint instance. |
| `name` | `entityName` | Yes | Name that identifies this API Endpoint. |
| `displayName` | `string` |  | Display Name that identifies this API Endpoint. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a API Collection in the format 'ServiceName.ApiCollectionName.APIEndpoint'. |
| `description` | `markdown` |  | Description of the API Endpoint, what it is, and how to use it. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `endpointURL` | `string` |  | EndPoint URL for the API Collection. |
| `requestMethod` | `apiRequestMethod` |  | Request Method for the API Endpoint. |
| `requestSchema` | `apiSchema` |  | Request Schema for the API Endpoint. |
| `responseSchema` | `apiSchema` |  | Response Schema for the API Endpoint. |
| `apiCollection` | `entityReference` |  | Reference to API Collection that contains this API Endpoint. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this API Collection. |
| `followers` | `entityReferenceList` |  | Followers of this API Collection. |
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
| `entityStatus` | `status` |  | Status of the APIEndpoint. |

<!-- /standard -->
