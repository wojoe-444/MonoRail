// Tests for the extension system: manifest rules, packages, the manager and
// the sandboxed backend process. Run with `npm test` (plain Node; the child
// process runs under Node's permission model just as it does in MonoRail).

const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { test, after } = require('node:test')
const { zipSync, strToU8 } = require('fflate')

const manifest = require('./manifest.cjs')
const install = require('./install.cjs')
const { BackendHost } = require('./host.cjs')
const { ExtensionManager } = require('./manager.cjs')
const { SecretStore } = require('./secrets.cjs')
const { ERROR_CODES } = require('./errors.cjs')

const DENIED = /ERR_ACCESS_DENIED|denied|restricted/i
const tmpRoots = []
function tmp(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `monorail-ext-${name}-`))
  tmpRoots.push(dir)
  return dir
}
const hosts = []
after(async () => {
  await Promise.all(hosts.map((h) => h.stopAll()))
  for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true })
})

function baseManifest(extra = {}) {
  return {
    manifestVersion: 1,
    id: 'hello-test',
    name: 'Hello Test',
    version: '1.0.0',
    engines: { monorail: '^1.0.0' },
    contributes: { modules: [{ id: 'main', title: 'Hello', entry: 'index.html' }] },
    ...extra,
  }
}

const BACKEND = `
const fs = require('node:fs')
const path = require('node:path')
module.exports = {
  async start(ctx) { ctx.log('started', ctx.extension.version) },
  methods: {
    async ping(ctx, args) { return { pong: args?.n ?? 0, version: ctx.extension.version } },
    async writeData(ctx) { fs.writeFileSync(path.join(ctx.dataDir, 'note.txt'), 'hi'); return fs.readFileSync(path.join(ctx.dataDir, 'note.txt'), 'utf8') },
    async readOutside(ctx, file) { return fs.readFileSync(file, 'utf8') },
    async writeOwnCode(ctx) { fs.writeFileSync(path.join(ctx.extensionDir, 'hacked.txt'), 'x') },
    async env() { return Object.keys(process.env) },
    async spawn() { return require('node:child_process').execFileSync(process.execPath, ['-e', '1']).toString() },
    async fetchUrl(ctx, url) { try { const r = await fetch(url); return r.status } catch (e) { throw new Error(e.cause?.message ?? e.message) } },
    async emit(ctx) { ctx.emit('tick', { n: 1 }); return true },
    async boom() { throw Object.assign(new Error('nope'), { code: 'E_NOPE' }) },
    async failCoded(ctx) { ctx.fail('NOT_SIGNED_IN', 'Sign in first', { retry: false }) },
    async badCode() { throw Object.assign(new Error('odd'), { code: 42 }) },
    async badResult() { return { n: 1n } },
    async badEmit(ctx) { ctx.emit('x', { n: 1n }) },
    async setSecret(ctx, { name, value }) { await ctx.secrets.set(name, value); return ctx.secrets.list() },
    async getSecret(ctx, { name }) { return ctx.secrets.get(name) },
    async deleteSecret(ctx, { name }) { await ctx.secrets.delete(name); return ctx.secrets.list() },
    async migrations() { return globalThis.migrations ?? [] },
  },
  async migrate(ctx, from) { (globalThis.migrations ??= []).push(from); if (from === 'explode') throw new Error('cannot migrate') },
}
`

function writeExtension(dir, m = baseManifest({ backend: { main: 'backend/index.cjs' } })) {
  fs.mkdirSync(path.join(dir, 'ui'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'backend'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'monorail.json'), JSON.stringify(m, null, 2))
  fs.writeFileSync(path.join(dir, 'ui', 'index.html'), '<!doctype html><title>hi</title>')
  fs.writeFileSync(path.join(dir, 'backend', 'index.cjs'), BACKEND)
  return dir
}

function newManager(opts = {}) {
  const userData = tmp('userdata')
  const events = []
  const host = new BackendHost({ execPath: process.execPath, apiVersion: manifest.API_VERSION, onEmit: (...a) => events.push(a) })
  const m = new ExtensionManager({ userData, host, ...opts })
  hosts.push(host)
  m.init()
  return { m, host, userData, events }
}

// ---------------------------------------------------------------- manifest --

