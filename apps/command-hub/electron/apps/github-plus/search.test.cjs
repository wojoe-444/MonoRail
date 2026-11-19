// Tests for GitHub+ search (search.cjs) and readWorkingBlob. Run with `npm test`.
// Creates a throwaway repo in the OS temp folder; needs `git` on PATH.

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const git = require('./git.cjs')
const issues = require('./issues.cjs')
const s = require('./search.cjs')

let dir
const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' })
const P = (raw, opts) => s.parseQuery(raw, opts)

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ghp-search-'))
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 'tester@example.invalid')
  g('config', 'user.name', 'Tester')
  g('config', 'commit.gpgsign', 'false')
  mkdirSync(join(dir, 'src', 'util'), { recursive: true })
  mkdirSync(join(dir, 'docs'))
  writeFileSync(join(dir, 'src', 'notes.ts'), 'export function createNote(title) {\n  return { title }\n}\n// TODO: tags\n')
  writeFileSync(join(dir, 'src', 'util', 'format.js'), 'const formatDate = (d) => d.toISOString()\nmodule.exports = { formatDate }\n')
  writeFileSync(join(dir, 'docs', 'guide.md'), '# Guide\n\nUse createNote to add a note.\n--flag is an option\n')
  writeFileSync(join(dir, '.gitignore'), 'secret.txt\n')
  g('add', '.')
  g('commit', '-qm', 'initial notes')
  writeFileSync(join(dir, 'src', 'legacy.ts'), 'export const oldThing = 42\n')
  g('add', '.')
  g('commit', '-qm', 'add legacy thing')
  g('rm', '-q', 'src/legacy.ts')
  g('commit', '-qm', 'remove legacy thing')
  g('checkout', '-qb', 'feature/tags')
  writeFileSync(join(dir, 'src', 'tags.ts'), 'export function addTag(note, tag) {\n  return note\n}\n')
  g('add', '.')
  g('commit', '-qm', 'Add tags (fixes #1)')
  g('checkout', '-q', 'main')
  // Uncommitted edits, a new file and an ignored one.
  writeFileSync(join(dir, 'src', 'notes.ts'), 'export function createNote(title) {\n  return { title, draftMarker: true }\n}\n// TODO: tags\n')
  writeFileSync(join(dir, 'src', 'scratch.ts'), 'const draftMarker = 1\n')
  writeFileSync(join(dir, 'secret.txt'), 'draftMarker secret\n')
  await issues.createIssue(dir, { title: 'Tags are missing', body: 'We should support tags.\nSee createNote.' })
  const i2 = await issues.createIssue(dir, { title: 'Dates look odd', body: 'Formatting.' })
  await issues.addComment(dir, i2.number, { body: 'formatDate uses UTC' })
})

describe('parseQuery', () => {
  it('reads qualifiers, quotes and /regex/', () => {
    const q = P('repo:orbit path:src -path:test lang:ts ref:main,feature/x author:Ann "create note" is:open')
    assert.deepEqual(q.repos, ['orbit'])
    assert.deepEqual(q.paths, ['src'])
    assert.deepEqual(q.notPaths, ['test'])
    assert.deepEqual(q.langs, ['ts'])
    assert.deepEqual(q.refs, ['main', 'feature/x'])
    assert.equal(q.author, 'Ann')
    assert.equal(q.state, 'open')
    assert.equal(q.text, 'create note')
    const r = P('/foo.*bar/')
    assert.equal(r.text, 'foo.*bar')
    assert.equal(r.regex, true)
    assert.equal(P('x', { caseSensitive: true, word: true }).caseSensitive, true)
    assert.equal(P('x case:yes').caseSensitive, true)
  })

  it('keeps unknown key:value text as search text and drops bad dates', () => {
    const q = P('http://example.invalid before:yesterday')
    assert.equal(q.text, 'http://example.invalid')
    assert.equal(q.before, null)
    assert.equal(P('def:bad name!').def, 'bad')
  })

  it('filters paths like path:, -path: and lang: say', () => {
    const f = s.pathFilter(P('path:src -path:util lang:ts'))
    assert.equal(f('src/notes.ts'), true)
    assert.equal(f('src/util/x.ts'), false)
    assert.equal(f('src/notes.js'), false)
    const glob = s.pathFilter(P('path:*.test.cjs'))
    assert.equal(glob('electron/a.test.cjs'), true)
    assert.equal(glob('electron/a.cjs'), false)
  })

  it('scores files like go-to-file', () => {
    assert.ok(s.fuzzyScore('src/notes.ts', 'notes') > s.fuzzyScore('docs/notes-guide/x.md', 'notes'))
    assert.ok(s.fuzzyScore('src/util/format.js', 'sufmt') > 0)
    assert.equal(s.fuzzyScore('src/util/format.js', 'zzz'), 0)
    assert.ok(s.fuzzyScore('src/pages/SearchPage.tsx', 'srchpg') > s.fuzzyScore('src/pages/HomePage.tsx', 'srchpg'))
  })
})

