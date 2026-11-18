---
audience: human, ai
summary: MonoRail's own entity types for a dbt project's semantic layer: semantic models, metrics and saved queries.
---

# Semantic

Entity types of MonoRail's own for a dbt project's semantic layer, read from
its MetricFlow manifest ([Semantic](../../semantic.md), guide:
[Set up Semantic](../../guide/setup/semantic.md)). They are defined by the
[MonoRail standard](../README.md) in its style (see the
[rules](../README.md#rules)) and listed on [Explore](../../guide/explore.md) under
**Semantic**.

<!-- standard:entities semantic -->

| Entity | Type | What it is | In MonoRail |
| --- | --- | --- | --- |
| [Semantic model](semantic.md#semantic-model) | `semanticModel` | A MetricFlow semantic model: entities, dimensions and measures over one dbt model. | Insights > Semantic |
| [Metric](semantic.md#metric) | `semanticMetric` | A MetricFlow metric. Not OpenMetadata's Metric entity, which MonoRail has not adopted yet. | Insights > Semantic |
| [Saved query](semantic.md#saved-query) | `savedQuery` | A MetricFlow saved query: metrics, group-bys and filters under one name. | Insights > Semantic |

<!-- /standard -->

## Semantic model

A MetricFlow semantic model: entities, dimensions and measures over one dbt
model. Its `relation` names the warehouse table it reads, which is how
Explore finds the [tables](../data-assets/databases/table.md), [schemas](../data-assets/databases/database-schema.md)
and [databases](../data-assets/databases/database.md) of the [Databases](../data-assets/databases/README.md)
category.

<!-- standard:fields semanticModel -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | The semantic model's name. |
| `description` | `string` |  | What it describes. |
| `model` | `string` |  | The dbt model it is defined on, e.g. `fct_orders`. |
| `relation` | `object` |  | The warehouse table it reads: `database`, `schema` and `name`. This is the link to a Table. |
| `defaultTimeDimension` | `string` |  | The time dimension measures use by default. |
| `primaryEntity` | `string` |  | Its primary entity. |
| `entities` | `modelEntity[]` | Yes | Join keys: `name` and `type` (primary, foreign, unique, natural). |
| `dimensions` | `modelDimension[]` | Yes | What it can be grouped by: `name`, `type` (categorical or time), `grain`, `description`. |
| `measures` | `modelMeasure[]` | Yes | What it adds up: `name`, `agg`, `description`. |

<!-- /standard -->

## Metric

A MetricFlow metric. OpenMetadata 2.0 has its own `metric` entity, which
MonoRail has not adopted, so this type is `semanticMetric` and never `metric`.

<!-- standard:fields semanticMetric -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | The metric's name. |
| `label` | `string` |  | Its display name. |
| `description` | `string` |  | What it measures. |
| `type` | `enum` | Yes | `simple`, `ratio`, `cumulative`, `derived` or `conversion`. |
| `definition` | `string` | Yes | How it is worked out, in words, e.g. "Sum of order_total". |
| `filter` | `string` |  | A where filter on the metric itself, as written. |
| `measures` | `string[]` | Yes | Measures it reads, directly or through its input metrics. |
| `inputMetrics` | `string[]` | Yes | Metrics it is built from. |
| `semanticModels` | `string[]` | Yes | Semantic models it reads. |
| `dimensions` | `string[]` | Yes | Group-by names it can be split by, e.g. `customer__region`. |

<!-- /standard -->

## Saved query

A MetricFlow saved query: metrics, group-bys and filters kept under one name.

<!-- standard:fields savedQuery -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | The saved query's name. |
| `description` | `string` |  | What it answers. |
| `metrics` | `string[]` | Yes | Metrics it returns. |
| `groupBy` | `string[]` | Yes | Group-bys it splits them by. |
| `where` | `string[]` | Yes | Filters, as written. |

<!-- /standard -->
