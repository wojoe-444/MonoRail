// Tests for the GitHub+ git service. Run with `npm test` (node --test).
// Creates throwaway repos in the OS temp folder; needs `git` on PATH.
// Ported from wojoe-444/Local-Repo-UI (test/git.test.ts).

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, mkdtempSync, mkdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const git = require('./git.cjs')
const { parseDiff } = require('./diff.cjs')

let dir
const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' })

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'ghp-'))
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 'tester@example.invalid')
  g('config', 'user.name', 'Tester')
  g('config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'README.md'), '# Hi\n')
  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1\n')
  writeFileSync(join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 3]))
  g('add', '.')
  g('commit', '-qm', 'initial')
  g('checkout', '-qb', 'feature/x')
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 2\nexport const b = 3\n')
  g('commit', '-qam', 'change a\n\nbody text')
  g('tag', 'v1')
  g('checkout', '-q', 'main')
})

describe('git service', () => {
  it('opens repo and picks default ref', async () => {
    const i = await git.openRepo(dir)
    assert.equal(i.currentBranch, 'main')
    assert.equal(i.defaultRef, 'main')
    await assert.rejects(git.openRepo(tmpdir()))
  })

  it('lists refs, and ahead/behind as its own call', async () => {
    const refs = await git.listRefs(dir)
    assert.ok(refs.some((r) => r.type === 'branch' && r.name === 'feature/x'))
    assert.ok(refs.some((r) => r.type === 'tag' && r.name === 'v1'))
    const d = await git.branchDivergence(dir, 'main')
    assert.deepEqual(d['feature/x'], { ahead: 1, behind: 0 })
    assert.deepEqual(d.main, { ahead: 0, behind: 0 })
  })

  it('lists tree dirs first, last commits as a second call', async () => {
    const t = await git.listTree(dir, 'main', '')
    assert.deepEqual(
      t.map((e) => e.name),
      ['src', 'bin.dat', 'README.md'],
    )
    assert.equal(t[0].lastCommit, undefined)
    const last = await git.treeLastCommits(dir, 'main', '')
    assert.deepEqual(Object.keys(last).sort(), ['README.md', 'bin.dat', 'src'])
    assert.equal(last.src.subject, 'initial')
    const sub = await git.listTree(dir, 'main', 'src', true)
    assert.equal(sub[0].name, 'a.ts')
    assert.equal(sub[0].lastCommit?.subject, 'initial')
    assert.equal((await git.treeLastCommits(dir, 'feature/x', 'src'))['a.ts'].subject, 'change a')
    await assert.rejects(git.treeLastCommits(dir, 'no-such-branch', ''), /Unknown ref/)
  })

  it('finds the newest commit per entry in one walk, matching git log -1', async () => {
    const r = mkdtempSync(join(tmpdir(), 'ghp-last-'))
    const rg = (...a) => execFileSync('git', a, { cwd: r, encoding: 'utf8' })
    rg('init', '-q', '-b', 'main')
    rg('config', 'user.email', 'tester@example.invalid')
    rg('config', 'user.name', 'Tester')
    rg('config', 'commit.gpgsign', 'false')
    mkdirSync(join(r, 'docs', 'deep'), { recursive: true })
    for (const f of ['one.md', 'two.md', 'three.md']) writeFileSync(join(r, 'docs', f), f)
    writeFileSync(join(r, 'docs', 'deep', 'x.md'), 'x')
    rg('add', '.')
    rg('commit', '-qm', 'add docs')
    writeFileSync(join(r, 'docs', 'two.md'), 'two v2')
    rg('commit', '-qam', 'edit two')
    rg('mv', 'docs/one.md', 'docs/uno.md')
    rg('commit', '-qm', 'rename one')
    writeFileSync(join(r, 'docs', 'deep', 'x.md'), 'x v2')
    rg('commit', '-qam', 'edit deep')
    const last = await git.treeLastCommits(r, 'main', 'docs')
    for (const name of ['deep', 'two.md', 'three.md', 'uno.md']) {
      const expected = rg('log', '-1', '--format=%s', 'main', '--', `docs/${name}`).trim()
      assert.equal(last[name]?.subject, expected, name)
    }
    assert.equal(last.deep.subject, 'edit deep')
    assert.equal(last['uno.md'].subject, 'rename one')
  })

  it('reads blobs', async () => {
    const b = await git.readBlob(dir, 'feature/x', 'src/a.ts')
    assert.equal(b.kind, 'text')
    assert.match(b.content, /b = 3/)
    assert.equal((await git.readBlob(dir, 'main', 'bin.dat')).kind, 'binary')
  })

  it('logs and commit detail', async () => {
    const { commits } = await git.getLog(dir, { ref: 'feature/x' })
    assert.deepEqual(
      commits.map((c) => c.subject),
      ['change a', 'initial'],
    )
    assert.equal(commits[0].body, 'body text')
    const d = await git.getCommit(dir, commits[0].sha)
    assert.equal(d.files[0].newPath, 'src/a.ts')
    assert.equal(d.files[0].additions, 2)
    assert.equal(d.files[0].deletions, 1)
    const root = await git.getCommit(dir, commits[1].sha)
    assert.ok(root.files.every((f) => f.status === 'added'))
  })

  it('compares refs', async () => {
    const c = await git.compareRefs(dir, 'main', 'feature/x')
    assert.equal(c.commits.length, 1)
    assert.equal(c.files.length, 1)
  })

  it('rejects option-like refs and traversal', async () => {
    await assert.rejects(git.getLog(dir, { ref: '--output=x' }))
    await assert.rejects(git.readBlob(dir, 'main', '../x'))
    await assert.rejects(git.compareRefs(dir, 'main', '--output=x'))
    await assert.rejects(git.getCommit(dir, '--help'))
    assert.ok(await git.getLog(dir, { ref: 'main', skip: '--output=x' }))
  })

  it('never runs repo-configured textconv/external diff programs', async () => {
    const marker = join(dir, 'pwned.txt')
    writeFileSync(join(dir, '.gitattributes'), '*.ts diff=evil\n')
    g('config', 'diff.evil.textconv', `touch "${marker.replace(/\\/g, '/')}" #`)
    g('config', 'diff.evil.command', `touch "${marker.replace(/\\/g, '/')}" #`)
    await git.compareRefs(dir, 'main', 'feature/x')
    const { commits } = await git.getLog(dir, { ref: 'feature/x' })
    await git.getCommit(dir, commits[0].sha)
    assert.equal(existsSync(marker), false)
  })
})

