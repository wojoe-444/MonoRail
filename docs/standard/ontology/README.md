---
audience: human, ai
folder: Ontology
summary: Formal ontologies: concepts, properties, axioms, relationship types and releases.
---

# Ontology

Formal ontologies: concepts, properties, axioms, relationship types and releases. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)).

## Entity types

<!-- standard:entities ontology -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Ontology](ontology.md) | `ontology` | An independently governed ontology namespace. | `/v1/ontologies` |
| [Ontology Concept](ontology-concept.md) | `ontologyConcept` | A formal class or SKOS concept owned by an ontology. | `/v1/ontologyConcepts` |
| [Ontology Property](ontology-property.md) | `ontologyProperty` | A formal object, data or annotation property owned by an ontology. | `/v1/ontologyProperties` |
| [Ontology Axiom](ontology-axiom.md) | `ontologyAxiom` | A governed OWL axiom. | `/v1/ontologyAxioms` |
| [Ontology Change Set](ontology-change-set.md) | `ontologyChangeSet` | An ontology editing session: its operations and version guards. | `/v1/ontologyChangeSets` |
| [Ontology Release](ontology-release.md) | `ontologyRelease` | Sealed ontology content, reviewed through the approval workflow. | `/v1/ontologyReleases` |
| [Relationship Type](relationship-type.md) | `relationshipType` | An admin-governed kind of semantic relationship that ontologies use. | `/v1/relationshipTypes` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
