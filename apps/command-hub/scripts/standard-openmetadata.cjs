#!/usr/bin/env node
// Refreshes the OpenMetadata half of the MonoRail standard
// (src/standard/standard.json) from OpenMetadata's own JSON schemas.
//
//   node scripts/standard-openmetadata.cjs <OpenMetadata checkout> [--check]
//
// The checkout only needs openmetadata-spec/src/main/resources/json/schema, at
// the tag named in standard.json's openMetadata.pinned, e.g.
//   git clone --filter=blob:none --sparse --depth 1 --branch 2.1.0-rc2-release https://github.com/open-metadata/OpenMetadata.git
//   git -C OpenMetadata sparse-checkout set --no-cone openmetadata-spec/src/main/resources/json/schema/
//
// For every OpenMetadata entity type in standard.json it rewrites `fields`
// from the entity's `schema` file. It also lists the entity schemas (a
// top-level `javaInterfaces` naming an EntityInterface) that standard.json
// does not have yet, and the entries whose schema is gone, so a version bump
// shows what to adopt. For each enum type MonoRail extends (`enums`), it
// rewrites OpenMetadata's values from the schema and lists MonoRail values
// OpenMetadata has since added. Categories, names, summaries, pages and
// MonoRail's enum values are edited by hand; afterwards run
// node scripts/standard-docs.cjs for the wiki tables.
const fs = require('node:fs')
const path = require('node:path')

const STANDARD_FILE = path.join(__dirname, '..', 'src', 'standard', 'standard.json')
const SCHEMA_DIR = path.join('openmetadata-spec', 'src', 'main', 'resources', 'json', 'schema')

/** Descriptions for fields OpenMetadata leaves without one. */
const FALLBACK = {
  connection: 'How to connect to the service. Secrets in it are never shown.',
  style: 'Color and icon for the entity in the UI.',
  certification: "The asset's certification: a tag from the Certification classification, with when it was applied and when it expires.",
  tableType: 'Regular, External, View, SecureView, MaterializedView, Iceberg, Local, Partitioned, Foreign, Transient, Dynamic or Stream.',
  tablePartition: 'How the table is partitioned: columns, interval type and interval.',
  tableSharding: 'How the table is sharded, for sharded tables (for example BigQuery date-sharded tables).',
  // Common entity fields, worded as the other entities word them.
  displayName: 'Display name that identifies this entity.',
  updatedBy: 'User who made the update.',
  deleted: 'When `true` indicates the entity has been soft deleted.',
  sourceHash: 'Source hash of the entity.',
}

function typeOf(p) {
  if (!p) return 'any'
  if (p.$ref) return p.$ref.replace(/^.*#\/definitions\//, '').replace(/^.*\//, '').replace(/\.json$/, '')
  if (p.type === 'array') return typeOf(p.items) + '[]'
  if (p.enum) return 'enum'
  const alt = p.oneOf || p.anyOf
  if (alt) return alt.map(typeOf).join(' | ')
  return Array.isArray(p.type) ? p.type.join(' | ') : p.type || 'object'
}

function firstSentence(d) {
  if (!d) return ''
  const s = String(d).replace(/\s+/g, ' ').trim()
  const m = /^(.+?[.!?])(\s|$)/.exec(s)
  return m ? m[1] : s
}

function readSchema(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, SCHEMA_DIR, file), 'utf8'))
}

/**
 * A property's description, or else the description of the type it refers
 * to ($ref to a local definition or another schema file, also through array
 * items and oneOf/anyOf). `at` is { root, file } of the schema that holds it.
 */
function describe(p, schema, at, seen = new Set()) {
  if (!p) return ''
  if (p.description) return p.description
  const ref = p.$ref ?? p.items?.$ref ?? (p.oneOf || p.anyOf || []).find((x) => x.$ref)?.$ref
  if (!ref || seen.has(at.file + ref)) return ''
  seen.add(at.file + ref)
  const [file, pointer] = ref.split('#')
  let target = schema
  let next = at
  if (file) {
    if (!at.root) return ''
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(at.file), file))
    try { target = readSchema(at.root, rel) } catch { return '' }
    next = { root: at.root, file: rel }
  }
  const def = pointer ? pointer.split('/').filter(Boolean).reduce((o, k) => o?.[k], target) : target
  return describe(def, target, next, seen)
}