describe('parseDiff', () => {
  it('tracks line numbers and renames', () => {
    const f = parseDiff(
      'diff --git a/x b/y\nsimilarity index 90%\nrename from x\nrename to y\n--- a/x\n+++ b/y\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n',
    )
    assert.equal(f[0].status, 'renamed')
    assert.deepEqual(
      f[0].hunks[0].lines.map((l) => [l.type, l.oldNo, l.newNo]),
      [
        ['context', 1, 1],
        ['del', 2, null],
        ['add', null, 2],
      ],
    )
  })
})

describe('backups', () => {
  const { createBackupService } = require('./backup.cjs')
  const { readdirSync } = require('node:fs')

  it('writes verified bundles, keeps the newest N, and schedules the next run', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'ghp-data-'))
    const dest = mkdtempSync(join(tmpdir(), 'ghp-dest-'))
    const svc = createBackupService(() => dataDir)
    const repo = (await git.openRepo(dir)).path

    await assert.rejects(svc.run(repo), /Set up backups/)
    await assert.rejects(svc.save(repo, { enabled: true, times: 0, unit: 'day', keep: 2, destination: dest }))
    await assert.rejects(svc.save(repo, { enabled: true, times: 1, unit: 'year', keep: 2, destination: dest }))

    const saved = await svc.save(repo, { enabled: true, times: 1, unit: 'day', keep: 2, destination: dest })
    assert.equal(saved.schedule.times, 1)
    assert.ok(Date.parse(saved.nextDueAt) <= Date.now(), 'first backup is due right away')

    for (let i = 0; i < 3; i++) {
      await svc.run(repo)
      await new Promise((r) => setTimeout(r, 1100)) // distinct second-resolution names
    }
    const state = await svc.get(repo)
    assert.equal(state.files.length, 2)
    assert.equal(state.lastResult.ok, true)
    const due = Date.parse(state.nextDueAt) - Date.parse(state.lastSuccessAt)
    assert.equal(due, 86_400_000)
    assert.ok(!readdirSync(join(dest, state.files[0].path.split(/[\\/]/).at(-2))).some((n) => n.endsWith('.partial')))

    // Not due again yet, so a tick adds nothing.
    await svc.tick()
    assert.equal((await svc.get(repo)).files.length, 2)

    // The bundle restores with plain git clone, with every branch.
    const restored = join(mkdtempSync(join(tmpdir(), 'ghp-restore-')), 'r')
    execFileSync('git', ['clone', '-q', state.files[0].path, restored])
    const branches = execFileSync('git', ['branch', '-r'], { cwd: restored, encoding: 'utf8' })
    assert.match(branches, /feature\/x/)
  })

  it('records failures and retries later instead of every minute', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'ghp-data-'))
    const svc = createBackupService(() => dataDir)
    const empty = mkdtempSync(join(tmpdir(), 'ghp-empty-'))
    execFileSync('git', ['init', '-q'], { cwd: empty })
    const repo = (await git.openRepo(empty)).path
    await svc.save(repo, { enabled: true, times: 4, unit: 'hour', keep: 3, destination: mkdtempSync(join(tmpdir(), 'ghp-dest-')) })
    await assert.rejects(svc.run(repo), /no commits/)
    const state = await svc.get(repo)
    assert.equal(state.lastResult.ok, false)
    assert.equal(Date.parse(state.nextDueAt) - Date.parse(state.lastResult.at), 15 * 60_000)
  })

  it('follows the global backup folder and frequency, and a changed folder only moves future backups', async () => {
    const globalLib = require('../../backups/global.cjs')
    const userData = mkdtempSync(join(tmpdir(), 'ghp-user-'))
    const dataDir = join(userData, 'apps', 'github-plus')
    mkdirSync(dataDir, { recursive: true })
    const svc = createBackupService(() => dataDir)
    const repo = (await git.openRepo(dir)).path
    const name = repo.split(/[\\/]/).at(-1)
    const follow = { enabled: true, times: 1, unit: 'day', keep: 5, destination: '', useGlobalFolder: true, useGlobalFrequency: true }

    // Global folder off: following it is refused.
    await assert.rejects(svc.save(repo, follow), /global backup folder is off/)

    const rootA = mkdtempSync(join(tmpdir(), 'ghp-rootA-'))
    await globalLib.writeGlobal(userData, { enabled: true, folder: rootA, times: 3, unit: 'week', keep: 2 })
    const saved = await svc.save(repo, follow)
    assert.equal(saved.effective.destination, join(rootA, 'github-plus'))
    assert.equal(saved.effective.times, 3)
    assert.equal(saved.effective.unit, 'week')

    await svc.run(repo)
    assert.equal(readdirSync(join(rootA, 'github-plus', name)).filter((n) => n.endsWith('.bundle')).length, 1)
    assert.deepEqual(readdirSync(rootA), ['github-plus'], 'nothing loose in the global folder')

    // A new global folder: the next backup goes there, the old one is left alone.
    const rootB = mkdtempSync(join(tmpdir(), 'ghp-rootB-'))
    await globalLib.writeGlobal(userData, { enabled: true, folder: rootB, times: 1, unit: 'day', keep: 2 })
    await new Promise((r) => setTimeout(r, 1100))
    await svc.run(repo)
    assert.equal(readdirSync(join(rootA, 'github-plus', name)).length, 1)
    assert.equal(readdirSync(join(rootB, 'github-plus', name)).length, 1)
    const state = await svc.get(repo)
    assert.equal(Date.parse(state.nextDueAt) - Date.parse(state.lastSuccessAt), 86_400_000)

    // An own folder wins over the global one.
    const own = mkdtempSync(join(tmpdir(), 'ghp-own-'))
    const ownSaved = await svc.save(repo, { ...follow, useGlobalFolder: false, destination: own })
    assert.equal(ownSaved.effective.destination, own)

    // Global turned off later: the schedule pauses with a reason instead of failing every minute.
    await globalLib.writeGlobal(userData, { enabled: false, folder: rootB, times: 1, unit: 'day', keep: 2 })
    const paused = await svc.get(repo)
    assert.equal(paused.nextDueAt, null)
    assert.match(paused.problem, /global backup folder/)
    await assert.rejects(svc.run(repo), /global backup folder/)
  })
})

