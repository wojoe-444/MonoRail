const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const globalLib = require('./global.cjs')
const { createGlobalBackups } = require('./service.cjs')
const { nextDue } = require('./schedule.cjs')

const tmp = (p) => mkdtempSync(join(tmpdir(), p))

describe('global backup settings', () => {
  it('defaults to off, validates, and gives each page its own subfolder', async () => {
    const userData = tmp('bk-user-')
    const g0 = await globalLib.readGlobal(userData)
    assert.equal(g0.enabled, false)
    assert.equal(globalLib.pageRoot(g0, 'github-plus'), null)

    await assert.rejects(globalLib.writeGlobal(userData, { enabled: true, folder: '', times: 1, unit: 'day', keep: 3 }), /folder/)
    await assert.rejects(globalLib.writeGlobal(userData, { enabled: true, folder: 'relative/path', times: 1, unit: 'day', keep: 3 }), /folder/)
    await assert.rejects(globalLib.writeGlobal(userData, { enabled: true, folder: tmp('bk-root-'), times: 99, unit: 'day', keep: 3 }), /Times/)

    const root = tmp('bk-root-')
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 2, unit: 'day', keep: 3, items: { flashcards: false } })
    const g = await globalLib.readGlobal(userData)
    assert.equal(g.enabled, true)
    assert.deepEqual(g.items, { 'jira-plus': true, flashcards: false, notes: true, flows: true })
    for (const p of globalLib.PAGES) assert.equal(globalLib.pageRoot(g, p.id), join(root, p.id))
    assert.throws(() => globalLib.pageRoot(g, 'nope'))
    // Settings stay in AppData, next to nothing else.
    assert.deepEqual(readdirSync(join(userData, 'modules', 'backups')), ['settings.json'])
  })

  it('schedules after a success and backs off after a failure', () => {
    const f = { times: 4, unit: 'hour' }
    assert.equal(nextDue(null, {}), undefined)
    assert.equal(Date.parse(nextDue(f, {})), 0)
    const at = '2026-11-11T10:00:00.000Z'
    assert.equal(nextDue(f, { lastSuccessAt: at }), '2026-11-11T10:15:00.000Z')
    assert.equal(nextDue({ times: 1, unit: 'day' }, { lastSuccessAt: at, lastAttemptAt: '2026-11-11T12:00:00.000Z', lastResult: { ok: false } }), '2026-11-12T10:00:00.000Z')
  })
})

describe('global backup schedule', () => {
  function setup() {
    const userData = tmp('bk-user-')
    const root = tmp('bk-root-')
    const svc = createGlobalBackups(userData)
    return { userData, root, svc }
  }

  it('refuses to run while off, and skips pages with nothing to back up', async () => {
    const { userData, root, svc } = setup()
    await assert.rejects(svc.run('flashcards'), /Turn on/)
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2 })
    const r = await svc.run('flashcards')
    assert.equal(r.skipped, true)
    assert.deepEqual(readdirSync(root), [])
  })

  it('backs up Flashcards and Tasks into their own subfolders and keeps the newest N', async () => {
    const { userData, root, svc } = setup()
    const decks = join(userData, 'modules', 'flashcards')
    mkdirSync(decks, { recursive: true })
    writeFileSync(join(decks, 'decks.json'), JSON.stringify({ format: 1, decks: [{ id: 'd1', name: 'Sample deck' }], cards: [], days: {} }))
    const repo = join(userData, 'apps', 'jira-plus', 'local-repo')
    mkdirSync(repo, { recursive: true })
    const g = ['-c', 'user.name=Sample', '-c', 'user.email=sample@example.invalid', '-c', 'commit.gpgsign=false']
    execFileSync('git', ['init', '-q'], { cwd: repo })
    writeFileSync(join(repo, 'ISSUE-1.json'), '{"title":"Sample task"}')
    execFileSync('git', [...g, 'add', '.'], { cwd: repo })
    execFileSync('git', [...g, 'commit', '-qm', 'first'], { cwd: repo })

    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2 })
    for (let i = 0; i < 3; i++) {
      await svc.runAll()
      await new Promise((r) => setTimeout(r, 1100))
    }
    assert.deepEqual(readdirSync(root).sort(), ['flashcards', 'jira-plus'])
    const cards = readdirSync(join(root, 'flashcards'))
    assert.equal(cards.length, 2)
    assert.match(cards[0], /^flashcards-\d{4}-\d\d-\d\d_\d{6}\.json$/)
    assert.equal(JSON.parse(readFileSync(join(root, 'flashcards', cards[0]), 'utf8')).decks[0].name, 'Sample deck')
    const bundles = readdirSync(join(root, 'jira-plus'))
    assert.equal(bundles.length, 2)
    const restored = join(tmp('bk-restore-'), 'r')
    execFileSync('git', ['clone', '-q', join(root, 'jira-plus', bundles[0]), restored])
    assert.ok(readFileSync(join(restored, 'ISSUE-1.json'), 'utf8').includes('Sample task'))

    // Files that are not ours are never touched.
    writeFileSync(join(root, 'flashcards', 'my-notes.txt'), 'keep me')
    await svc.run('flashcards')
    assert.ok(readdirSync(join(root, 'flashcards')).includes('my-notes.txt'))

    const st = await svc.status()
    const fc = st.pages.find((p) => p.id === 'flashcards')
    assert.equal(fc.files, 2)
    assert.equal(fc.lastResult.ok, true)
    assert.equal(Date.parse(fc.nextDueAt) - Date.parse(fc.lastResult.at), 86_400_000)

    // A damaged flashcards file fails instead of pushing out good backups.
    writeFileSync(join(decks, 'decks.json'), '{broken')
    await assert.rejects(svc.run('flashcards'), /damaged/)
    assert.equal(readdirSync(join(root, 'flashcards')).filter((n) => n.endsWith('.json')).length, 2)
  })

  it('excluded pages are not scheduled', async () => {
    const { userData, root, svc } = setup()
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2, items: { 'jira-plus': false, flashcards: false, notes: false, flows: false } })
    await svc.tick()
    const st = await svc.status()
    for (const p of st.pages.filter((x) => x.id !== 'github-plus')) assert.equal(p.nextDueAt, null)
  })
})