test('semver ranges', () => {
  assert.ok(manifest.satisfies('1.2.3', '^1.0.0'))
  assert.ok(!manifest.satisfies('2.0.0', '^1.0.0'))
  assert.ok(manifest.satisfies('0.3.1', '^0.3.0'))
  assert.ok(!manifest.satisfies('0.4.0', '^0.3.0'))
  assert.ok(manifest.satisfies('1.2.9', '~1.2.0'))
  assert.ok(!manifest.satisfies('1.3.0', '~1.2.0'))
  assert.ok(manifest.satisfies('3.0.0', '>=1.0.0'))
  assert.ok(manifest.satisfies('1.9.0', '1'))
  assert.ok(manifest.satisfies('1.0.0', '*'))
  assert.equal(manifest.compareVersions('1.0.0', '1.0.0-beta'), 1)
  assert.equal(manifest.compareVersions('1.10.0', '1.9.0'), 1)
})

test('valid manifest is normalized', () => {
  const m = manifest.validateManifest(baseManifest({ permissions: { network: ['API.example.com', '*.mojang.com'], filesystem: { read: ['~/.minecraft/'] } } }))
  assert.equal(m.ui, 'ui')
  assert.equal(m.contributes.modules[0].nav.section, 'Extensions')
  assert.deepEqual(m.permissions.network, ['*.mojang.com', 'api.example.com'])
  assert.deepEqual(m.permissions.filesystem.read, ['~/.minecraft'])
  assert.equal(m.permissions.process, false)
  assert.ok(manifest.apiCompatible(m))
})