describe('making a plain folder a repo', () => {
  const init = require('./init.cjs')
  const { readFileSync, truncateSync } = require('node:fs')

  it('previews, then inits with a .gitignore and a first commit, leaving files in place', async () => {
    const plain = mkdtempSync(join(tmpdir(), 'ghp-plain-'))
    writeFileSync(join(plain, 'notes.md'), '# Notes\n')
    mkdirSync(join(plain, 'docs'))
    writeFileSync(join(plain, 'docs', 'cv [final].txt'), 'hello\n')
    writeFileSync(join(plain, '.env'), 'TOKEN=abc\n')
    writeFileSync(join(plain, 'big.bin'), '')
    truncateSync(join(plain, 'big.bin'), init.LARGE_BYTES + 1)
    mkdirSync(join(plain, 'node_modules'))
    writeFileSync(join(plain, 'node_modules', 'x.js'), '')

    await assert.rejects(git.openRepo(plain), /not inside a git repository/)
    const p = await init.previewFolder(plain)
    assert.equal(p.fileCount, 4)
    assert.deepEqual(p.large.map((f) => f.path), ['big.bin'])
    assert.deepEqual(p.sensitive, ['.env'])
    assert.deepEqual(p.skippedDirs, ['node_modules'])

    const r = await init.initRepo(plain)
    assert.deepEqual(r.excluded.sort(), ['.env', 'big.bin'])
    const info = await git.openRepo(plain)
    assert.equal(info.defaultRef, 'main')
    const tree = await git.listTree(info.path, 'main', '', false)
    assert.deepEqual(tree.map((e) => e.name).sort(), ['.gitignore', 'docs', 'notes.md'])
    assert.equal(readFileSync(join(plain, '.env'), 'utf8'), 'TOKEN=abc\n', 'files are untouched')
    await assert.rejects(init.initRepo(plain), /already inside/)
  })

  it('refuses drive roots and the home folder', async () => {
    await assert.rejects(init.previewFolder(require('node:path').parse(tmpdir()).root), /whole drive/)
    await assert.rejects(init.previewFolder(require('node:os').homedir()), /user folder/)
  })

  it('escapes paths written to .gitignore', () => {
    assert.equal(init.ignoreLine('a/#b [1]*.txt'), '/a/\\#b \\[1\\]\\*.txt')
  })
})