describe('back up before updating', () => {
  function seed(userData) {
    const decks = join(userData, 'modules', 'flashcards')
    mkdirSync(decks, { recursive: true })
    writeFileSync(join(decks, 'decks.json'), JSON.stringify({ format: 1, decks: [{ id: 'd1', name: 'Sample deck' }], cards: [], days: {} }))
    const repo = join(userData, 'apps', 'jira-plus', 'local-repo')
    mkdirSync(repo, { recursive: true })
    const g = ['-c', 'user.name=Sample', '-c', 'user.email=sample@example.invalid', '-c', 'commit.gpgsign=false']
    execFileSync('git', ['init', '-q'], { cwd: repo })
    writeFileSync(join(repo, 'ISSUE-1.json'), '{"title":"Sample task"}')
    execFileSync('git', [...g, 'add', '.'], { cwd: repo })
    execFileSync('git', [...g, 'commit', '-qm', 'first'], { cwd: repo })
    return { decks, repo }
  }

  it('is on by default and stays saved when turned off', async () => {
    const userData = tmp('bk-user-')
    assert.equal((await globalLib.readGlobal(userData)).beforeUpdate, true)
    const root = tmp('bk-root-')
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2 })
    assert.equal((await globalLib.readGlobal(userData)).beforeUpdate, true)
    assert.equal(globalLib.beforeUpdateRoot(await globalLib.readGlobal(userData)), join(root, 'before-update'))
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2, beforeUpdate: false })
    const g = await globalLib.readGlobal(userData)
    assert.equal(g.beforeUpdate, false)
    assert.equal(globalLib.beforeUpdateRoot(g), null)
  })

  it('skips without a folder (never blocks the update) and when turned off', async () => {
    const userData = tmp('bk-user-')
    seed(userData)
    const svc = createGlobalBackups(userData)
    const r = await svc.runBeforeUpdate('9.9.9')
    assert.equal(r.ok, true)
    assert.equal(r.skipped, 'no-folder')
    const root = tmp('bk-root-')
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2, beforeUpdate: false })
    assert.equal((await svc.runBeforeUpdate('9.9.9')).skipped, 'off')
    assert.deepEqual(readdirSync(root), [])
  })

  it('backs up every item into before-update, even ones switched off, and keeps the newest few', async () => {
    const userData = tmp('bk-user-')
    const { decks } = seed(userData)
    const root = tmp('bk-root-')
    const svc = createGlobalBackups(userData)
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2, items: { 'jira-plus': false, flashcards: false, notes: false, flows: false } })
    const r = await svc.runBeforeUpdate('1.4.120')
    assert.equal(r.ok, true)
    assert.equal(r.folder, join(root, 'before-update'))
    assert.deepEqual(readdirSync(root), ['before-update'])
    const files = readdirSync(join(root, 'before-update')).sort()
    assert.equal(files.length, 2)
    assert.match(files[0], /^flashcards-\d{4}-\d\d-\d\d_\d{6}-before-1\.4\.120\.json$/)
    assert.match(files[1], /^jira-plus-projects-.*-before-1\.4\.120\.bundle$/)
    assert.equal(r.items.find((i) => i.id === 'notes').skipped, true)
    const restored = join(tmp('bk-restore-'), 'r')
    execFileSync('git', ['clone', '-q', join(root, 'before-update', files[1]), restored])
    assert.ok(readFileSync(join(restored, 'ISSUE-1.json'), 'utf8').includes('Sample task'))
    // A version that is not a plain version string is left out of the name.
    assert.ok((await svc.runBeforeUpdate('../evil')).items.every((i) => !i.file || !i.file.includes('evil')))

    // Keeps the newest BEFORE_UPDATE_KEEP of each item.
    for (let i = 0; i < globalLib.BEFORE_UPDATE_KEEP + 1; i++) {
      await new Promise((res) => setTimeout(res, 1100))
      await svc.runBeforeUpdate('1.4.121')
    }
    const after = readdirSync(join(root, 'before-update'))
    assert.equal(after.filter((n) => n.startsWith('flashcards-')).length, globalLib.BEFORE_UPDATE_KEEP)
    assert.equal(after.filter((n) => n.startsWith('jira-plus-projects-')).length, globalLib.BEFORE_UPDATE_KEEP)

    // A failure is reported per item and makes the whole result not ok.
    writeFileSync(join(decks, 'decks.json'), '{broken')
    const bad = await svc.runBeforeUpdate('1.4.122')
    assert.equal(bad.ok, false)
    assert.match(bad.items.find((i) => i.id === 'flashcards').error, /damaged/)
    assert.equal(bad.items.find((i) => i.id === 'jira-plus').ok, true)
    assert.equal((await svc.status()).lastBeforeUpdate.ok, false)
  })
})
