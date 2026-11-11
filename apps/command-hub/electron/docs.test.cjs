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

test('links between docs point at existing files', () => {
  const broken = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
    for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(href) || href.startsWith('#')) continue
      const rel = href.split('#')[0]
      if (!rel.endsWith('.md')) continue
      if (!fs.existsSync(path.resolve(path.dirname(file), rel))) broken.push(`${path.relative(DOCS, file)} -> ${href}`)
    }
  }
  assert.deepEqual(broken, [])
})

test('guides are listed in the wiki reading order', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'wiki', 'content.ts'), 'utf8')
  const order = /guide:\s*\[([^\]]*)\]/.exec(content)
  assert.ok(order, 'ORDER.guide in content.ts')
  const listed = [...order[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  const guides = fs.readdirSync(path.join(DOCS, 'guide')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3))
  assert.deepEqual(guides.filter((g) => !listed.includes(g)), [], 'add new guides to ORDER.guide (and an icon to GUIDE_ICONS in WikiPage.tsx)')
})
