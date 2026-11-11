const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const P = require('./index.cjs')
const declared = require('../cache/declared.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-profiles-'))
const listAll = (dir) => {
  const out = []
  const walk = (d, rel = '') => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      out.push(path.join(rel, e.name))
      if (e.isDirectory()) walk(path.join(d, e.name), path.join(rel, e.name))
    }
  }
  walk(dir)
  return out.sort()
}

test('no profiles.json: one default profile whose folder is the data folder itself', () => {
  const root = tmp()
  const store = P.createProfileStore(root)
  assert.deepEqual(store.active(), { id: 'default', name: '', createdAt: null })
  const layout = store.layout()
  assert.equal(layout.profileDir, root)
  assert.equal(layout.folder('modules/flashcards'), path.join(root, 'modules', 'flashcards'))
  assert.equal(layout.folder('modules/claude-stats'), path.join(root, 'modules', 'claude-stats'))
  assert.equal(store.list().profiles[0].dataDir, root)
})

test('reading never creates, moves or renames anything', () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, 'modules', 'flashcards'), { recursive: true })
  fs.writeFileSync(path.join(root, 'modules', 'flashcards', 'decks.json'), '{"decks":[]}')
  const before = listAll(root)
  const store = P.createProfileStore(root)
  store.active()
  store.list()
  store.layout().folder('apps/jira-plus')
  P.activeLayout(root)
  P.readProfilesSync(root)
  assert.deepEqual(listAll(root), before)
})

test('the default profile resolves every declared folder to where it has always been', () => {
  const root = tmp()
  const layout = P.createLayout(root)
  for (const folder of declared.declaredFolders()) {
    assert.equal(layout.folder(folder), path.join(root, ...folder.split('/')), folder)
  }
})

test('every backend and declared data folder has a scope', () => {
  // The registries require Electron, so read their require lists as text.
  const mods = fs.readFileSync(path.join(__dirname, '..', 'modules', 'index.cjs'), 'utf8')
  const apps = fs.readFileSync(path.join(__dirname, '..', 'apps', 'index.cjs'), 'utf8')
  const folders = [
    'modules/extensions',
    ...[...mods.matchAll(/require\('\.\/([a-z-]+)\.cjs'\)/g)].map((m) => `modules/${m[1]}`),
    ...[...apps.matchAll(/require\('\.\/([a-z-]+)\/index\.cjs'\)/g)].map((m) => `apps/${m[1]}`),
    ...declared.declaredFolders(),
  ]
  assert.ok(folders.includes('modules/flashcards') && folders.includes('apps/jira-plus'))
  const missing = folders.filter((f) => !Object.hasOwn(P.SCOPES, f))
  assert.deepEqual(missing, [], 'add these to SCOPES in electron/profiles/index.cjs')
  for (const s of Object.values(P.SCOPES)) assert.ok(s === 'profile' || s === 'machine')
})

test('rename writes profiles.json atomically, keeps the default id, cleans the name', async () => {
  const root = tmp()
  const store = P.createProfileStore(root, { now: () => new Date('2026-11-11T12:00:00Z') })
  const p = await store.rename('default', '  Sample\u0007  Person ')
  assert.equal(p.name, 'Sample Person')
  const raw = JSON.parse(fs.readFileSync(path.join(root, P.PROFILES_FILE), 'utf8'))
  assert.equal(raw.activeId, 'default')
  assert.deepEqual(raw.profiles, [{ id: 'default', name: 'Sample Person', createdAt: '2026-11-11T12:00:00.000Z' }])
  assert.deepEqual(fs.readdirSync(root), [P.PROFILES_FILE], 'no temp files left, nothing else created')
  // A fresh store reads it back; the folder still is the data folder.
  const again = P.createProfileStore(root)
  assert.equal(again.active().name, 'Sample Person')
  assert.equal(again.layout().profileDir, root)
  await assert.rejects(store.rename('default', 'x'.repeat(61)), /at most 60/)
  await assert.rejects(store.rename('nobody', 'x'), /No profile/)
})

test('a damaged profiles.json is never overwritten; the default profile is used meanwhile', async () => {
  const root = tmp()
  const file = path.join(root, P.PROFILES_FILE)
  fs.writeFileSync(file, '{ not json')
  const store = P.createProfileStore(root)
  assert.equal(store.active().id, 'default')
  assert.equal(store.list().damaged, true)
  await assert.rejects(store.rename('default', 'A'), (e) => e.code === 'damaged')
  assert.equal(fs.readFileSync(file, 'utf8'), '{ not json')
})

test('parse: drops bad ids and duplicates, always keeps default, falls back to it when active is unknown', () => {
  const { state } = P.parseProfiles(
    JSON.stringify({ activeId: 'ghost', profiles: [{ id: '../x', name: 'bad' }, { id: 'sam', name: 'Sam' }, { id: 'sam', name: 'dup' }] }),
  )
  assert.equal(state.activeId, 'default')
  assert.deepEqual(state.profiles.map((p) => p.id), ['default', 'sam'])
  const two = P.parseProfiles(JSON.stringify({ activeId: 'sam', profiles: [{ id: 'default' }, { id: 'sam', name: 'Sam' }] }))
  assert.equal(two.state.activeId, 'sam')
})

test('another profile: profile folders move under profiles/<id>, machine folders stay', () => {
  const root = tmp()
  const layout = P.createLayout(root, 'sam')
  assert.equal(layout.profileDir, path.join(root, 'profiles', 'sam'))
  assert.equal(layout.folder('modules/flashcards'), path.join(root, 'profiles', 'sam', 'modules', 'flashcards'))
  assert.equal(layout.folder('apps/jira-plus'), path.join(root, 'profiles', 'sam', 'apps', 'jira-plus'))
  assert.equal(layout.folder('modules/claude-stats'), path.join(root, 'modules', 'claude-stats'))
  assert.equal(layout.folder('extensions'), path.join(root, 'extensions'))
  assert.throws(() => P.createLayout(root, '../escape'), /Not a profile id/)
  assert.throws(() => layout.folder('modules/unknown'), (e) => e.code === 'undeclared')
})

test('folders that read each other by relative path share a scope', () => {
  // GitHub+ reads ../jira-plus; Jira+ reads ../../modules/jira; GitHub+ backups read ../../modules/backups.
  const groups = [['apps/github-plus', 'apps/jira-plus', 'modules/jira', 'modules/backups', 'modules/flashcards']]
  for (const g of groups) assert.equal(new Set(g.map(P.scopeOf)).size, 1, g.join(', '))
})

test('folderOf accepts a plain root or a layout', () => {
  const root = tmp()
  assert.equal(P.folderOf(root, 'modules/mcp'), path.join(root, 'modules', 'mcp'))
  assert.equal(P.folderOf(P.createLayout(root, 'sam'), 'modules/mcp'), path.join(root, 'profiles', 'sam', 'modules', 'mcp'))
})
