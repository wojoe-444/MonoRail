---
audience: human, ai
summary: A formal class or SKOS concept owned by an ontology. OpenMetadata's Ontology Concept entity.
---

# Ontology Concept

A formal class or SKOS concept owned by an ontology. It is OpenMetadata's
[Ontology Concept](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/ontologyConcept.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Ontology](README.md).

- **Type:** `ontologyConcept`
- **Required:** `id`, `name`, `fullyQualifiedName`, `ontology`, `iri`, `conceptType`
- **API:** `/v1/ontologyConcepts`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields ontologyConcept -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `displayName` | `string` |  | Display name that identifies this entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` | Yes | A unique name that identifies an entity. |
| `description` | `markdown` |  | Text in Markdown format. |
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
| `ontology` | `entityReference` | Yes | Owning ontology entity. |
| `iri` | `ontologyIri` | Yes | Persisted semantic IRI. |
| `conceptType` | `ontologyConceptType` | Yes | Vocabulary a source ontology used to assert a concept. |
| `synonyms` | `string[]` |  | (OpenMetadata gives no description for synonyms.) |
| `conceptMappings` | `conceptMapping[]` |  | Mapping from an ontology term to an external concept. |
| `abstract` | `boolean` |  | An abstract class has no direct instances; data is classified by its subclasses. |
| `definitionSource` | `ontologyIri` |  | IRI of the document or standard this definition is taken from. |
| `deprecated` | `boolean` |  | A deprecated definition stays resolvable for existing references but should not be used for new ones. |
| `replacedBy` | `ontologyIri` |  | IRI of the concept in the same ontology that replaces this one. |
| `superClasses` | `ontologyIri[]` |  | Direct named superclasses, derived from non-deleted ontology-owned SUBCLASS_OF axioms. |
| `subClasses` | `ontologyIri[]` |  | Direct named subclasses, derived from non-deleted ontology-owned SUBCLASS_OF axioms. |
| `lifecycleStatus` | `ontologyDefinitionStatus` |  | Release review state of this concept, derived by the server from ontology releases. |

<!-- /standard -->
