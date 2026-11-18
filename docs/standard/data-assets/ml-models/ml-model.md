---
audience: human, ai
summary: A machine learning model trained on data, with its features and hyperparameters. OpenMetadata's ML Model entity.
---

# ML Model

A machine learning model trained on data, with its features and hyperparameters. It is OpenMetadata's
[ML Model](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/mlmodels) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [ML models](README.md).

- **Type:** `mlmodel`
- **Required:** `id`, `name`, `algorithm`, `service`
- **API:** `/v1/mlmodels`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields mlmodel -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of an ML Model instance. |
| `name` | `entityName` | Yes | Name that identifies this ML Model. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies an ML Model. |
| `displayName` | `string` |  | Display Name that identifies this ML Model. |
| `description` | `markdown` |  | Description of the ML Model, what it is, and how to use it. |
| `algorithm` | `string` | Yes | Algorithm used to train the ML Model. |
| `mlFeatures` | `mlFeature[]` |  | Features used to train the ML Model. |
| `mlHyperParameters` | `mlHyperParameter[]` |  | Hyper Parameters used to train the ML Model. |
| `target` | `entityName` |  | For supervised ML Models, the value to estimate. |
| `dashboard` | `entityReference` |  | Performance Dashboard URL to track metric evolution. |
| `mlStore` | `mlStore` |  | Location containing the ML Model. |
| `server` | `href` |  | Endpoint that makes the ML Model available, e.g,. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this ML Model. |
| `followers` | `entityReferenceList` |  | Followers of this ML Model. |
| `tags` | `tagLabel[]` |  | Tags for this ML Model. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this ML Model. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `service` | `entityReference` | Yes | Link to service where this pipeline is hosted in. |
| `serviceType` | `mlModelServiceType` |  | Service type where this pipeline is hosted in. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `sourceUrl` | `sourceUrl` |  | Source URL of mlModel. |
| `domains` | `entityReferenceList` |  | Domains the MLModel belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `entityStatus` | `status` |  | Status of the MlModel. |

<!-- /standard -->
