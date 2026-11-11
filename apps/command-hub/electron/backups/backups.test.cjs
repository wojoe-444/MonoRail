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
    assert.deepEqual(g.items, { 'jira-plus': true, flashcards: false, notes: true })
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

  it('backs up Flashcards and Jira+ into their own subfolders and keeps the newest N', async () => {
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
    await globalLib.writeGlobal(userData, { enabled: true, folder: root, times: 1, unit: 'day', keep: 2, items: { 'jira-plus': false, flashcards: false, notes: false } })
    await svc.tick()
    const st = await svc.status()
    for (const p of st.pages.filter((x) => x.id !== 'github-plus')) assert.equal(p.nextDueAt, null)
  })
})
