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

// OpenMetadata 2.0 entity type names. MonoRail's own types must not reuse
// them for something else (that is why the semantic metric is semanticMetric).
const OPENMETADATA_TYPES = [
  'table', 'database', 'databaseSchema', 'databaseService', 'storedProcedure', 'dashboard', 'chart', 'dashboardDataModel',
  'dashboardService', 'pipeline', 'pipelineService', 'topic', 'messagingService', 'mlmodel', 'mlmodelService', 'container',
  'storageService', 'searchIndex', 'searchService', 'apiCollection', 'apiEndpoint', 'apiService', 'metric', 'query',
  'glossary', 'glossaryTerm', 'classification', 'tag', 'domain', 'dataProduct', 'dataContract', 'user', 'team', 'role',
  'policy', 'bot', 'testCase', 'testSuite', 'testDefinition', 'ingestionPipeline', 'report', 'kpi', 'persona', 'type',
  'document', 'page', 'workflow', 'directory', 'file', 'spreadsheet', 'worksheet', 'metadataService',
]

test('entity types are unique, camelCase and in a known category', () => {
  const types = STANDARD.entities.map((e) => e.type)
  assert.deepEqual(types.filter((t, i) => types.indexOf(t) !== i), [], 'duplicate entity types')
  assert.deepEqual(types.filter((t) => !/^[a-z][A-Za-z]*$/.test(t)), [], 'entity types are camelCase')
  const cats = new Set(STANDARD.categories.map((c) => c.id))
  assert.deepEqual(STANDARD.entities.filter((e) => !cats.has(e.category)).map((e) => e.type), [])
  assert.deepEqual(STANDARD.categories.filter((c) => !STANDARD.entities.some((e) => e.category === c.id)).map((c) => c.id), [], 'empty categories')
})

test("MonoRail's own entity types never reuse an OpenMetadata name", () => {
  const clash = STANDARD.entities.filter((e) => e.origin === 'monorail' && OPENMETADATA_TYPES.includes(e.type)).map((e) => e.type)
  assert.deepEqual(clash, [])
})

test('every entity type has what its origin needs and well-formed fields', () => {
  for (const e of STANDARD.entities) {
    for (const k of ['name', 'plural', 'summary', 'docs']) assert.ok(e[k], `${e.type}: ${k}`)
    if (e.origin === 'openmetadata') {
      assert.match(e.basePath ?? '', /^\/v1\//, `${e.type}: basePath`)
      assert.match(e.reference ?? '', /^https:\/\/docs\.open-metadata\.org\/v2\.0\.x\//, `${e.type}: reference`)
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
  assert.match(src, /CATEGORIES\.map\(/, 'the tree lists every category')
  assert.match(src, /entityTypesIn\(/, 'the tree lists every entity type of a category')
})
