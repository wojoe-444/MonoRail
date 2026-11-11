// Tests for the Agent Catalog backend, on fictional subagents in a temp folder.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { _internal: cat } = require('./agent-catalog.cjs')
const defs = require('./agents-definitions.cjs')

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

function fixture() {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-')))
  const repo = path.join(home, 'Repos', 'demo-app')
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true })
  write(
    path.join(home, '.claude', 'agents', 'code-reviewer.md'),
    '---\nname: code-reviewer\ndescription: Reviews diffs for bugs\nmodel: sonnet\ntools: Read, Grep, Glob\ncolor: blue\n---\n\nYou review code.\n',
  )
  write(path.join(repo, '.claude', 'agents', 'test-writer.md'), '---\nname: test-writer\ndescription: "Writes tests: unit ones"\n---\nWrite tests.\n')
  write(path.join(home, '.pi', 'agent', 'agents', 'scout.md'), '---\nname: scout\ndescription: Fast recon\ntools: read, grep, find, ls\nmodel: claude-haiku-5-5\n---\nScout.\n')
  write(path.join(repo, '.pi', 'agents', 'broken.md'), 'No header.\n')
  write(path.join(home, '.claude', 'agents', 'notes.txt'), 'not a subagent')
  const chatDir = path.join(home, 'appdata', 'modules', 'agent-chat')
  const backupDir = path.join(home, 'appdata', 'modules', 'agent-catalog')
  fs.mkdirSync(chatDir, { recursive: true })
  fs.mkdirSync(backupDir, { recursive: true })
  return { home, repo, o: { chatDir, backupDir, home, env: {} } }
}

test('lists Claude and pi subagents from home and allowed repos, plus the built-in coordinator', async () => {
  const { o } = fixture()
  const r = await cat.listSubagents(o)
  const names = r.subagents.map((s) => `${s.tool}:${s.scope}:${s.name}`)
  assert.deepEqual(names, ['pi:project:broken', 'claude:user:code-reviewer', 'pi:user:scout', 'claude:project:test-writer', 'claude:builtin:coordinator', 'claude:builtin:storage-detective'])
  const reviewer = r.subagents.find((s) => s.name === 'code-reviewer')
  assert.deepEqual(reviewer.tools, ['Read', 'Grep', 'Glob'])
  assert.deepEqual(reviewer.extraFields, ['color'])
  assert.equal(reviewer.location, '~/.claude/agents/code-reviewer.md')
  assert.ok(!JSON.stringify(r.subagents).includes(o.home), 'no absolute paths in subagent summaries')
  assert.equal(r.subagents.find((s) => s.name === 'test-writer').description, 'Writes tests: unit ones')
  assert.match(r.subagents.find((s) => s.name === 'broken').problem, /pi skips/)
  assert.equal(r.piExtension, false)
})

test('the built-in coordinator is hidden when the user has their own', async () => {
  const { home, o } = fixture()
  write(path.join(home, '.claude', 'agents', 'coordinator.md'), '---\nname: coordinator\ndescription: Mine\n---\nHi\n')
  const r = await cat.listSubagents(o)
  assert.deepEqual(r.subagents.filter((s) => s.scope === 'builtin').map((s) => s.name), ['storage-detective'])
  const b = await cat.getSubagent('builtin:coordinator')
  assert.match(b.prompt, /coordinator/)
  await assert.rejects(cat.getSubagent('builtin:nope'), /not found/)
})

