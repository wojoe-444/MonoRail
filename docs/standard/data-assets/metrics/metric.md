---
audience: human, ai
summary: A measurement computed from data, such as monthly active users, with its formula. OpenMetadata's Metric entity.
---

# Metric

A measurement computed from data, such as monthly active users, with its formula. It is OpenMetadata's
[Metric](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/metric.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Metrics](README.md).

- **Type:** `metric`
- **Required:** `id`, `name`
- **API:** `/v1/metrics`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields metric -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this Metric instance. |
| `name` | `entityName` | Yes | Name that identifies this Metric instance uniquely. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a metric in the format 'ServiceName.MetricName'. |
| `displayName` | `string` |  | Display Name that identifies this metric. |
| `description` | `markdown` |  | Description of metrics instance, what it is, and how to use it. |
| `metricExpression` | `metricExpression` |  | Expression used to compute the metric. |
| `metricType` | `metricType` |  | Type of the metric. |
| `unitOfMeasurement` | `unitOfMeasurement` |  | Unit of measurement for the metric. |
| `customUnitOfMeasurement` | `string` |  | Custom unit of measurement when unitOfMeasurement is OTHER. |
| `granularity` | `metricGranularity` |  | Metric's granularity. |
| `dimensions` | `metricDimension[]` |  | Dimensions associated with this metric from a semantic layer. |
| `measures` | `metricMeasure[]` |  | Measures associated with this metric from a semantic layer. |
| `filters` | `metricFilter[]` |  | Filters applied to this metric. |
| `relatedMetrics` | `entityReferenceList` |  | Related Metrics. |
| `parent` | `entityReference` |  | Parent metric this metric is a variant of. |
| `metricGroup` | `entityReference` |  | Metric Group this metric belongs to, if any. |
| `children` | `entityReferenceList` |  | Immediate child metrics (variants) of this metric. |
| `childrenCount` | `integer` |  | Count of immediate, non-deleted child metrics. |
| `assets` | `entityReferenceList` |  | Data assets (tables, columns, dashboards, etc.) this metric is computed on or applies to. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this metrics. |
| `experts` | `entityReferenceList` |  | Users who are experts in this Metric. |
| `reviewers` | `entityReferenceList` |  | Reviewers of this Metric. |
| `followers` | `entityReferenceList` |  | Followers of this API Collection. |
| `tags` | `tagLabel[]` |  | Tags for this chart. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the Glossary belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `entityStatus` | `status` |  | Status of the Metric. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `derivedFrom` | `entityReference` |  | Derived: the context memory from which the Memory Agent created this metric (DERIVED_FROM edge, read-only projection). |

<!-- /standard -->