test('manifest rejects bad input', () => {
  const bad = [
    [{ manifestVersion: 2 }, /manifestVersion/],
    [{ id: 'Bad_Id' }, /kebab-case/],
    [{ version: 'one' }, /semver/],
    [{ engines: {} }, /engines.monorail/],
    [{ contributes: { modules: [{ id: 'a', title: 'A', entry: '../x.html' }] } }, /inside the extension/],
    [{ contributes: { modules: [{ id: 'a', title: 'A', entry: 'C:/x.html' }] } }, /inside the extension/],
    [{ contributes: {} }, /contributes nothing/],
    [{ permissions: { network: [] } }, /non-empty/],
    [{ permissions: { network: ['http://x.com'] } }, /invalid host/],
    [{ permissions: { filesystem: { read: ['/etc'] } } }, /start with ~\//],
    [{ permissions: { filesystem: { read: ['~/../etc'] } } }, /\.\./],
    [{ permissions: { camera: true } }, /Unknown permission/],
    [{ backend: { main: 'b.cjs', activation: 'always' } }, /activation/],
    [{ repository: 'not a repo' }, /owner\/name/],
  ]
  for (const [patch, re] of bad) assert.throws(() => manifest.validateManifest(baseManifest(patch)), re, JSON.stringify(patch))
})

test('incompatible API major is detected', () => {
  const m = manifest.validateManifest(baseManifest({ engines: { monorail: '^2.0.0' } }))
  assert.equal(manifest.apiCompatible(m), false)
})

test('added permissions are listed for update prompts', () => {
  const prev = manifest.normalizePermissions({ network: ['a.com'] })
  const next = manifest.normalizePermissions({ network: ['a.com', 'b.com'], process: ['git'] })
  assert.deepEqual(manifest.addedPermissions(prev, next).map((p) => p.key), ['net:b.com', 'proc:git'])
})

// ---------------------------------------------------------------- packages --

test('zip packages unpack, with or without a top-level folder', () => {
  const staging = tmp('staging')
  const files = {
    'hello/monorail.json': strToU8(JSON.stringify(baseManifest())),
    'hello/ui/index.html': strToU8('<p>hi</p>'),
  }
  const staged = install.stageZipBytes(staging, zipSync(files))
  assert.equal(staged.manifest.id, 'hello-test')
  assert.ok(fs.existsSync(path.join(staged.root, 'ui', 'index.html')))
})

test('zip-slip entries are refused', () => {
  const staging = tmp('staging')
  const files = { 'monorail.json': strToU8(JSON.stringify(baseManifest())), '../evil.txt': strToU8('x') }
  assert.throws(() => install.stageZipBytes(staging, zipSync(files)), /unsafe path/)
  assert.ok(!fs.existsSync(path.join(path.dirname(staging), 'evil.txt')))
})

test('GitHub repo input is parsed', () => {
  assert.equal(install.parseRepo('https://github.com/octo-org/mc-bot.git'), 'octo-org/mc-bot')
  assert.equal(install.parseRepo('octo-org/mc-bot'), 'octo-org/mc-bot')
  assert.throws(() => install.parseRepo('nope'), /owner\/name/)
})

test('GitHub install picks the .monorail.zip asset and checks the repository', async () => {
  const zip = zipSync({ 'monorail.json': strToU8(JSON.stringify(baseManifest({ repository: 'octo-org/hello', version: '1.2.0' }))), 'ui/index.html': strToU8('x') })
  const fakeFetch = async (url) => {
    if (url.includes('/releases/latest'))
      return new Response(JSON.stringify({ tag_name: 'v1.2.0', assets: [{ name: 'notes.txt' }, { name: 'hello-1.2.0.monorail.zip', browser_download_url: 'https://dl/hello.zip', size: zip.length }] }), { status: 200 })
    if (url === 'https://dl/hello.zip') return new Response(zip, { status: 200 })
    return new Response('', { status: 404 })
  }
  const { m } = newManager({ fetchImpl: fakeFetch })
  const preview = await m.inspect({ kind: 'github', repo: 'octo-org/hello' })
  assert.equal(preview.version, '1.2.0')
  await m.confirm(preview.token)
  assert.equal(m.list().extensions[0].source.repo, 'octo-org/hello')
  await assert.rejects(m.inspect({ kind: 'github', repo: 'someone-else/hello' }), /comes from octo-org\/hello/)
})

// ----------------------------------------------------------------- manager --

test('install from a folder, list, disable, uninstall', async () => {
  const src = writeExtension(tmp('src'))
  const { m, host, userData } = newManager()
  const preview = await m.inspect({ kind: 'folder', path: src })
  assert.equal(preview.id, 'hello-test')
  assert.equal(preview.compatible, true)
  assert.equal(m.list().extensions.length, 0, 'nothing installed before confirm')

  await m.confirm(preview.token)
  const [ext] = m.list().extensions
  assert.equal(ext.status, 'active')
  assert.ok(fs.existsSync(path.join(userData, 'extensions', 'hello-test', 'monorail.json')))
  assert.equal(m.uiRoot('hello-test'), path.join(userData, 'extensions', 'hello-test', 'ui'))
  assert.equal(m.uiRoot('../etc'), undefined)

  await m.setEnabled('hello-test', false)
  assert.equal(m.list().extensions[0].status, 'disabled')
  assert.equal(m.uiRoot('hello-test'), undefined)
  await assert.rejects(m.invoke('hello-test', 'ping'), /turned off/)

  await m.setEnabled('hello-test', true)
  await m.invoke('hello-test', 'writeData')
  await m.uninstall('hello-test', { deleteData: false })
  assert.equal(m.list().extensions.length, 0)
  assert.ok(fs.existsSync(path.join(userData, 'extension-data', 'hello-test', 'note.txt')), 'data kept unless asked')
  await host.stopAll()
})

test('a development folder whose permissions change needs approval again', async () => {
  const src = writeExtension(tmp('dev'))
  const { m, host } = newManager()
  await m.confirm((await m.inspect({ kind: 'dev', path: src })).token)
  assert.equal(m.list().extensions[0].extensionDir, path.resolve(src))

  const changed = baseManifest({ backend: { main: 'backend/index.cjs' }, permissions: { network: ['example.com'] } })
  fs.writeFileSync(path.join(src, 'monorail.json'), JSON.stringify(changed))
  await m.reload('hello-test')
  const [ext] = m.list().extensions
  assert.equal(ext.status, 'needs-approval')
  assert.deepEqual(ext.newPermissions.map((p) => p.key), ['net:example.com'])
  await assert.rejects(m.invoke('hello-test', 'ping'), /approve/)

  await m.approve('hello-test')
  assert.equal(m.list().extensions[0].status, 'active')
  await host.stopAll()
})

// ----------------------------------------------------------------- sandbox --

test('backend runs sandboxed: own data yes, other files, own code, env, processes, network no', async (t) => {
  const src = writeExtension(tmp('sbx'))
  const secret = path.join(tmp('secret'), 'token.txt')
  fs.writeFileSync(secret, 'secret')
  process.env.MONORAIL_TEST_SECRET = 'x'
  t.after(() => delete process.env.MONORAIL_TEST_SECRET)

  const server = http.createServer((_req, res) => res.end('ok'))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(() => server.close())
  const url = `http://127.0.0.1:${server.address().port}/`

  const { m, host, events } = newManager()
  await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)

  assert.deepEqual(await m.invoke('hello-test', 'ping', { n: 3 }), { pong: 3, version: '1.0.0' })
  assert.equal(await m.invoke('hello-test', 'writeData'), 'hi')
  await assert.rejects(m.invoke('hello-test', 'readOutside', secret), DENIED)
  await assert.rejects(m.invoke('hello-test', 'writeOwnCode'), DENIED)
  const env = await m.invoke('hello-test', 'env')
  assert.ok(!env.includes('MONORAIL_TEST_SECRET'), 'user environment is not inherited')
  await assert.rejects(m.invoke('hello-test', 'spawn'), DENIED)
  await assert.rejects(m.invoke('hello-test', 'fetchUrl', url), /no network permission/)
  await assert.rejects(m.invoke('hello-test', 'boom'), /nope/)
  await assert.rejects(m.invoke('hello-test', 'missing'), /Unknown method/)

  assert.equal(await m.invoke('hello-test', 'emit'), true)
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(events.at(-1), ['hello-test', 'tick', { n: 1 }])
  assert.ok(m.logs('hello-test').some((l) => l.line.includes('started 1.0.0')))
  await host.stopAll()
})

