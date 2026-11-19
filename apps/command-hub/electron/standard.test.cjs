// The MonoRail standard (src/standard/standard.json, docs/standard/): every
// entity type has a page and a generated field table that is up to date,
// MonoRail's own types never take an OpenMetadata name, and Explore only
// lists entity types from the standard.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { STANDARD, DOCS, stale } = require('../scripts/standard-docs.cjs')

const slug = (text) => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')
function page(docId) {
  const [id, anchor] = docId.split('#')
  const file = path.join(DOCS, `${id}.md`)
  return { file, anchor, text: fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : undefined }
}
const anchors = (text) => new Set([...text.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1].replace(/`/g, ''))))

// Names OpenMetadata uses for records that are not entity types here (results,
// runs, feed items). MonoRail's own types must not take these either, nor the
// name of any OpenMetadata entity type in standard.json.
const OPENMETADATA_RESERVED = [
  'conversation', 'thread', 'suggestion', 'testCaseResult', 'testCaseResolutionStatus', 'testCaseDimensionResult',
  'agentExecution', 'mcpExecution', 'queryCostRecord', 'tableColumn', 'dashboardDataModelColumn', 'entityProfile',
  'pipelineExecution', 'workflowInstance', 'workflowInstanceState', 'auditLog', 'api', 'policies', 'dataContractResult',
  'recognizerFeedback', 'entityReportData', 'rawCostAnalysisReportData', 'rdf',
]

test('sections, categories and entity types fit together', () => {
  const sections = new Set(STANDARD.sections.map((s) => s.id))
  assert.deepEqual(STANDARD.categories.filter((c) => !sections.has(c.section)).map((c) => c.id), [], 'categories in an unknown section')
  assert.deepEqual(STANDARD.sections.filter((s) => !STANDARD.categories.some((c) => c.section === s.id)).map((s) => s.id), [], 'empty sections')
  for (const c of STANDARD.categories) assert.equal(c.origin, c.section === 'monorail' ? 'monorail' : 'openmetadata', `${c.id}: origin follows its section`)
  for (const e of STANDARD.entities) assert.equal(e.origin, STANDARD.categories.find((c) => c.id === e.category)?.origin, `${e.type}: origin follows its category`)
})

test('entity types are unique, camelCase and in a known category', () => {
  const types = STANDARD.entities.map((e) => e.type)
  assert.deepEqual(types.filter((t, i) => types.indexOf(t) !== i), [], 'duplicate entity types')
  assert.deepEqual(types.filter((t) => !/^[a-z][A-Za-z]*$/.test(t)), [], 'entity types are camelCase')
  const cats = new Set(STANDARD.categories.map((c) => c.id))
  assert.deepEqual(STANDARD.entities.filter((e) => !cats.has(e.category)).map((e) => e.type), [])
  assert.deepEqual(STANDARD.categories.filter((c) => !STANDARD.entities.some((e) => e.category === c.id)).map((c) => c.id), [], 'empty categories')
})

test("MonoRail's own entity types never reuse an OpenMetadata name", () => {
  const taken = new Set([...STANDARD.entities.filter((e) => e.origin === 'openmetadata').map((e) => e.type), ...OPENMETADATA_RESERVED].map((n) => n.toLowerCase()))
  const clash = STANDARD.entities.filter((e) => e.origin === 'monorail' && taken.has(e.type.toLowerCase())).map((e) => e.type)
  assert.deepEqual(clash, [])
})

test('every entity type has what its origin needs and well-formed fields', () => {
  for (const e of STANDARD.entities) {
    for (const k of ['name', 'plural', 'summary', 'docs']) assert.ok(e[k], `${e.type}: ${k}`)
    if (e.origin === 'openmetadata') {
      if (e.basePath !== undefined) assert.match(e.basePath, /^\/v1\/[A-Za-z/]+$/, `${e.type}: basePath`)
      assert.match(e.schema ?? '', /^[A-Za-z/]+\.json$/, `${e.type}: schema`)
      const tag = `${STANDARD.openMetadata.pinned}-release`
      const docs = e.reference?.startsWith('https://docs.open-metadata.org/v2.1.x-SNAPSHOT/')
      const schemaUrl = e.reference === `https://github.com/open-metadata/OpenMetadata/blob/${tag}/openmetadata-spec/src/main/resources/json/schema/${e.schema}`
      assert.ok(docs || schemaUrl, `${e.type}: reference is OpenMetadata's 2.1 docs or its schema at ${tag}`)
    } else {
      assert.equal(e.origin, 'monorail', `${e.type}: origin`)
      assert.ok(e.source, `${e.type}: source`)
    }
    assert.ok(e.fields.length, `${e.type}: fields`)
    const names = e.fields.map((f) => f.name)
    assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), [], `${e.type}: duplicate fields`)
    for (const f of e.fields) assert.ok(f.name && f.type && f.description, `${e.type}.${f.name}`)
  }
})

