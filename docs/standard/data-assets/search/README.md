---
audience: human, ai
folder: Search
summary: Search services such as OpenSearch, and their indexes.
---

# Search

Search services such as OpenSearch, and their indexes. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)).

## Entity types

<!-- standard:entities search -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Search Service](search-service.md) | `searchService` | A service such as Elasticsearch or OpenSearch that hosts search indexes. | `/v1/services/searchServices` |
| [Search Index](search-index.md) | `searchIndex` | An index and its field mapping in a search service. | `/v1/searchIndexes` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