describe('code search', () => {
  it('searches the working folder by default: uncommitted and new files, not ignored ones', async () => {
    const r = await s.searchCode(dir, P('draftMarker'))
    const paths = r.files.map((f) => f.path).sort()
    assert.deepEqual(paths, ['src/notes.ts', 'src/scratch.ts'])
    assert.equal(r.files[0].ref, null)
    const notes = r.files.find((f) => f.path === 'src/notes.ts')
    assert.ok(notes.lines.some((l) => l.match && l.n === 2))
    assert.ok(notes.lines.some((l) => !l.match && l.n === 1), 'keeps the line before as context')
  })

  it('searches a ref, and several refs at once', async () => {
    assert.equal((await s.searchCode(dir, P('draftMarker ref:main'))).files.length, 0)
    const both = await s.searchCode(dir, P('function ref:main,feature/tags'))
    const got = both.files.map((f) => `${f.ref}:${f.path}`).sort()
    assert.deepEqual(got, ['feature/tags:src/notes.ts', 'feature/tags:src/tags.ts', 'main:src/notes.ts'])
    await assert.rejects(s.searchCode(dir, P('x ref:no-such')), /Unknown ref/)
    await assert.rejects(s.searchCode(dir, P('x ref:--output=y')), /Invalid ref/)
  })

  it('applies path and language filters, case and whole words', async () => {
    const r = await s.searchCode(dir, P('createNote lang:md'))
    assert.deepEqual(r.files.map((f) => f.path), ['docs/guide.md'])
    assert.equal((await s.searchCode(dir, P('createnote -path:docs'))).files.length, 1)
    assert.equal((await s.searchCode(dir, P('createnote', { caseSensitive: true }))).files.length, 0)
    assert.equal((await s.searchCode(dir, P('create', { word: true }))).files.length, 0)
  })

  it('treats a pattern starting with a dash as text, and reports a bad regex plainly', async () => {
    const r = await s.searchCode(dir, P('--flag'))
    assert.deepEqual(r.files.map((f) => f.path), ['docs/guide.md'])
    await assert.rejects(s.searchCode(dir, P('/foo(/')), /regular expression|parenthes|unmatched/i)
  })

  it('finds definitions with def:', async () => {
    const r = await s.searchCode(dir, P('def:formatDate'))
    assert.deepEqual(r.files.map((f) => f.path), ['src/util/format.js'])
    assert.equal(r.files[0].lines.filter((l) => l.match).length, 1)
  })

  it('stops at the limit and says so', async () => {
    const r = await s.searchCode(dir, P('e'), { limit: 2 })
    assert.equal(r.truncated, true)
    assert.equal(r.matches, 2)
  })

  it('counts matching lines', async () => {
    assert.equal(await s.countCode(dir, P('draftMarker')), 2)
    assert.equal(await s.countCode(dir, P('draftMarker ref:main')), 0)
  })
})

