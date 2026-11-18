---
audience: human, ai
summary: An admin-governed kind of semantic relationship that ontologies use. OpenMetadata's Relationship Type entity.
---

# Relationship Type

An admin-governed kind of semantic relationship that ontologies use. It is OpenMetadata's
[Relationship Type](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/relationshipType.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Ontology](README.md).

- **Type:** `relationshipType`
- **Required:** `id`, `name`, `fullyQualifiedName`, `displayName`, `description`, `rdfPredicate`, `category`, `characteristics`, `crossGlossaryAllowed`, `paletteKey`, `systemDefined`
- **API:** `/v1/relationshipTypes`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields relationshipType -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Immutable API key for this relationship type. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` | Yes | A unique name that identifies an entity. |
| `displayName` | `string` | Yes | Display name that identifies this entity. |
| `description` | `markdown` | Yes | Text in Markdown format. |
| `iri` | `string` |  | IRI identifying the OWL object property. |
| `rdfPredicate` | `string` | Yes | Predicate emitted for authored relationship edges. |
| `category` | `category` | Yes | (OpenMetadata gives no description for category.) |
| `inverse` | `entityReference` |  | Inverse relationship type. |
| `domain` | `semanticReference[]` |  | Reference to a governed glossary term or an external semantic resource. |
| `range` | `semanticReference[]` |  | Reference to a governed glossary term or an external semantic resource. |
| `characteristics` | `characteristic[]` | Yes | (OpenMetadata gives no description for characteristics.) |
| `cardinality` | `cardinality` |  | (OpenMetadata gives no description for cardinality.) |
| `propertyChain` | `entityReference[]` |  | Ordered property chain whose composition implies this relationship type. |
| `disjointWith` | `entityReference[]` |  | Relationship types declared property-disjoint with this type. |
| `crossGlossaryAllowed` | `boolean` | Yes | (OpenMetadata gives no description for crossGlossaryAllowed.) |
| `paletteKey` | `paletteKey` | Yes | (OpenMetadata gives no description for paletteKey.) |
| `systemDefined` | `boolean` | Yes | System types can be updated but cannot be deleted. |
| `replacedBy` | `entityReference` |  | Replacement relationship type when this type is deprecated. |
| `entityStatus` | `status` |  | General lifecycle stage for entities that reference this vocabulary. |
| `owners` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `reviewers` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
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
