---
audience: human, ai
folder: Data quality
summary: Test definitions, test cases, test suites and quality dimensions.
---

# Data quality

Test definitions, test cases, test suites and quality dimensions. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-quality).

## Entity types

<!-- standard:entities dataQuality -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Test Definition](test-definition.md) | `testDefinition` | A kind of data quality test, with its parameters, that test cases are made from. | `/v1/dataQuality/testDefinitions` |
| [Test Case](test-case.md) | `testCase` | One data quality test run against a table, column or other asset. | `/v1/dataQuality/testCases` |
| [Test Suite](test-suite.md) | `testSuite` | A set of test cases run together. | `/v1/dataQuality/testSuites` |
| [Data Quality Dimension](data-quality-dimension.md) | `dataQualityDimension` | What a test checks, such as Completeness or Accuracy. | `/v1/dataQuality/dimensions` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
