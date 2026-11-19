---
audience: human, ai
folder: ML models
summary: Machine learning model services and models.
---

# ML models

Machine learning model services and models. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/mlmodel-services).

## Entity types

<!-- standard:entities mlModels -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [ML Model Service](ml-model-service.md) | `mlmodelService` | A service such as MLflow or SageMaker that hosts machine learning models. | `/v1/services/mlmodelServices` |
| [ML Model](ml-model.md) | `mlmodel` | A machine learning model trained on data, with its features and hyperparameters. | `/v1/mlmodels` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
