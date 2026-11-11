// Every page in docs/ says who it is written for, because the in-app wiki
// (src/modules/wiki) filters on it: "human" pages are plain-language guides,
// "ai" pages are reference for agents and developers. Links between docs must
// also resolve, so a guide never sends someone to a missing page.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const DOCS = path.join(__dirname, '..', '..', '..', 'docs')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : []
  })
}

const files = walk(DOCS)

test('every doc has front matter with an audience of human and/or ai', () => {
  const bad = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text)
    const line = m && /^audience:\s*(.*)$/m.exec(m[1])
    const words = line ? line[1].replace(/[[\]]/g, '').toLowerCase().split(/[\s,]+/).filter(Boolean) : []
    if (!words.length || words.some((w) => w !== 'human' && w !== 'ai')) bad.push(path.relative(DOCS, file))
  }
  assert.deepEqual(bad, [], 'add "---\\naudience: human, ai\\n---" (one or both) at the top of these docs')
})

test('every doc has a "# " title after its front matter', () => {
  const bad = files.filter((f) => !/^# .+$/m.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(DOCS, f))
  assert.deepEqual(bad, [])
})

/** GitHub's heading anchors, as the wiki makes them (content.ts slug). */
function slug(text) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')
}

function anchorsOf(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  return new Set([...text.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1].replace(/`/g, ''))))
}

/** Every link from one doc to another: [{ from, href, to, anchor }]. */
const links = files.flatMap((file) => {
  const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)].flatMap(([, href]) => {
    if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return []
    const [rel, anchor] = href.split('#')
    if (!rel.endsWith('.md')) return []
    return [{ from: file, href, to: path.resolve(path.dirname(file), rel), anchor }]
  })
})

const rel = (f) => path.relative(DOCS, f).replace(/\\/g, '/')

test('links between docs point at existing files and headings', () => {
  const broken = links
    .filter((l) => !fs.existsSync(l.to) || (l.anchor && !anchorsOf(l.to).has(l.anchor)))
    .map((l) => `${rel(l.from)} -> ${l.href}`)
  assert.deepEqual(broken, [])
})

// The wiki is read by following links, like a linked notebook: every page is
// reachable from another page, and every guide links on to several others.
// (docs/extensions.md is a redirect stub the wiki leaves out; guide/README is
// the front door.)
const ENTRY = new Set(['extensions.md', 'guide/README.md'])

test('every doc is linked from at least one other doc', () => {
  const linked = new Set(links.filter((l) => l.to !== l.from).map((l) => rel(l.to)))
  const orphans = files.map(rel).filter((f) => !ENTRY.has(f) && !linked.has(f))
  assert.deepEqual(orphans, [], 'link these pages from a related page')
})

test('every guide links to at least four other pages', () => {
  const MIN = 4
  const thin = files
    .filter((f) => rel(f).startsWith('guide/'))
    .map((f) => [rel(f), new Set(links.filter((l) => l.from === f && l.to !== f).map((l) => l.to)).size])
    .filter(([, n]) => n < MIN)
    .map(([f, n]) => `${f} (${n})`)
  assert.deepEqual(thin, [], `guides should link to at least ${MIN} other pages`)
})

test("every openWiki('<page>') in the app names an existing doc", () => {
  const src = path.join(__dirname, '..', 'src')
  const walkSrc = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      return e.isDirectory() ? walkSrc(p) : /\.tsx?$/.test(e.name) ? [p] : []
    })
  const missing = walkSrc(src).flatMap((file) =>
    [...fs.readFileSync(file, 'utf8').matchAll(/openWiki\('([^']+)'/g)]
      .map((m) => m[1])
      .filter((id) => !fs.existsSync(path.join(DOCS, `${id}.md`)))
      .map((id) => `${path.relative(src, file)}: ${id}`),
  )
  assert.deepEqual(missing, [])
})
