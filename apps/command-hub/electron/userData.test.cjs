// Tests for choosing the data folder. Run with `npm test`.
// Nothing may ever be moved, renamed or deleted.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, readdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const { resolveUserDataDir } = require('./userData.cjs')

const fresh = () => mkdtempSync(join(tmpdir(), 'monorail-appdata-'))
const withData = (root, name) => mkdirSync(join(root, name, 'modules'), { recursive: true })
const names = (root) => readdirSync(root).sort()

describe('resolveUserDataDir', () => {
  it('uses MonoRail on a clean machine and creates nothing', () => {
    const root = fresh()
    assert.equal(resolveUserDataDir(root), join(root, 'MonoRail'))
    assert.deepEqual(names(root), [])
  })

  it('keeps using command-hub in place for older installs', () => {
    const root = fresh()
    withData(root, 'command-hub')
    writeFileSync(join(root, 'command-hub', 'Local State'), '{}')
    assert.equal(resolveUserDataDir(root), join(root, 'command-hub'))
    assert.deepEqual(names(root), ['command-hub'])
  })

  it('keeps using MonoHub in place', () => {
    const root = fresh()
    withData(root, 'MonoHub')
    assert.equal(resolveUserDataDir(root), join(root, 'MonoHub'))
    assert.deepEqual(names(root), ['MonoHub'])
  })

  it('prefers the newest name when several hold data, and leaves all of them', () => {
    const root = fresh()
    withData(root, 'command-hub')
    withData(root, 'MonoHub')
    assert.equal(resolveUserDataDir(root), join(root, 'MonoHub'))
    withData(root, 'MonoRail')
    assert.equal(resolveUserDataDir(root), join(root, 'MonoRail'))
    assert.deepEqual(names(root), ['MonoHub', 'MonoRail', 'command-hub'])
  })

  it('prefers a folder with data over a newer empty one', () => {
    const root = fresh()
    mkdirSync(join(root, 'MonoRail'))
    withData(root, 'command-hub')
    assert.equal(resolveUserDataDir(root), join(root, 'command-hub'))
  })

  it('counts Local State alone as data', () => {
    const root = fresh()
    mkdirSync(join(root, 'MonoRail'))
    mkdirSync(join(root, 'Command Hub'))
    writeFileSync(join(root, 'Command Hub', 'Local State'), '{}')
    assert.equal(resolveUserDataDir(root), join(root, 'Command Hub'))
  })
})
