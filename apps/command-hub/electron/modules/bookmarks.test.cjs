const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const backend = require('./bookmarks.cjs')

test('bookmarks persist, edit and delete without touching their targets', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarks-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const ctx = { dataDir: dir }
  const file = path.join(dir, 'document.txt')
  fs.writeFileSync(file, 'content')
  const a = await backend.methods.save(ctx, { name: 'File', target: file })
  const b = await backend.methods.save(ctx, { name: 'Web', target: 'https://example.com' })
  await backend.methods.save(ctx, { ...a, name: 'Renamed', description: 'A file' })
  assert.deepEqual((await backend.methods.list(ctx)).map((x) => x.name), ['Renamed', 'Web'])
  await backend.methods.remove(ctx, { id: a.id })
  assert.equal(fs.readFileSync(file, 'utf8'), 'content')
  assert.deepEqual((await backend.methods.list(ctx)).map((x) => x.id), [b.id])
  await assert.rejects(backend.methods.save(ctx, { name: 'bad', target: 'javascript:alert(1)' }), /http/)
  await assert.rejects(backend.methods.save(ctx, { id: 'missing', name: 'bad', target: file }), /not found/)
})

test('opening resolves the saved target through the system shell and reports errors', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarks-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const ctx = { dataDir: dir }
  const targets = []
  const original = Module._load
  Module._load = function (name, ...args) {
    if (name === 'electron') return { shell: { openPath: async (p) => { targets.push(p); return p.endsWith('missing') ? 'File not found' : '' }, openExternal: async (p) => targets.push(p) } }
    return original.call(this, name, ...args)
  }
  t.after(() => { Module._load = original })
  for (const target of [dir, path.join(dir, 'file.txt'), 'https://example.com']) {
    const item = await backend.methods.save(ctx, { name: target, target })
    await backend.methods.open(ctx, { id: item.id })
  }
  assert.deepEqual(targets, [dir, path.join(dir, 'file.txt'), 'https://example.com'])
  const missing = await backend.methods.save(ctx, { name: 'Missing', target: path.join(dir, 'missing') })
  await assert.rejects(backend.methods.open(ctx, { id: missing.id }), /File not found/)
  assert.deepEqual(backend.desktopOnly, ['open'])
})

test('folders support nesting, moves, validation and recursive removal', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarks-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const ctx = { dataDir: dir }
  const root = await backend.methods.save(ctx, { kind: 'folder', name: 'Root', color: '#123456' })
  const child = await backend.methods.save(ctx, { kind: 'folder', name: 'Child', parentId: root.id })
  const link = await backend.methods.save(ctx, { name: 'Link', target: 'https://example.com', parentId: child.id })
  assert.equal((await backend.methods.list(ctx))[0].color, '#123456')
  await assert.rejects(backend.methods.save(ctx, { ...root, parentId: child.id }), /inside itself/)
  await assert.rejects(backend.methods.save(ctx, { ...child, parentId: link.id }), /Parent must be a folder/)
  await assert.rejects(backend.methods.save(ctx, { ...child, color: 'red' }), /color/)
  await assert.rejects(backend.methods.open(ctx, { id: root.id }), /cannot be opened/)
  await backend.methods.save(ctx, { ...link, parentId: null })
  await backend.methods.remove(ctx, { id: root.id })
  assert.deepEqual((await backend.methods.list(ctx)).map((x) => x.id), [link.id])
})
