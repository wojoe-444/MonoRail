#!/usr/bin/env node
// Writes the generated parts of the MonoRail standard's wiki pages
// (docs/standard/) from src/standard/standard.json, the one definition of
// every entity type. A page marks each generated block with an HTML comment
// pair, which neither the wiki nor GitHub shows:
//
//   <!-- standard:fields database -->      the field table of one entity type
//   <!-- standard:entities databases -->   the entity types of one category
//   <!-- standard:categories -->           every category
//   <!-- standard:by-reference -->         OpenMetadata data assets not adopted yet
//   ...generated...
//   <!-- /standard -->
//
// Run from apps/command-hub:  node scripts/standard-docs.cjs   (--check only reports)
// electron/standard.test.cjs fails when a page is out of date.
const fs = require('node:fs')
const path = require('node:path')

const STANDARD = require('../src/standard/standard.json')
const DOCS = path.join(__dirname, '..', '..', '..', 'docs')
const BLOCK = /(<!-- standard:([a-z-]+)(?: ([A-Za-z]+))? -->\n)[\s\S]*?(<!-- \/standard -->)/g

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

/** Link from one doc to another doc id ("standard/agents#flow"), relative like every link in docs/. */
function linkTo(fromFile, docId) {
  const [id, anchor] = docId.split('#')
  const rel = path.relative(path.dirname(fromFile), path.join(DOCS, `${id}.md`)).replace(/\\/g, '/')
  return anchor ? `${rel}#${anchor}` : rel
}

function fieldTable(type) {
  const entity = STANDARD.entities.find((e) => e.type === type)
  if (!entity) throw new Error(`No entity type "${type}" in standard.json`)
  const rows = entity.fields.map((f) => `| \`${f.name}\` | \`${cell(f.type)}\` | ${f.required ? 'Yes' : ''} | ${cell(f.description)} |`)
  return ['| Field | Type | Required | Description |', '| --- | --- | --- | --- |', ...rows].join('\n')
}

function entityTable(file, category) {
  const entities = STANDARD.entities.filter((e) => e.category === category)
  if (!entities.length) throw new Error(`No entity types in category "${category}"`)
  const om = entities[0].origin === 'openmetadata'
  const rows = entities.map((e) =>
    om
      ? `| [${e.name}](${linkTo(file, e.docs)}) | \`${e.type}\` | ${cell(e.summary)} | \`${e.basePath}\` |`
      : `| [${e.name}](${linkTo(file, e.docs)}) | \`${e.type}\` | ${cell(e.summary)} | ${cell(e.source)} |`,
  )
  return [`| Entity | Type | What it is | ${om ? 'Base path' : 'In MonoRail'} |`, '| --- | --- | --- | --- |', ...rows].join('\n')
}

function categoryTable(file) {
  const rows = STANDARD.categories.map((c) => {
    const names = STANDARD.entities.filter((e) => e.category === c.id).map((e) => e.name).join(', ')
    const origin = c.origin === 'openmetadata' ? `OpenMetadata ${STANDARD.openMetadata.version}` : 'MonoRail'
    return `| [${c.name}](${linkTo(file, c.docs)}) | ${cell(c.summary)} | ${cell(names)} | ${origin} |`
  })
  return ['| Category | What it covers | Entity types | Defined by |', '| --- | --- | --- | --- |', ...rows].join('\n')
}

function byReferenceTable() {
  const rows = STANDARD.byReference.map((r) => `| [${r.name}](${r.reference}) | ${cell(r.summary)} |`)
  return ['| Category | What it covers |', '| --- | --- |', ...rows].join('\n')
}

function render(file, text) {
  return text.replace(BLOCK, (_, open, kind, arg, close) => {
    const body =
      kind === 'fields' ? fieldTable(arg)
      : kind === 'entities' ? entityTable(file, arg)
      : kind === 'categories' ? categoryTable(file)
      : kind === 'by-reference' ? byReferenceTable()
      : null
    if (body == null) throw new Error(`${path.relative(DOCS, file)}: unknown block "standard:${kind}"`)
    return `${open}\n${body}\n\n${close}`
  })
}

function standardDocs() {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : []
    })
  return walk(path.join(DOCS, 'standard'))
}

/** Every page whose generated blocks are out of date: [{ file, text, next }]. */
function stale() {
  return standardDocs().flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const next = render(file, text)
    return next === text ? [] : [{ file, text, next }]
  })
}

module.exports = { STANDARD, DOCS, stale, render, standardDocs }

if (require.main === module) {
  const check = process.argv.includes('--check')
  const out = stale()
  for (const s of out) {
    console.log(`${check ? 'stale' : 'wrote'}: docs/${path.relative(DOCS, s.file).replace(/\\/g, '/')}`)
    if (!check) fs.writeFileSync(s.file, s.next)
  }
  if (!out.length) console.log('The standard\'s pages are up to date.')
  if (check && out.length) process.exitCode = 1
}