test('Storage Detective ships look-only and says it never deletes or moves', async () => {
  const d = await cat.getSubagent('builtin:storage-detective')
  assert.deepEqual(d.tools, ['Read', 'Grep', 'Glob', 'mcp__monorail__storage_scan'])
  assert.ok(!d.tools.some((t) => /^(Bash|Edit|Write|NotebookEdit|Agent|Task)$/.test(t)))
  assert.match(d.prompt, /Never delete, move/)
  assert.match(d.prompt, /storage_scan/)
  // "Add to Claude Code" writes the same text into the user's agents folder.
  const { home, o } = fixture()
  const { id } = await cat.createSubagent(o, { tool: 'claude', draft: { name: d.name, description: d.description, model: d.model, tools: d.tools, prompt: d.prompt, saveTo: 'user' } })
  const mine = await cat.getSubagent(id)
  assert.equal(mine.prompt, d.prompt)
  assert.deepEqual(mine.tools, d.tools)
  assert.equal(mine.description, d.description)
  assert.ok(fs.existsSync(path.join(home, '.claude', 'agents', 'storage-detective.md')))
  assert.ok(!(await cat.listSubagents(o)).subagents.some((s) => s.id === 'builtin:storage-detective'))
})

test('create writes a new file and refuses to replace one', async () => {
  const { home, repo, o } = fixture()
  const draft = { name: 'docs-writer', description: 'Updates docs: README and guides', model: 'inherit', tools: ['Read', 'Edit'], prompt: 'Keep it short.', saveTo: 'demo-app' }
  const { id } = await cat.createSubagent(o, { tool: 'claude', draft })
  const file = path.join(repo, '.claude', 'agents', 'docs-writer.md')
  const text = fs.readFileSync(file, 'utf8')
  assert.equal(text, '---\nname: docs-writer\ndescription: "Updates docs: README and guides"\ntools: Read, Edit\nmodel: inherit\n---\n\nKeep it short.\n')
  const back = await cat.getSubagent(id)
  assert.equal(back.description, 'Updates docs: README and guides')
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft }), /already a subagent/)
  // pi: no `inherit`, saved to pi's folder.
  await cat.createSubagent(o, { tool: 'pi', draft: { ...draft, saveTo: 'user', tools: null } })
  assert.equal(fs.readFileSync(path.join(home, '.pi', 'agent', 'agents', 'docs-writer.md'), 'utf8'), '---\nname: docs-writer\ndescription: "Updates docs: README and guides"\n---\n\nKeep it short.\n')
})

test('create validates names, places and fields', async () => {
  const { o } = fixture()
  const ok = { name: 'x-ray', description: 'd', model: '', tools: null, prompt: 'p', saveTo: 'user' }
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, name: '../evil' } }), /lowercase/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, name: 'Big' } }), /lowercase/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, saveTo: 'not-allowed' } }), /allowed folders/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, saveTo: '../Repos/demo-app' } }), /allowed folders/)
  await assert.rejects(cat.createSubagent(o, { tool: 'codex', draft: ok }), /Claude Code or pi/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, description: ' ' } }), /when it should/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, tools: [] } }), /at least one/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, tools: ['Read\nevil: 1'] } }), /tool name/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, model: 'a b' } }), /model/)
  await assert.rejects(cat.createSubagent(o, { tool: 'claude', draft: { ...ok, prompt: '---\nname: other' } }), /---/)
})

test('a description with a newline cannot add header keys', async () => {
  const { home, o } = fixture()
  await cat.createSubagent(o, { tool: 'claude', draft: { name: 'sneaky', description: 'ok\npermissionMode: bypassPermissions', model: '', tools: ['Read'], prompt: 'p', saveTo: 'user' } })
  const { data } = defs.parseFrontmatter(fs.readFileSync(path.join(home, '.claude', 'agents', 'sneaky.md'), 'utf8'))
  assert.equal(data.permissionMode, undefined)
})

