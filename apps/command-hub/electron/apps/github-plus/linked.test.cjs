// Tests for linked.cjs: repos other MonoRail apps created (Tasks' private
// projects) show up in GitHub+ without being opened. Needs `git` on PATH.

const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtempSync, mkdirSync, existsSync, readdirSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const { linkedRepos, mergeRecents, _resetForTests } = require('./linked.cjs')

function userData() {
  const root = mkdtempSync(join(tmpdir(), 'ghp-linked-'))
  const ghp = join(root, 'apps', 'github-plus')
  mkdirSync(ghp, { recursive: true })
  return { root, ghp }
}
const gitInit = (dir) => {
  mkdirSync(dir, { recursive: true })
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
}

describe('linked repos', () => {
  beforeEach(() => _resetForTests())

  it('lists nothing when Tasks has no repo yet, and creates nothing', async () => {
    const { root, ghp } = userData()
    assert.deepEqual(await linkedRepos(ghp), [])
    assert.deepEqual(readdirSync(join(root, 'apps')), ['github-plus'])
  })

  it("lists Tasks' local repo with the path git reports", async () => {
    const { root, ghp } = userData()
    const repo = join(root, 'apps', 'jira-plus', 'local-repo')
    gitInit(repo)
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: repo, encoding: 'utf8' }).trim()
    const list = await linkedRepos(ghp)
    assert.deepEqual(list, [{ path: top, app: 'jira-plus', label: 'Tasks', name: 'Tasks projects' }])
  })

  it("lists Notes' repo after Tasks'", async () => {
    const { root, ghp } = userData()
    gitInit(join(root, 'apps', 'jira-plus', 'local-repo'))
    gitInit(join(root, 'modules', 'notes', 'repo'))
    const list = await linkedRepos(ghp)
    assert.deepEqual(list.map((l) => [l.app, l.name]), [['jira-plus', 'Tasks projects'], ['notes', 'Notes']])
    assert.ok(list[1].path.replace(/\\/g, '/').endsWith('modules/notes/repo'))
  })

  it('finds the repo in the legacy jira module folder, in place', async () => {
    const { root, ghp } = userData()
    const legacy = join(root, 'modules', 'jira', 'local-repo')
    gitInit(legacy)
    const list = await linkedRepos(ghp)
    assert.equal(list.length, 1)
    assert.ok(list[0].path.replace(/\\/g, '/').endsWith('modules/jira/local-repo'))
    assert.ok(!existsSync(join(root, 'apps', 'jira-plus')))
  })

  it('leaves out a folder that is not a repo', async () => {
    const { root, ghp } = userData()
    mkdirSync(join(root, 'apps', 'jira-plus', 'local-repo', '.git'), { recursive: true })
    assert.deepEqual(await linkedRepos(ghp), [])
  })

  it('leaves out a folder that only sits inside another repo', async () => {
    const { root, ghp } = userData()
    gitInit(root)
    mkdirSync(join(root, 'apps', 'jira-plus', 'local-repo', '.git'), { recursive: true })
    assert.deepEqual(await linkedRepos(ghp), [])
  })

  it('appends linked repos after the recents, once', () => {
    assert.deepEqual(mergeRecents(['a', 'j'], [{ path: 'j' }]), ['a', 'j'])
    assert.deepEqual(mergeRecents(['a'], [{ path: 'j' }]), ['a', 'j'])
    assert.deepEqual(mergeRecents([], []), [])
  })
})