describe('files, commits, history, issues', () => {
  it('finds files fuzzily, in the working folder or at a ref', async () => {
    const r = await s.searchFiles(dir, P('format'))
    assert.equal(r.files[0].path, 'src/util/format.js')
    assert.ok((await s.searchFiles(dir, P('scratch'))).files.some((f) => f.path === 'src/scratch.ts'))
    assert.equal((await s.searchFiles(dir, P('scratch ref:main'))).files.length, 0)
    assert.ok((await s.searchFiles(dir, P('tags ref:feature/tags'))).files.some((f) => f.path === 'src/tags.ts'))
    assert.ok(!(await s.searchFiles(dir, P('secret'))).files.length, 'ignored files are left out')
  })

  it('searches commit messages, and finds a commit by sha', async () => {
    const r = await s.searchCommits(dir, P('legacy'))
    assert.deepEqual(r.commits.map((c) => c.subject), ['remove legacy thing', 'add legacy thing'])
    const sha = g('rev-parse', 'HEAD~1').trim()
    const bySha = await s.searchCommits(dir, P(sha.slice(0, 8)))
    assert.equal(bySha.commits[0].sha, sha)
    assert.equal((await s.searchCommits(dir, P('tags ref:feature/tags'))).commits[0].subject, 'Add tags (fixes #1)')
  })

  it('finds the commits that added and removed a text (pickaxe)', async () => {
    const r = await s.searchHistory(dir, P('oldThing'))
    assert.deepEqual(r.commits.map((c) => c.subject), ['remove legacy thing', 'add legacy thing'])
    assert.deepEqual(r.commits[0].files, ['src/legacy.ts'])
    const rx = await s.searchHistory(dir, P('/old[A-Z]hing/'))
    assert.equal(rx.commits.length, 2)
  })

  it('searches issue titles, descriptions and comments', async () => {
    const t = await s.searchIssues(dir, P('tags'))
    assert.equal(t.issues[0].where, 'title')
    const d = await s.searchIssues(dir, P('createNote'))
    assert.equal(d.issues[0].where, 'description')
    assert.match(d.issues[0].snippet, /createNote/)
    const c = await s.searchIssues(dir, P('UTC'))
    assert.equal(c.issues[0].where, 'comment')
    assert.equal((await s.searchIssues(dir, P('#2'))).issues[0].number, 2)
    assert.equal((await s.searchIssues(dir, P('tags is:closed'))).issues.length, 0)
  })

  it('runs every kind for a repo and keeps one failure from stopping the rest', async () => {
    const r = await s.searchRepo(dir, P('/foo(/'), { kinds: ['code', 'files', 'issues'] })
    assert.ok(r.code.error)
    assert.ok(Array.isArray(r.issues.issues))
  })
})

describe('line history and working files', () => {
  it('shows who last changed a line and every commit that changed it', async () => {
    const h = await s.lineHistory(dir, 'main', 'src/notes.ts', 1)
    assert.equal(h.last.subject, 'initial notes')
    assert.equal(h.last.authorName, 'Tester')
    assert.equal(h.commits.length, 1)
    assert.ok(h.commits[0].lines.some((l) => l.kind === 'add' && /createNote/.test(l.text)))
    await assert.rejects(s.lineHistory(dir, 'main', '../x', 1), /Invalid path/)
    await assert.rejects(s.lineHistory(dir, 'main', 'src/notes.ts', 0), /Invalid line/)
  })

  it('reads a working file, and refuses paths outside the repo', async () => {
    const b = await git.readWorkingBlob(dir, 'src/scratch.ts')
    assert.equal(b.kind, 'text')
    assert.match(b.content, /draftMarker/)
    await assert.rejects(git.readWorkingBlob(dir, '../outside.txt'), /Invalid path/)
    await assert.rejects(git.readWorkingBlob(dir, 'src'), /not a file/)
    await assert.rejects(git.readWorkingBlob(dir, 'nope.txt'), /not in the working folder/)
  })

  it('cancels the older search on a channel', async () => {
    const a = s.channel('test')
    const b = s.channel('test')
    assert.equal(a.signal.aborted, true)
    assert.equal(b.signal.aborted, false)
    await assert.rejects(s.searchCode(dir, P('e'), { signal: a.signal }), /cancelled/)
    b.done()
  })
})
