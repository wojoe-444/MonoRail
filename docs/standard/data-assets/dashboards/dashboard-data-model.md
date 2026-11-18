---
audience: human, ai
summary: The model a dashboard service builds charts on, with its own columns. OpenMetadata's Dashboard Data Model entity.
---

# Dashboard Data Model

The model a dashboard service builds charts on, with its own columns. It is OpenMetadata's
[Dashboard Data Model](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/dashboardDataModel.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Dashboards](README.md).

- **Type:** `dashboardDataModel`
- **Required:** `id`, `name`, `dataModelType`, `columns`
- **API:** `/v1/dashboard/datamodels`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields dashboardDataModel -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this data model instance. |
| `name` | `entityName` | Yes | Name of a data model. |
| `displayName` | `string` |  | Display Name that identifies this data model. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of a data model in the form `serviceName.dashboardName.datamodel.datamodelName`. |
| `description` | `markdown` |  | Description of a data model. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this data model entity. |
| `owners` | `entityReferenceList` |  | Owners of this data model. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `tags` | `tagLabel[]` |  | Tags for this data model. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `followers` | `entityReferenceList` |  | Followers of this dashboard. |
| `service` | `entityReference` |  | Link to service where this data model is hosted in. |
| `serviceType` | `dashboardServiceType` |  | Service type where this data model is hosted in. |
| `dataModelType` | `dataModelType` | Yes | This schema defines the type used for describing different types of data models. |
| `sql` | `sqlQuery` |  | In case the Data Model is based on a SQL query. |
| `columns` | `column[]` | Yes | Columns from the data model. |
| `project` | `string` |  | Name of the project / workspace / collection in which the dataModel is contained |
| `sourceUrl` | `sourceUrl` |  | Dashboard Data Model URL suffix from its service. |
| `domains` | `entityReferenceList` |  | Domains the Dashboard Data Model belongs to. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `entityStatus` | `status` |  | Status of the DashboardDataModel. |

<!-- /standard -->