test('declared hosts and programs are allowed, others are not', async (t) => {
  const server = http.createServer((_req, res) => res.end('ok'))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(() => server.close())
  const port = server.address().port

  const src = writeExtension(
    tmp('perm'),
    baseManifest({ backend: { main: 'backend/index.cjs' }, permissions: { network: [`127.0.0.1:${port}`], process: [path.basename(process.execPath)] } }),
  )
  const { m, host } = newManager()
  await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)
  assert.equal(await m.invoke('hello-test', 'fetchUrl', `http://127.0.0.1:${port}/`), 200)
  await assert.rejects(m.invoke('hello-test', 'fetchUrl', `http://localhost:${port}/`), /no network permission/)
  assert.equal(await m.invoke('hello-test', 'spawn'), '')
  await host.stopAll()
})

test('a backend that fails to load reports why', async () => {
  const src = writeExtension(tmp('broken'))
  fs.writeFileSync(path.join(src, 'backend', 'index.cjs'), 'throw new Error("bad build")')
  const { m, host } = newManager()
  await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)
  await assert.rejects(m.invoke('hello-test', 'ping'), /bad build|failed to start/)
  await host.stopAll()
})

// ------------------------------------------------- API 1.1 contracts --

/** A reversible stand-in for safeStorage. */
function fakeCipher(available = true) {
  return {
    isAvailable: () => available,
    encrypt: (t) => Buffer.from(`enc:${t}`).reverse(),
    decrypt: (b) => Buffer.from(b).reverse().toString().slice(4),
  }
}

function managerWithSecrets(cipher = fakeCipher()) {
  const userData = tmp('userdata')
  const secretStore = new SecretStore({ root: path.join(userData, 'extension-secrets'), cipher })
  let m
  const host = new BackendHost({
    execPath: process.execPath,
    apiVersion: manifest.API_VERSION,
    secrets: (id) => secretStore.forExtension(id),
    onMigrated: (id, v) => m.recordDataVersion(id, v),
  })
  hosts.push(host)
  m = new ExtensionManager({ userData, host, secretStore })
  m.init()
  return { m, host, userData, secretStore }
}

test('a program in permissions.process matches with or without .exe', async () => {
  const name = path.basename(process.execPath).replace(/\.exe$/i, '')
  for (const listed of [name, `${name}.exe`, `${name.toUpperCase()}.EXE`]) {
    const src = writeExtension(tmp('prog'), baseManifest({ backend: { main: 'backend/index.cjs' }, permissions: { process: [listed] } }))
    const { m, host } = newManager()
    await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)
    assert.equal(await m.invoke('hello-test', 'spawn'), '', `listed as ${listed}`)
    await host.stopAll()
  }
})