test('update backs up first, keeps unknown header fields and refuses stale edits', async () => {
  const { home, o } = fixture()
  const list = await cat.listSubagents(o)
  const s = list.subagents.find((x) => x.name === 'code-reviewer')
  const draft = { name: 'code-reviewer', description: 'Reviews diffs', model: 'opus', tools: ['Read'], prompt: 'New instructions.', saveTo: 'user' }
  await cat.updateSubagent(o, { id: s.id, draft, updatedAt: s.updatedAt })
  const file = path.join(home, '.claude', 'agents', 'code-reviewer.md')
  assert.equal(fs.readFileSync(file, 'utf8'), '---\nname: code-reviewer\ndescription: Reviews diffs\nmodel: opus\ntools: Read\ncolor: blue\n---\n\nNew instructions.\n')
  const backups = fs.readdirSync(path.join(o.backupDir, cat.BACKUPS_DIR))
  assert.equal(backups.length, 1)
  assert.match(backups[0], /__edit__claude__user__code-reviewer\.md$/)
  assert.match(fs.readFileSync(path.join(o.backupDir, cat.BACKUPS_DIR, backups[0]), 'utf8'), /You review code/)
  await assert.rejects(cat.updateSubagent(o, { id: s.id, draft, updatedAt: s.updatedAt - 10_000 }), /changed on disk/)
  await assert.rejects(cat.updateSubagent(o, { id: s.id, draft: { ...draft, name: 'renamed' } }), /duplicate/)
  await assert.rejects(cat.updateSubagent(o, { id: 'sub_nope', draft }), /not found/)
})

test('remove backs up, then deletes the file only', async () => {
  const { repo, o } = fixture()
  const list = await cat.listSubagents(o)
  const s = list.subagents.find((x) => x.name === 'test-writer')
  const r = await cat.removeSubagent(o, { id: s.id })
  assert.ok(!fs.existsSync(path.join(repo, '.claude', 'agents', 'test-writer.md')))
  assert.ok(fs.existsSync(path.join(repo, '.claude', 'agents')))
  assert.match(r.backup, /__delete__claude__repo-demo-app__test-writer\.md$/)
  assert.match(fs.readFileSync(path.join(o.backupDir, cat.BACKUPS_DIR, r.backup), 'utf8'), /Write tests/)
  await assert.rejects(cat.removeSubagent(o, { id: s.id }), /not found/)
})

test('an agents folder linked outside its repo is neither listed nor written', { skip: process.platform === 'win32' }, async () => {
  const { home, repo, o } = fixture()
  const outside = path.join(home, 'elsewhere')
  write(path.join(outside, 'planted.md'), '---\nname: planted\ndescription: x\n---\nx\n')
  fs.rmSync(path.join(repo, '.pi', 'agents'), { recursive: true })
  fs.symlinkSync(outside, path.join(repo, '.pi', 'agents'))
  const r = await cat.listSubagents(o)
  assert.ok(!r.subagents.some((s) => s.name === 'planted'))
  await assert.rejects(cat.createSubagent(o, { tool: 'pi', draft: { name: 'new-one', description: 'd', model: '', tools: null, prompt: 'p', saveTo: 'demo-app' } }), /outside/)
  assert.ok(!fs.existsSync(path.join(outside, 'new-one.md')))
})

test('a subagent file that is a link is listed but not edited or deleted', { skip: process.platform === 'win32' }, async () => {
  const { home, o } = fixture()
  const real = path.join(home, 'shared', 'helper.md')
  write(real, '---\nname: helper\ndescription: h\n---\nh\n')
  fs.symlinkSync(real, path.join(home, '.claude', 'agents', 'helper.md'))
  const s = (await cat.listSubagents(o)).subagents.find((x) => x.name === 'helper')
  assert.ok(s)
  await assert.rejects(cat.removeSubagent(o, { id: s.id }), /link/)
  assert.ok(fs.existsSync(real))
})

test('the Agents overview lists pi subagents too', async () => {
  const { home, repo } = fixture()
  const r = await defs.listDefinitions({ repos: [{ name: 'demo-app', path: repo }], env: {}, home })
  assert.ok(r.definitions.some((d) => d.tool === 'pi' && d.kind === 'subagent' && d.name === 'scout'))
})

test('the browser sample carries the same Storage Detective text', () => {
  const { STORAGE_DETECTIVE } = require('./agent-catalog-builtins.cjs')
  const sample = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'modules', 'agent-catalog', 'sample.ts'), 'utf8')
  assert.ok(sample.includes(JSON.stringify(STORAGE_DETECTIVE.prompt)), 'run the snippet in sample.ts again after changing the prompt')
  assert.ok(sample.includes(JSON.stringify(STORAGE_DETECTIVE.description)))
})
