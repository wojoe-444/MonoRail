---
audience: human, ai
summary: A kind of data quality test, with its parameters, that test cases are made from. OpenMetadata's Test Definition entity.
---

# Test Definition

A kind of data quality test, with its parameters, that test cases are made from. It is OpenMetadata's
[Test Definition](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-quality/test-definitions) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data quality](README.md).

- **Type:** `testDefinition`
- **Required:** `name`, `testPlatforms`
- **API:** `/v1/dataQuality/testDefinitions`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields testDefinition -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this test case definition instance. |
| `name` | `testCaseEntityName` | Yes | Name that identifies this test case. |
| `displayName` | `string` |  | Display Name that identifies this test case. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` |  | Description of the testcase. |
| `entityType` | `entityType` |  | This enum defines the type for which this test definition applies to. |
| `testPlatforms` | `testPlatform[]` | Yes | This schema defines the platform where tests are defined and ran. |
| `supportedDataTypes` | `dataType[]` |  | List of column data types that this test definition supports. |
| `parameterDefinition` | `testCaseParameterDefinition[]` |  | This schema defines the parameters that can be passed for a Test Case. |
| `dataQualityDimension` | `entityName` |  | Name of the data quality dimension test cases of this test definition are classified with by default. |
| `owners` | `entityReferenceList` |  | Owners of this TestCase definition. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `supportsRowLevelPassedFailed` | `boolean` |  | When `true` indicates the test case supports row level passed/failed. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `supportsDynamicAssertion` | `boolean` |  | When `true` indicates the test case supports dynamic assertions. |
| `enabled` | `boolean` |  | When `true` indicates the test definition is available for creating test cases. |
| `supportedServices` | `string[]` |  | List of services that this test definition supports. |
| `sqlExpression` | `sqlQuery` |  | SQL expression template for custom SQL-based test definitions. |
| `validatorClass` | `string` |  | Class name of the validator to use for this test definition. |

<!-- /standard -->