test('errors reach the caller with a code, a message and details', async () => {
  const src = writeExtension(tmp('err'))
  const { m, host } = newManager()
  await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)
  await assert.rejects(m.invoke('hello-test', 'failCoded'), { code: 'NOT_SIGNED_IN', message: 'Sign in first', details: { retry: false } })
  await assert.rejects(m.invoke('hello-test', 'boom'), { code: 'E_NOPE' })
  await assert.rejects(m.invoke('hello-test', 'badCode'), { code: 'EXT_BACKEND_ERROR', message: 'odd' })
  await assert.rejects(m.invoke('hello-test', 'badResult'), { code: 'EXT_BAD_PAYLOAD' })
  await assert.rejects(m.invoke('hello-test', 'badEmit'), { code: 'EXT_BAD_PAYLOAD' })
  await assert.rejects(m.invoke('hello-test', 'missing'), { code: 'EXT_UNKNOWN_METHOD' })
  await assert.rejects(m.invoke('hello-test', 'readOutside', __filename), { code: 'EXT_FS_DENIED' })
  await assert.rejects(m.invoke('hello-test', 'spawn'), { code: 'EXT_PROCESS_DENIED' })
  await assert.rejects(m.invoke('hello-test', 'ping', { n: 1n }), { code: 'EXT_BAD_PAYLOAD' })
  assert.ok(m.logs('hello-test').some((l) => l.level === 'warn' && l.line.includes('failCoded failed: [NOT_SIGNED_IN]')))
  await m.setEnabled('hello-test', false)
  await assert.rejects(m.invoke('hello-test', 'ping'), { code: 'EXT_NOT_ACTIVE' })
  await host.stopAll()
  for (const code of ['EXT_NOT_ACTIVE', 'EXT_BAD_PAYLOAD', 'EXT_FS_DENIED']) assert.ok(ERROR_CODES[code])
})

test('ctx.secrets are encrypted outside the sandbox and removed with the data', async () => {
  const src = writeExtension(tmp('sec'))
  const { m, host, userData } = managerWithSecrets()
  await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)
  assert.deepEqual(await m.invoke('hello-test', 'setSecret', { name: 'token', value: 'abc123' }), ['token'])
  assert.equal(await m.invoke('hello-test', 'getSecret', { name: 'token' }), 'abc123')
  assert.equal(await m.invoke('hello-test', 'getSecret', { name: 'other' }), null)
  await assert.rejects(m.invoke('hello-test', 'setSecret', { name: '../x', value: 'v' }), { code: 'EXT_INVALID_SECRET' })

  const file = path.join(userData, 'extension-secrets', 'hello-test.json')
  assert.ok(!fs.readFileSync(file, 'utf8').includes('abc123'), 'stored encrypted')
  assert.ok(!file.startsWith(m.dataDir('hello-test')), 'outside the data folder the backend can read')

  // Kept across a Remove that keeps the data, deleted with it otherwise.
  await m.uninstall('hello-test')
  assert.ok(fs.existsSync(file))
  await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)
  assert.deepEqual(await m.invoke('hello-test', 'deleteSecret', { name: 'token' }), [])
  await m.uninstall('hello-test', { deleteData: true })
  assert.ok(!fs.existsSync(file))
  await host.stopAll()
})

test('ctx.secrets refuse to save without encryption', async () => {
  const src = writeExtension(tmp('nosec'))
  const { m, host } = managerWithSecrets(fakeCipher(false))
  await m.confirm((await m.inspect({ kind: 'folder', path: src })).token)
  await assert.rejects(m.invoke('hello-test', 'setSecret', { name: 'token', value: 'x' }), { code: 'EXT_SECRETS_UNAVAILABLE' })
  await host.stopAll()
})

test('migrate(ctx, fromVersion) runs once per version change, before start', async () => {
  const dir = tmp('mig')
  writeExtension(dir)
  const { m, host } = managerWithSecrets()
  await m.confirm((await m.inspect({ kind: 'dev', path: dir })).token)
  assert.deepEqual(await m.invoke('hello-test', 'migrations'), [null])
  await m.reload('hello-test')
  assert.deepEqual(await m.invoke('hello-test', 'migrations'), [], 'same version: no migrate on restart')

  fs.writeFileSync(path.join(dir, 'monorail.json'), JSON.stringify(baseManifest({ version: '1.1.0', backend: { main: 'backend/index.cjs' } })))
  await m.reload('hello-test')
  assert.deepEqual(await m.invoke('hello-test', 'migrations'), ['1.0.0'])
  assert.equal(m.state.dataVersions['hello-test'], '1.1.0')
  await host.stopAll()
})

test('a migrate that throws stops the start and runs again next time', async () => {
  const dir = tmp('migfail')
  writeExtension(dir)
  const { m, host } = managerWithSecrets()
  await m.confirm((await m.inspect({ kind: 'dev', path: dir })).token)
  m.recordDataVersion('hello-test', 'explode')
  await m.reload('hello-test')
  await assert.rejects(m.invoke('hello-test', 'ping'), { code: 'EXT_START_FAILED' })
  assert.equal(m.state.dataVersions['hello-test'], 'explode')
  await host.stopAll()
})
