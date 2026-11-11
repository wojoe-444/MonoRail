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

test('New User: switching creates a hidden blank profile, takes effect only at the next start, and remembers the way back', async () => {
  const root = tmp()
  fs.writeFileSync(path.join(root, 'keep.txt'), 'mine')
  const store = P.createProfileStore(root, { now: () => new Date('2026-11-11T12:00:00Z') })
  await store.rename('default', 'Sample Person')
  await store.switchTo(P.NEW_USER_ID)
  // This run keeps its profile; the next start opens New User.
  assert.equal(store.active().id, 'default')
  assert.equal(store.layout().profileDir, root)
  assert.equal(store.list().nextId, P.NEW_USER_ID)
  const raw = JSON.parse(fs.readFileSync(path.join(root, P.PROFILES_FILE), 'utf8'))
  assert.equal(raw.activeId, P.NEW_USER_ID)
  assert.equal(raw.previousId, 'default')
  assert.equal(raw.pendingReset, P.NEW_USER_ID)
  const nu = raw.profiles.find((p) => p.id === P.NEW_USER_ID)
  assert.equal(nu.hidden, true)
  assert.equal(nu.blank, true)
  assert.equal(raw.profiles.find((p) => p.id === 'default').name, 'Sample Person', 'the own profile is untouched')
  // Next start: the New User folder is the only thing used.
  const next = P.createProfileStore(root)
  assert.equal(next.active().id, P.NEW_USER_ID)
  assert.equal(next.layout().profileDir, path.join(root, 'profiles', P.NEW_USER_ID))
  assert.equal(next.layout().folder('modules/flashcards'), path.join(root, 'profiles', P.NEW_USER_ID, 'modules', 'flashcards'))
  assert.equal(next.layout().folder('modules/claude-stats'), path.join(root, 'modules', 'claude-stats'))
  // Back to the own profile from there; previousId survives the trip.
  await next.switchTo('default')
  const back = JSON.parse(fs.readFileSync(path.join(root, P.PROFILES_FILE), 'utf8'))
  assert.equal(back.activeId, 'default')
  assert.equal(back.pendingReset, undefined)
  assert.equal(fs.readFileSync(path.join(root, 'keep.txt'), 'utf8'), 'mine')
  await assert.rejects(store.switchTo('nobody'), /No profile/)
})

test('New User reset: wipes only profiles/new-user, and only when it is active and marked', async () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, 'modules', 'flashcards'), { recursive: true })
  fs.writeFileSync(path.join(root, 'modules', 'flashcards', 'decks.json'), '{}')
  const nuDir = path.join(root, 'profiles', P.NEW_USER_ID, 'modules', 'flashcards')
  fs.mkdirSync(nuDir, { recursive: true })
  fs.writeFileSync(path.join(nuDir, 'decks.json'), '{"test":1}')
  fs.mkdirSync(path.join(root, 'profiles', 'someone'), { recursive: true })
  fs.writeFileSync(path.join(root, 'profiles', 'someone', 'x.json'), '{}')

  // No profiles.json, or default active: nothing happens.
  assert.equal(P.resetBlankProfile(root), false)
  assert.ok(fs.existsSync(path.join(nuDir, 'decks.json')))

  await P.createProfileStore(root).switchTo(P.NEW_USER_ID)
  assert.equal(P.resetBlankProfile(root), true)
  assert.equal(fs.existsSync(path.join(root, 'profiles', P.NEW_USER_ID)), false)
  assert.ok(fs.existsSync(path.join(root, 'modules', 'flashcards', 'decks.json')), 'default profile data untouched')
  assert.ok(fs.existsSync(path.join(root, 'profiles', 'someone', 'x.json')), 'other profiles untouched')
  const raw = JSON.parse(fs.readFileSync(path.join(root, P.PROFILES_FILE), 'utf8'))
  assert.equal(raw.pendingReset, undefined)
  assert.equal(raw.activeId, P.NEW_USER_ID)
  // A second start in New User without a new switch keeps what was made since.
  fs.mkdirSync(nuDir, { recursive: true })
  fs.writeFileSync(path.join(nuDir, 'decks.json'), '{}')
  assert.equal(P.resetBlankProfile(root), false)
  assert.ok(fs.existsSync(path.join(nuDir, 'decks.json')))
  // A damaged profiles.json never triggers a delete.
  fs.writeFileSync(path.join(root, P.PROFILES_FILE), '{ nope')
  assert.equal(P.resetBlankProfile(root), false)
})

test('parse: a hand-edited pendingReset never points at anything but new-user', () => {
  const { state } = P.parseProfiles(JSON.stringify({ activeId: 'default', pendingReset: 'default', previousId: 'new-user', profiles: [{ id: 'default' }] }))
  assert.equal(state.pendingReset, undefined)
  assert.equal(state.previousId, undefined)
})
