---
audience: human, ai
summary: An ontology editing session: its operations and version guards. OpenMetadata's Ontology Change Set entity.
---

# Ontology Change Set

An ontology editing session: its operations and version guards. It is OpenMetadata's
[Ontology Change Set](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/ontologyChangeSet.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Ontology](README.md).

- **Type:** `ontologyChangeSet`
- **Required:** `id`, `name`, `displayName`, `fullyQualifiedName`, `description`, `state`, `operations`, `undoCursor`
- **API:** `/v1/ontologyChangeSets`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields ontologyChangeSet -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `displayName` | `string` | Yes | Display name that identifies this entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` | Yes | A unique name that identifies an entity. |
| `description` | `markdown` | Yes | Text in Markdown format. |
| `glossaries` | `entityReferenceList` |  | Ontology models affected by this change set. |
| `state` | `state` | Yes | (OpenMetadata gives no description for state.) |
| `operations` | `ontologyChangeOperation[]` | Yes | A typed, reversible operation in an ontology authoring session. |
| `undoCursor` | `integer` | Yes | Number of active operations at the current undo/redo position. |
| `reviewTask` | `entityReference` |  | Review task created when a suggester submits the change set. |
| `applicationResult` | `ontologyChangeApplicationResult` |  | Typed outcome of applying an ontology change set. |
| `owners` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `version` | `entityVersion` |  | Metadata version of the entity in the form `Major.Minor`. |
| `updatedAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | URI that points to a resource. |
| `changeDescription` | `changeDescription` |  | Description of the change. |
| `incrementalChangeDescription` | `changeDescription` |  | Description of the change. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `ontology` | `entityReference` |  | Native ontology scope. |
| `baseWorkingRevision` | `integer` |  | Native working revision against which all operations were proposed. |
| `sourcePack` | `ontologyPackSource` |  | Library pack selection this native change set installs. |

<!-- /standard -->
