---
audience: human, ai
folder: APIs
summary: API services, collections and endpoints.
---

# APIs

API services, collections and endpoints. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/api-collections).

## Entity types

<!-- standard:entities apis -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [API Service](api-service.md) | `apiService` | A REST API service whose collections and endpoints are catalogued. | `/v1/services/apiServices` |
| [API Collection](api-collection.md) | `apiCollection` | A group of API endpoints, like a tag in an OpenAPI specification. | `/v1/apiCollections` |
| [API Endpoint](api-endpoint.md) | `apiEndpoint` | One endpoint of an API, with its request and response schemas. | `/v1/apiEndpoints` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
