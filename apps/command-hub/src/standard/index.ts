/**
 * The MonoRail standard: every entity type MonoRail knows, with its fields.
 * It is every entity type of OpenMetadata 2.1 (fields copied from the
 * 2.1.0-rc2 schemas by scripts/standard-openmetadata.cjs) plus entity types of
 * MonoRail's own for things OpenMetadata has no word for. The one definition
 * is standard.json next to this file; docs/standard/ explains it, and its
 * field tables are generated from the same file (scripts/standard-docs.cjs).
 *
 * Explore builds its tree from SECTIONS, CATEGORIES and ENTITY_TYPES, so every
 * entity type here is listed there.
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

/** A group of categories: MonoRail, Data assets, Governance, ... */
export interface StandardSection {
  id: string
  name: string
}

export interface StandardCategory {
  id: string
  name: string
  section: string
  origin: Origin
  summary: string
  /** Wiki page id under docs/, e.g. `standard/monorail/agents`. */
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
  /** Wiki page id, optionally with an anchor: `standard/monorail/agents#flow`. */
  docs: string
  /** Where MonoRail keeps it (MonoRail's own types). */
  source?: string
  /** OpenMetadata's REST path (adopted types). */
  basePath?: string
  /** OpenMetadata's page, or its schema on GitHub (adopted types). */
  reference?: string
  /** Its JSON schema file under OpenMetadata's json/schema folder (adopted types). */
  schema?: string
  /** The OpenMetadata version that added it, when that is newer than 2.0 (an older server lacks it). */
  since?: string
  fields: StandardField[]
}

/** A value MonoRail adds to one of OpenMetadata's enum types (rule 5 in docs/standard/README.md). */
export interface MonoRailEnumValue {
  value: string
  summary: string
  /** Wiki page id that explains it. */
  docs: string
}

/**
 * An OpenMetadata enum type that MonoRail extends: OpenMetadata's own values
 * (from its schema, refreshed by scripts/standard-openmetadata.cjs) plus
 * MonoRail's additions. Enum types MonoRail does not extend are not listed.
 */
export interface StandardEnum {
  /** The schema file that defines it, under OpenMetadata's json/schema folder. */
  schema: string
  /** Its name under that schema's `definitions`. */
  definition: string
  openMetadata: string[]
  monorail: MonoRailEnumValue[]
}

export interface AllowedValue {
  value: string
  origin: Origin
  summary?: string
  docs?: string
}

interface Standard {
  version: number
  openMetadata: { version: string; pinned: string; docs: string }
  sections: StandardSection[]
  categories: StandardCategory[]
  entities: EntityType[]
  enums: Record<string, StandardEnum>
}

export const STANDARD = data as Standard
export const ENUMS: Record<string, StandardEnum> = STANDARD.enums

/** Every allowed value of an enum type MonoRail extends (OpenMetadata's first), or undefined for any other type. */
export function allowedValues(type: string): AllowedValue[] | undefined {
  const e = Object.hasOwn(ENUMS, type) ? ENUMS[type] : undefined
  if (!e) return undefined
  return [...e.openMetadata.map((value) => ({ value, origin: 'openmetadata' as const })), ...e.monorail.map((v) => ({ ...v, origin: 'monorail' as const }))]
}
export const SECTIONS: StandardSection[] = STANDARD.sections
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

export function categoriesIn(sectionId: string): StandardCategory[] {
  return CATEGORIES.filter((c) => c.section === sectionId)
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
