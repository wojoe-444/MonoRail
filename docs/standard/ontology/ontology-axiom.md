---
audience: human, ai
summary: A governed OWL axiom. OpenMetadata's Ontology Axiom entity.
---

# Ontology Axiom

A governed OWL axiom. It is OpenMetadata's
[Ontology Axiom](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/ontologyAxiom.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Ontology](README.md).

- **Type:** `ontologyAxiom`
- **Required:** `id`, `name`, `displayName`, `fullyQualifiedName`, `description`, `ontology`, `axiomType`, `subjectIri`, `expressions`, `provenance`
- **API:** `/v1/ontologyAxioms`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields ontologyAxiom -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `displayName` | `string` | Yes | Display name that identifies this entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` | Yes | A unique name that identifies an entity. |
| `description` | `markdown` | Yes | Text in Markdown format. |
| `ontology` | `entityReference` | Yes | This schema defines the EntityReference type used for referencing an entity. |
| `axiomType` | `axiomType` | Yes | (OpenMetadata gives no description for axiomType.) |
| `subjectIri` | `ontologyIri` | Yes | Absolute semantic IRI, preserved exactly without URL normalization, case folding, or percent encoding. |
| `expressions` | `ontologyExpression[]` | Yes | Class expressions participating in the axiom, ordered from left to right. |
| `propertyIri` | `ontologyIri` |  | Absolute semantic IRI, preserved exactly without URL normalization, case folding, or percent encoding. |
| `targetIri` | `ontologyIri` |  | Absolute semantic IRI, preserved exactly without URL normalization, case folding, or percent encoding. |
| `literal` | `literal` |  | A typed OWL literal. |
| `provenance` | `provenance` | Yes | How this relation edge originated. |
| `owners` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `version` | `entityVersion` |  | Metadata version of the entity in the form `Major.Minor`. |
| `updatedAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | URI that points to a resource. |
| `changeDescription` | `changeDescription` |  | Description of the change. |
| `incrementalChangeDescription` | `changeDescription` |  | Description of the change. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |

<!-- /standard -->
