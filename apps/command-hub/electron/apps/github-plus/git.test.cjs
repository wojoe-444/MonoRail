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

  it('lists refs with ahead/behind', async () => {
    const refs = await git.listRefs(dir)
    const f = refs.find((r) => r.name === 'feature/x')
    assert.equal(f.ahead, 1)
    assert.equal(f.behind, 0)
    assert.ok(refs.some((r) => r.type === 'tag' && r.name === 'v1'))
  })

  it('lists tree dirs first with last commit', async () => {
    const t = await git.listTree(dir, 'main', '')
    assert.deepEqual(
      t.map((e) => e.name),
      ['src', 'bin.dat', 'README.md'],
    )
    assert.equal(t[0].lastCommit?.subject, 'initial')
    const sub = await git.listTree(dir, 'main', 'src')
    assert.equal(sub[0].name, 'a.ts')
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
