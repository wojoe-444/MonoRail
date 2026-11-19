#!/usr/bin/env node
// Writes the generated parts of the MonoRail standard's wiki pages
// (docs/standard/) from src/standard/standard.json, the one definition of
// every entity type. A page marks each generated block with an HTML comment
// pair, which neither the wiki nor GitHub shows:
//
//   <!-- standard:fields database -->      the field table of one entity type
//   <!-- standard:entities databases -->   the entity types of one category
//   <!-- standard:categories -->           every category, by section
//   <!-- standard:categories data-assets --> the categories of one section
//   <!-- standard:enum metadataServiceType --> allowed values of an enum MonoRail extends
//   ...generated...
//   <!-- /standard -->
//
// Run from apps/command-hub:  node scripts/standard-docs.cjs   (--check only reports)
// electron/standard.test.cjs fails when a page is out of date.
const fs = require('node:fs')
const path = require('node:path')

const STANDARD = require('../src/standard/standard.json')
const DOCS = path.join(__dirname, '..', '..', '..', 'docs')
const BLOCK = /(<!-- standard:([a-z-]+)(?: ([A-Za-z-]+))? -->\n)[\s\S]*?(<!-- \/standard -->)/g

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

/** Link from one doc to another doc id ("standard/monorail/agents#flow"), relative like every link in docs/. */
function linkTo(fromFile, docId) {
  const [id, anchor] = docId.split('#')
  const rel = path.relative(path.dirname(fromFile), path.join(DOCS, `${id}.md`)).replace(/\\/g, '/')
  return anchor ? `${rel}#${anchor}` : rel
}

function fieldTable(type) {
  const entity = STANDARD.entities.find((e) => e.type === type)
  if (!entity) throw new Error(`No entity type "${type}" in standard.json`)
  const rows = entity.fields.map((f) => `| \`${f.name}\` | \`${cell(f.type)}\` | ${f.required ? 'Yes' : ''} | ${cell(f.description)}${addedValues(f.type)} |`)
  return ['| Field | Type | Required | Description |', '| --- | --- | --- | --- |', ...rows].join('\n')
}

/** For a field whose type MonoRail extends: the values it adds, after the description. */
function addedValues(type) {
  const e = STANDARD.enums?.[type]
  return e?.monorail?.length ? ` MonoRail adds ${e.monorail.map((v) => `\`${v.value}\``).join(', ')}.` : ''
}

/** Every allowed value of an enum type MonoRail extends: OpenMetadata's, then MonoRail's. */
function enumTable(file, type) {
  const e = STANDARD.enums?.[type]
  if (!e) throw new Error(`No enum "${type}" in standard.json's enums`)
  const rows = [
    ...e.openMetadata.map((v) => `| \`${v}\` | OpenMetadata ${STANDARD.openMetadata.version} | |`),
    ...e.monorail.map((v) => `| \`${v.value}\` | MonoRail | ${cell(v.summary)} [More](${linkTo(file, v.docs)}) |`),
  ]
  return ['| Value | Defined by | What it is |', '| --- | --- | --- |', ...rows].join('\n')
}

function entityTable(file, category) {
  const entities = STANDARD.entities.filter((e) => e.category === category)
  if (!entities.length) throw new Error(`No entity types in category "${category}"`)
  const om = entities[0].origin === 'openmetadata'
  const rows = entities.map((e) =>
    om
      ? `| [${e.name}](${linkTo(file, e.docs)}) | \`${e.type}\` | ${cell(e.summary)} | ${e.basePath ? `\`${e.basePath}\`` : 'none of its own'} |`
      : `| [${e.name}](${linkTo(file, e.docs)}) | \`${e.type}\` | ${cell(e.summary)} | ${cell(e.source)} |`,
  )
  return [`| Entity | Type | What it is | ${om ? 'Base path' : 'In MonoRail'} |`, '| --- | --- | --- | --- |', ...rows].join('\n')
}

/** The categories of one section, or of every section (then with a Section column). */
function categoryTable(file, section) {
  const sectionName = (id) => STANDARD.sections.find((s) => s.id === id)?.name ?? id
  if (section && !STANDARD.sections.some((s) => s.id === section)) throw new Error(`No section "${section}" in standard.json`)
  const rows = STANDARD.categories.filter((c) => !section || c.section === section).map((c) => {
    const names = STANDARD.entities.filter((e) => e.category === c.id).map((e) => e.name).join(', ')
    const origin = c.origin === 'openmetadata' ? `OpenMetadata ${STANDARD.openMetadata.version}` : 'MonoRail'
    return section
      ? `| [${c.name}](${linkTo(file, c.docs)}) | ${cell(c.summary)} | ${cell(names)} |`
      : `| ${sectionName(c.section)} | [${c.name}](${linkTo(file, c.docs)}) | ${cell(c.summary)} | ${cell(names)} | ${origin} |`
  })
  return section
    ? ['| Category | What it covers | Entity types |', '| --- | --- | --- |', ...rows].join('\n')
    : ['| Section | Category | What it covers | Entity types | Defined by |', '| --- | --- | --- | --- | --- |', ...rows].join('\n')
}

function render(file, text) {
  return text.replace(BLOCK, (_, open, kind, arg, close) => {
    const body =
      kind === 'fields' ? fieldTable(arg)
      : kind === 'entities' ? entityTable(file, arg)
      : kind === 'categories' ? categoryTable(file, arg)
      : kind === 'enum' ? enumTable(file, arg)
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
