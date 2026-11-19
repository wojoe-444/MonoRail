---
audience: human, ai
summary: A service such as MLflow or SageMaker that hosts machine learning models. OpenMetadata's ML Model Service entity.
---

# ML Model Service

A service such as MLflow or SageMaker that hosts machine learning models. It is OpenMetadata's
[ML Model Service](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/mlmodel-services) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [ML models](README.md).

- **Type:** `mlmodelService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/mlmodelServices`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields mlmodelService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this pipeline service instance. |
| `name` | `entityName` | Yes | Name that identifies this pipeline service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `serviceType` | `mlModelServiceType` | Yes | Type of pipeline service such as Airflow or Prefect... |
| `description` | `string` |  | Description of a pipeline service instance. |
| `displayName` | `string` |  | Display Name that identifies this pipeline service. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this pipeline service to extract metadata |
| `connection` | `mlModelConnection` |  | MlModel Connection. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this MlModel Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `owners` | `entityReferenceList` |  | Owners of this pipeline service. |
| `href` | `href` |  | Link to the resource corresponding to this pipeline service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `entityStatus` | `status` |  | Status of the entity. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `domains` | `entityReferenceList` |  | Domains the MLModel service belongs to. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