function fieldsOf(schema, at = {}) {
  const required = new Set(schema.required || [])
  return Object.entries(schema.properties || {}).map(([name, p]) => ({
    name,
    type: typeOf(p),
    ...(required.has(name) ? { required: true } : {}),
    description: firstSentence(describe(p, schema, at)) || FALLBACK[name] || `(OpenMetadata gives no description for ${name}.)`,
  }))
}

/** Every entity schema in the checkout: [{ file, schema }]. */
function entitySchemas(root) {
  const base = path.join(root, SCHEMA_DIR)
  const out = []
  ;(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== 'api') walk(p); continue }
      if (!e.name.endsWith('.json')) continue
      let schema
      try { schema = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { continue }
      const ifaces = (schema.javaInterfaces || []).filter((i) => /EntityInterface/.test(i) && !/ServiceConnectionEntityInterface/.test(i))
      if (ifaces.length && schema.properties) out.push({ file: path.relative(base, p).split(path.sep).join('/'), schema })
    }
  })(base)
  return out
}

module.exports = { typeOf, firstSentence, fieldsOf, readSchema, entitySchemas, STANDARD_FILE }

if (require.main === module) {
  const root = process.argv[2]
  const check = process.argv.includes('--check')
  if (!root || !fs.existsSync(path.join(root, SCHEMA_DIR))) {
    console.error(`Usage: node scripts/standard-openmetadata.cjs <OpenMetadata checkout> [--check]\nNo ${SCHEMA_DIR} under ${root ?? '(none)'}.`)
    process.exit(2)
  }
  const standard = JSON.parse(fs.readFileSync(STANDARD_FILE, 'utf8'))
  const adopted = standard.entities.filter((e) => e.origin === 'openmetadata')
  let changed = 0
  const gone = []
  for (const e of adopted) {
    if (!fs.existsSync(path.join(root, SCHEMA_DIR, e.schema))) { gone.push(`${e.type} (${e.schema})`); continue }
    const fields = fieldsOf(readSchema(root, e.schema), { root, file: e.schema })
    if (JSON.stringify(fields) !== JSON.stringify(e.fields)) { changed++; e.fields = fields }
  }
  // Enum types MonoRail extends: OpenMetadata's own values come from the schema;
  // a MonoRail value OpenMetadata now has too should move to OpenMetadata's (rule 5).
  const taken = []
  for (const [name, e] of Object.entries(standard.enums ?? {})) {
    if (!fs.existsSync(path.join(root, SCHEMA_DIR, e.schema))) { gone.push(`enum ${name} (${e.schema})`); continue }
    const values = readSchema(root, e.schema).definitions?.[e.definition]?.enum
    if (!Array.isArray(values)) { gone.push(`enum ${name} (${e.schema}#/definitions/${e.definition})`); continue }
    if (JSON.stringify(values) !== JSON.stringify(e.openMetadata)) { changed++; e.openMetadata = values }
    const has = new Set(values.map((v) => String(v).toLowerCase()))
    for (const v of e.monorail) if (has.has(v.value.toLowerCase())) taken.push(`${name}: ${v.value}`)
  }
  const known = new Set(adopted.map((e) => e.schema))
  const missing = entitySchemas(root).filter((s) => !known.has(s.file)).map((s) => s.file)
  console.log(`${adopted.length} OpenMetadata entity types; ${changed} with changed fields.`)
  if (missing.length) console.log(`Entity schemas not in the standard yet:\n  ${missing.join('\n  ')}`)
  if (gone.length) console.log(`Entries whose schema is gone:\n  ${gone.join('\n  ')}`)
  if (taken.length) console.log(`MonoRail enum values OpenMetadata now has too (use OpenMetadata's, drop MonoRail's entry):\n  ${taken.join('\n  ')}`)
  if (!check && changed) fs.writeFileSync(STANDARD_FILE, JSON.stringify(standard, null, 2) + '\n')
  if (check && (changed || missing.length || gone.length || taken.length)) process.exitCode = 1
}
