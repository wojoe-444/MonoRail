---
audience: human, ai
summary: A formal object, data or annotation property owned by an ontology. OpenMetadata's Ontology Property entity.
---

# Ontology Property

A formal object, data or annotation property owned by an ontology. It is OpenMetadata's
[Ontology Property](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/ontologyProperty.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Ontology](README.md).

- **Type:** `ontologyProperty`
- **Required:** `id`, `name`, `fullyQualifiedName`, `ontology`, `iri`, `kind`
- **API:** `/v1/ontologyProperties`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields ontologyProperty -->

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
| `kind` | `kind` | Yes | (OpenMetadata gives no description for kind.) |
| `domain` | `ontologyIri[]` |  | Semantic IRIs of the classes in the property domain. |
| `range` | `ontologyIri[]` |  | Semantic IRIs of range classes or datatypes. |
| `enumValues` | `literal[]` |  | Allowed typed values for a DATA property, projected as an OWL data enumeration. |
| `unit` | `string` |  | Unit IRI or display symbol for a DATA property, retained as an annotation without implying conversion. |
| `isIdentifier` | `boolean` |  | Identifier intent for a DATA property. |
| `inverse` | `ontologyIri` |  | Semantic IRI of the inverse object property. |
| `characteristics` | `characteristic[]` |  | (OpenMetadata gives no description for characteristics.) |
| `propertyChain` | `ontologyIri[]` |  | Ordered object-property IRIs whose composition implies this property. |
| `disjointWith` | `ontologyIri[]` |  | Semantic IRIs of properties disjoint with this property. |
| `superProperties` | `ontologyIri[]` |  | Semantic IRIs of the named properties this property specializes (rdfs:subPropertyOf). |
| `deprecated` | `boolean` |  | A deprecated definition stays resolvable for existing references but should not be used for new ones. |
| `replacedBy` | `ontologyIri` |  | IRI of the property in the same ontology that replaces this one. |

<!-- /standard -->
