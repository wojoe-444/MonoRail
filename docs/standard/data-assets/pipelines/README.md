---
audience: human, ai
folder: Pipelines
summary: Pipeline services such as Airflow, and their pipelines.
---

# Pipelines

Pipeline services such as Airflow, and their pipelines. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/pipeline-services).

## Entity types

<!-- standard:entities pipelines -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Pipeline Service](pipeline-service.md) | `pipelineService` | A service such as Airflow, Dagster or Prefect that runs pipelines. | `/v1/services/pipelineServices` |
| [Pipeline](pipeline.md) | `pipeline` | A chain of processing steps that moves data from sources to destinations. | `/v1/pipelines` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
