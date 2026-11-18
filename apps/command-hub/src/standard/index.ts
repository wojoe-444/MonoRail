/**
 * The MonoRail standard: every entity type MonoRail knows, with its fields.
 * It is OpenMetadata v2.0.x (fields copied from 2.0.8) plus entity types of
 * MonoRail's own for things OpenMetadata has no word for. The one definition
 * is standard.json next to this file; docs/standard/ explains it, and its
 * field tables are generated from the same file (scripts/standard-docs.cjs).
 *
 * Explore builds its tree from CATEGORIES and ENTITY_TYPES, so every entity
 * type here is listed there.
 */
import data from './standard.json'

export type Origin = 'openmetadata' | 'monorail'

export interface StandardField {
  name: string
  /** OpenMetadata's type name (`uuid`, `entityReference`, `tagLabel[]`) or a plain one. */
  type: string
  required?: boolean
  description: string
}

export interface StandardCategory {
  id: string
  name: string
  origin: Origin
  summary: string
  /** Wiki page id under docs/, e.g. `standard/agents`. */
  docs: string
  /** OpenMetadata's page for an adopted category. */
  reference?: string
}

export interface EntityType {
  /** camelCase type name, as OpenMetadata writes it: `database`, `databaseSchema`, `subagent`. */
  type: string
  name: string
  plural: string
  category: string
  origin: Origin
  summary: string
  /** Wiki page id, optionally with an anchor: `standard/agents#flow`. */
  docs: string
  /** Where MonoRail keeps it (MonoRail's own types). */
  source?: string
  /** OpenMetadata's REST path (adopted types). */
  basePath?: string
  /** OpenMetadata's page (adopted types). */
  reference?: string
  fields: StandardField[]
}

interface Standard {
  version: number
  openMetadata: { version: string; pinned: string; docs: string }
  categories: StandardCategory[]
  byReference: { name: string; summary: string; reference: string }[]
  entities: EntityType[]
}

export const STANDARD = data as Standard
export const CATEGORIES: StandardCategory[] = STANDARD.categories
export const ENTITY_TYPES: EntityType[] = STANDARD.entities

const byType = new Map(ENTITY_TYPES.map((e) => [e.type, e]))
const byCategory = new Map(CATEGORIES.map((c) => [c.id, c]))

export function entityType(type: string): EntityType | undefined {
  return byType.get(type)
}

export function category(id: string): StandardCategory | undefined {
  return byCategory.get(id)
}

export function entityTypesIn(categoryId: string): EntityType[] {
  return ENTITY_TYPES.filter((e) => e.category === categoryId)
}

/**
 * The standard's field for a value's path in a record: "versions.0.name" is
 * the `versions` field. Undefined when the standard does not define it.
 */
export function standardField(type: string, path: string): StandardField | undefined {
  const top = path.split('.')[0]
  return byType.get(type)?.fields.find((f) => f.name === top)
}

/** A `docs` value as the wiki's page id and anchor, for `openWiki(id, anchor)`. */
export function docsTarget(docs: string): { id: string; anchor?: string } {
  const [id, anchor] = docs.split('#')
  return { id, anchor }
}
