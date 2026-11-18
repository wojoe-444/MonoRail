---
audience: human, ai
folder: Data contracts
summary: The schema and quality guarantees a data asset makes.
---

# Data contracts

The schema and quality guarantees a data asset makes. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-contracts).

## Entity types

<!-- standard:entities dataContracts -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Data Contract](data-contract.md) | `dataContract` | The schema, quality and service-level guarantees a data asset makes. | `/v1/dataContracts` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
