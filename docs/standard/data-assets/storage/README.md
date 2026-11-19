---
audience: human, ai
folder: Storage
summary: Storage services such as S3, and their containers.
---

# Storage

Storage services such as S3, and their containers. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/storage-services).

## Entity types

<!-- standard:entities storage -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Storage Service](storage-service.md) | `storageService` | A service such as S3, GCS or Azure Blob Storage that stores files. | `/v1/services/storageServices` |
| [Container](container.md) | `container` | A path that stores data in a storage service, from a whole bucket down to a folder. | `/v1/containers` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