describe('dashboard activity', () => {
  it('summarizes commits on all branches and active branches with ahead/behind', async () => {
    const a = await git.recentActivity(dir)
    assert.equal(a.defaultRef, 'main')
    assert.ok(a.commits.some((c) => c.subject === 'change a'), 'includes commits from other branches')
    const f = a.branches.find((b) => b.name === 'feature/x')
    assert.equal(f.ahead, 1)
    assert.equal(f.behind, 0)
    assert.equal(a.branches.find((b) => b.name === 'main').isDefault, true)
  })

  it('gives the same ahead/behind on git older than 2.41 (one rev-list per branch)', async () => {
    const before = await git.recentActivity(dir)
    git._useRevListDivergence()
    const after = await git.recentActivity(dir)
    assert.deepEqual(after.branches, before.branches)
    assert.deepEqual((await git.branchDivergence(dir, 'main'))['feature/x'], { ahead: 1, behind: 0 })
  })
})

describe('local issues', () => {
  const issues = require('./issues.cjs')
  let repo
  const r = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })

  before(() => {
    repo = mkdtempSync(join(tmpdir(), 'ghp-issues-'))
    r('init', '-q', '-b', 'main')
    r('config', 'user.email', 'tester@example.invalid')
    r('config', 'user.name', 'Tester')
    r('config', 'commit.gpgsign', 'true') // must be ignored: issue commits are never signed
    writeFileSync(join(repo, 'a.txt'), 'one\n')
    r('add', '.')
    r('-c', 'commit.gpgsign=false', 'commit', '-qm', 'initial')
    writeFileSync(join(repo, 'a.txt'), 'uncommitted edit\n')
  })

  it('starts empty', async () => {
    assert.deepEqual(await issues.listIssues(repo, 'all'), [])
    assert.deepEqual(await issues.issueCounts(repo), { open: 0, closed: 0 })
  })

  it('creates, comments, closes and reopens without touching the working tree', async () => {
    const statusBefore = r('status', '--porcelain')
    const headBefore = r('rev-parse', 'HEAD')
    const one = await issues.createIssue(repo, { title: '  Crash on save\n', body: 'Steps:\r\n1. save' })
    assert.equal(one.number, 1)
    assert.equal(one.title, 'Crash on save')
    assert.equal(one.body, 'Steps:\n1. save')
    assert.equal(one.author, 'Tester')
    const two = await issues.createIssue(repo, { title: 'Second' })
    assert.equal(two.number, 2)

    await issues.addComment(repo, 1, { body: 'Seen it too' })
    const closed = await issues.updateIssue(repo, 1, { state: 'closed' })
    assert.equal(closed.state, 'closed')
    assert.ok(closed.closedAt)
    assert.deepEqual(closed.timeline.map((t) => t.kind), ['comment', 'closed'])

    assert.deepEqual((await issues.listIssues(repo, 'open')).map((i) => i.number), [2])
    const all = await issues.listIssues(repo, 'all')
    assert.deepEqual(all.map((i) => i.number), [2, 1])
    assert.equal(all[1].comments, 1)
    assert.deepEqual(await issues.issueCounts(repo), { open: 1, closed: 1 })

    const re = await issues.updateIssue(repo, 1, { state: 'open', title: 'Crash on save (Windows)' })
    assert.equal(re.state, 'open')
    assert.equal(re.closedAt, null)
    assert.equal((await issues.getIssue(repo, 1)).title, 'Crash on save (Windows)')

    assert.equal(r('status', '--porcelain'), statusBefore)
    assert.equal(r('rev-parse', 'HEAD'), headBefore)
    assert.equal(r('log', '--format=%s', issues.ISSUES_REF).trim().split('\n').length, 5, 'one commit per change')
    assert.equal(r('for-each-ref', '--format=%(refname)', 'refs/heads').trim(), 'refs/heads/main')
  })

  it('keeps issue commits out of the dashboard feed and in backups', async () => {
    const a = await git.recentActivity(repo)
    assert.ok(a.commits.every((c) => c.subject === 'initial'))
    const file = join(repo, '..', `ghp-issues-${Date.now()}.bundle`)
    await git.createBundle(repo, file)
    assert.match(execFileSync('git', ['bundle', 'list-heads', file], { encoding: 'utf8' }), /refs\/local-issues/)
  })

  it('handles many writes at once', async () => {
    await Promise.all(Array.from({ length: 5 }, (_, i) => issues.createIssue(repo, { title: `Batch ${i}` })))
    const nums = (await issues.listIssues(repo, 'all')).map((i) => i.number)
    assert.deepEqual(nums, [7, 6, 5, 4, 3, 2, 1])
  })

  it('rejects bad input', async () => {
    await assert.rejects(issues.createIssue(repo, { title: '   ' }), /needs a title/)
    await assert.rejects(issues.createIssue(repo, { title: 'x'.repeat(300) }), /limited/)
    await assert.rejects(issues.getIssue(repo, '1; rm'), /Invalid issue number/)
    await assert.rejects(issues.getIssue(repo, 99), /not found/)
    await assert.rejects(issues.addComment(repo, 1, { body: ' ' }), /needs some text/)
    await assert.rejects(issues.updateIssue(repo, 1, { state: 'deleted' }), /Invalid state/)
  })
})