test('every category and entity type has its page, heading and field table', () => {
  const problems = []
  for (const c of STANDARD.categories) if (!page(c.docs).text) problems.push(`${c.id}: no page docs/${c.docs}.md`)
  for (const e of STANDARD.entities) {
    const p = page(e.docs)
    if (!p.text) { problems.push(`${e.type}: no page docs/${e.docs.split('#')[0]}.md`); continue }
    if (p.anchor && !anchors(p.text).has(p.anchor)) problems.push(`${e.type}: no heading #${p.anchor}`)
    if (!p.text.includes(`<!-- standard:fields ${e.type} -->`)) problems.push(`${e.type}: no <!-- standard:fields ${e.type} --> block`)
  }
  assert.deepEqual(problems, [])
})

test("the standard's pages are up to date (node scripts/standard-docs.cjs)", () => {
  assert.deepEqual(stale().map((s) => path.relative(DOCS, s.file)), [])
})

test('Explore lists entity types from the standard only, and builds its tree from it', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'explore', 'ExplorePage.tsx'), 'utf8')
  const types = new Set(STANDARD.entities.map((e) => e.type))
  const used = [...src.matchAll(/\bentry\('([A-Za-z]+)'/g)].map((m) => m[1])
  assert.ok(used.length > 0)
  assert.deepEqual(used.filter((t) => !types.has(t)), [], 'entry() types missing from standard.json')
  assert.match(src, /SECTIONS\.map\(/, 'the tree lists every section')
  assert.match(src, /categoriesIn\(/, 'the tree lists every category of a section')
  assert.match(src, /entityTypesIn\(/, 'the tree lists every entity type of a category')
})

test("the OpenMetadata page reads every OpenMetadata type at the standard's REST path", () => {
  const { TYPES } = require('./modules/openmetadata.cjs')
  const expected = Object.fromEntries(
    STANDARD.entities.filter((e) => e.origin === 'openmetadata' && e.basePath).map((e) => [e.type, e.basePath.replace(/^\/v1\//, '')]),
  )
  assert.deepEqual({ ...TYPES }, expected)
})

test("enum types MonoRail extends: OpenMetadata's values plus MonoRail's own, never the same value twice", () => {
  const fieldTypes = new Set(STANDARD.entities.filter((e) => e.origin === 'openmetadata').flatMap((e) => e.fields.map((f) => f.type)))
  assert.ok(Object.keys(STANDARD.enums ?? {}).length > 0, 'standard.json has an enums section')
  for (const [name, e] of Object.entries(STANDARD.enums)) {
    assert.ok(fieldTypes.has(name), `${name}: a field of an OpenMetadata entity type has this type`)
    assert.ok(e.schema && e.definition, `${name}: names the schema and definition it comes from`)
    assert.ok(Array.isArray(e.openMetadata) && e.openMetadata.length, `${name}: lists OpenMetadata's values`)
    assert.ok(Array.isArray(e.monorail) && e.monorail.length, `${name}: is listed only because MonoRail adds a value`)
    const om = new Set(e.openMetadata.map((v) => v.toLowerCase()))
    const seen = new Set()
    for (const v of e.monorail) {
      assert.ok(!om.has(v.value.toLowerCase()), `${name}: ${v.value} is already OpenMetadata's; use theirs`)
      assert.ok(!seen.has(v.value.toLowerCase()), `${name}: ${v.value} twice`)
      seen.add(v.value.toLowerCase())
      assert.ok(v.summary && v.summary.length > 20, `${name}: ${v.value} needs a summary`)
      assert.ok(page(v.docs).text, `${name}: ${v.value} links to docs/${v.docs}.md`)
    }
  }
})

test('a data-service connector names an allowed service type for its category', () => {
  const { CONNECTORS } = require('./connections/index.cjs')
  for (const c of CONNECTORS.filter((x) => x.service)) {
    const type = STANDARD.entities.find((e) => e.type === c.service.category)?.fields.find((f) => f.name === 'serviceType')?.type
    assert.ok(type, `${c.kind}: ${c.service.category} has a serviceType field`)
    const e = STANDARD.enums[type]
    if (!e) continue // an enum MonoRail does not extend; its values are not recorded here
    const allowed = [...e.openMetadata, ...e.monorail.map((v) => v.value)]
    assert.ok(allowed.includes(c.service.serviceType), `${c.kind}: ${c.service.serviceType} is not an allowed ${type} (${allowed.join(', ')})`)
  }
})
