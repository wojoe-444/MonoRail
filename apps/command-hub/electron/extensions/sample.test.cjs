// The starter extension (extensions/hello-monorail) against the real runtime,
// and the SDK copies it carries are in sync with packages/extension-sdk.

const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test, after } = require('node:test')

const { API_VERSION } = require('./manifest.cjs')
const { BackendHost } = require('./host.cjs')
const { ExtensionManager } = require('./manager.cjs')

const repo = path.resolve(__dirname, '../../../..')
const sample = path.join(repo, 'extensions/hello-monorail')
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-sample-'))
const host = new BackendHost({ execPath: process.execPath, apiVersion: API_VERSION })
after(async () => {
  await host.stopAll()
  fs.rmSync(userData, { recursive: true, force: true })
})

test('SDK copies and theme.css are up to date (node packages/extension-sdk/sync.mjs)', () => {
  execFileSync(process.execPath, [path.join(repo, 'packages/extension-sdk/sync.mjs'), '--check'], { stdio: 'pipe' })
})

test('the starter extension installs and its backend works in the sandbox', async () => {
  const m = new ExtensionManager({ userData, host })
  m.init()
  const preview = await m.inspect({ kind: 'dev', path: sample })
  assert.equal(preview.id, 'hello-monorail')
  assert.equal(preview.compatible, true)
  assert.deepEqual(preview.permissions.map((p) => p.key), ['pick'])
  await m.confirm(preview.token)

  assert.deepEqual(await m.invoke('hello-monorail', 'listNotes'), [])
  const notes = await m.invoke('hello-monorail', 'addNote', { text: 'first' })
  assert.equal(notes[0].text, 'first')
  const info = await m.invoke('hello-monorail', 'getInfo')
  assert.equal(info.notes, 1)
  assert.equal(info.apiVersion, API_VERSION)
  await assert.rejects(m.invoke('hello-monorail', 'listFolder', { folder: os.homedir() }), /Pick the folder first/)

  // Granting a folder restarts the backend with read access to exactly that folder.
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-shared-'))
  fs.writeFileSync(path.join(shared, 'a.txt'), 'x')
  await m.grantFolder('hello-monorail', shared, false)
  assert.deepEqual(await m.invoke('hello-monorail', 'listFolder', { folder: shared }), [{ name: 'a.txt', dir: false }])
  fs.rmSync(shared, { recursive: true, force: true })
})
