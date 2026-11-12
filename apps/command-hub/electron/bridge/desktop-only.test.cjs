// Every backend method that calls an Electron API needing this PC's screen
// (dialog, shell, BrowserWindow, autoUpdater, ...) must be in its backend's
// `desktopOnly` list, so the optional Remote access mode never runs it.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { screenApiMethods, desktopOnlyIndex } = require('./desktop-only.cjs')

const electronDir = path.join(__dirname, '..')

function moduleBackends() {
  const index = fs.readFileSync(path.join(electronDir, 'modules', 'index.cjs'), 'utf8')
  const block = index.slice(index.indexOf('const moduleBackends = ['), index.indexOf(']', index.indexOf('const moduleBackends = [')))
  const files = [...block.matchAll(/require\('\.\/([\w-]+\.cjs)'\)/g)].map((m) => m[1])
  assert.ok(files.length > 5, 'found the module backend list')
  return files.map((f) => require(path.join(electronDir, 'modules', f)))
}

function appBackends() {
  return require(path.join(electronDir, 'apps', 'index.cjs'))
}

const all = () => [...moduleBackends().map((b) => [b.id, b]), ...appBackends().map((b) => [`app:${b.id}`, b])]

test('every method that uses a screen API is listed as desktopOnly', () => {
  const missing = []
  for (const [id, backend] of all()) {
    const listed = new Set(backend.desktopOnly ?? [])
    for (const name of screenApiMethods(backend)) if (!listed.has(name)) missing.push(`${id}.${name}`)
  }
  assert.deepEqual(missing, [], `add these to the backend's desktopOnly list: ${missing.join(', ')}`)
})

test('desktopOnly lists only name real methods', () => {
  for (const [id, backend] of all()) {
    for (const name of backend.desktopOnly ?? []) {
      assert.equal(typeof backend.methods[name], 'function', `${id}.desktopOnly names an unknown method: ${name}`)
    }
  }
})

test('the extensions backend lists its dialog and link methods', () => {
  const src = fs.readFileSync(path.join(electronDir, 'extensions', 'index.cjs'), 'utf8')
  const line = /desktopOnly: \[([^\]]*)\]/.exec(src)
  assert.ok(line, 'extensions backend has a desktopOnly list')
  for (const name of ['inspect', 'requestFolder', 'openFolder', 'openExternal']) assert.match(line[1], new RegExp(`'${name}'`))
})

test('desktopOnlyIndex answers per module and never for extension backends', () => {
  const idx = desktopOnlyIndex([
    ['storage', { methods: { open() {}, read() {} }, desktopOnly: ['open'] }],
    ['home', { methods: { read() {} } }],
  ])
  assert.equal(idx.isDesktopOnly('storage', 'open'), true)
  assert.equal(idx.isDesktopOnly('storage', 'read'), false)
  assert.equal(idx.isDesktopOnly('home', 'read'), false)
  assert.equal(idx.isDesktopOnly('ext:hello', 'open'), false)
  assert.deepEqual(idx.list(), { storage: ['open'] })
})

test('screenApiMethods finds direct calls only', () => {
  const backend = {
    methods: {
      async pick() {
        return dialog.showOpenDialog({}) // eslint-disable-line no-undef
      },
      async link() {
        return shell.openExternal('https://example.com') // eslint-disable-line no-undef
      },
      async read() {
        return { dialogTitle: 'not a call' }
      },
    },
  }
  assert.deepEqual(screenApiMethods(backend).sort(), ['link', 'pick'])
})
