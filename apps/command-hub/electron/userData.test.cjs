// Tests for the Command Hub -> MonoHub data folder move. Run with `npm test`.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const { resolveUserDataDir } = require('./userData.cjs')

const fresh = () => mkdtempSync(join(tmpdir(), 'monohub-appdata-'))

describe('resolveUserDataDir', () => {
  it('uses MonoHub on a clean machine', () => {
    const root = fresh()
    assert.deepEqual(resolveUserDataDir(root), { dir: join(root, 'MonoHub') })
  })

  it('moves the old Command Hub folder, keeping its contents', () => {
    const root = fresh()
    const old = join(root, 'Command Hub')
    mkdirSync(join(old, 'modules', 'jira', 'local-repo'), { recursive: true })
    writeFileSync(join(old, 'modules', 'jira', 'connection.json'), '{"token":"x"}')
    const r = resolveUserDataDir(root)
    assert.equal(r.dir, join(root, 'MonoHub'))
    assert.equal(r.migratedFrom, old)
    assert.equal(existsSync(old), false)
    assert.equal(readFileSync(join(r.dir, 'modules', 'jira', 'connection.json'), 'utf8'), '{"token":"x"}')
    assert.ok(existsSync(join(r.dir, 'modules', 'jira', 'local-repo')))
  })

  it('moves the command-hub folder that installed copies actually used', () => {
    const root = fresh()
    const old = join(root, 'command-hub')
    mkdirSync(join(old, 'apps', 'github-plus'), { recursive: true })
    writeFileSync(join(old, 'Local State'), '{"os_crypt":{}}')
    writeFileSync(join(old, 'apps', 'github-plus', 'backups.json'), '[]')
    const r = resolveUserDataDir(root)
    assert.equal(r.migratedFrom, old)
    assert.equal(readFileSync(join(r.dir, 'Local State'), 'utf8'), '{"os_crypt":{}}')
    assert.ok(existsSync(join(r.dir, 'apps', 'github-plus', 'backups.json')))
  })

  it('prefers the folder that holds data when both old names exist', () => {
    const root = fresh()
    mkdirSync(join(root, 'command-hub'))
    mkdirSync(join(root, 'Command Hub', 'modules'), { recursive: true })
    assert.equal(resolveUserDataDir(root).migratedFrom, join(root, 'Command Hub'))
  })

  it('leaves the old folder alone once MonoHub exists', () => {
    const root = fresh()
    mkdirSync(join(root, 'MonoHub'))
    mkdirSync(join(root, 'Command Hub'))
    assert.deepEqual(resolveUserDataDir(root), { dir: join(root, 'MonoHub') })
    assert.ok(existsSync(join(root, 'Command Hub')))
  })

  it('keeps using the old folder when it cannot be moved', () => {
    const root = fresh()
    mkdirSync(join(root, 'Command Hub'))
    let calls = 0
    const locked = () => {
      calls++
      throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' })
    }
    const r = resolveUserDataDir(root, { rename: locked, attempts: 3, delayMs: 1 })
    assert.equal(calls, 3)
    assert.equal(r.dir, join(root, 'Command Hub'))
    assert.ok(r.error)
  })

  it('retries while the previous version is still closing', () => {
    const root = fresh()
    mkdirSync(join(root, 'Command Hub'))
    let calls = 0
    const flaky = (a, b) => {
      if (++calls < 2) throw new Error('EPERM')
      require('node:fs').renameSync(a, b)
    }
    const r = resolveUserDataDir(root, { rename: flaky, delayMs: 1 })
    assert.equal(r.dir, join(root, 'MonoHub'))
  })
})
