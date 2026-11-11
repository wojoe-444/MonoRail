// MonoRail extension SDK: test a backend without MonoRail.
//
//   import { test } from 'node:test'
//   import assert from 'node:assert/strict'
//   import { loadBackend } from '../monorail-sdk/testing.mjs'
//
//   test('adds a note', async (t) => {
//     const b = await loadBackend()             // reads ./monorail.json, runs migrate() and start()
//     t.after(() => b.close())                  // runs stop() and deletes the temporary data folder
//     await b.invoke('addNote', { text: 'hi' })
//     assert.equal(b.events.at(-1).channel, 'notes')
//     await assert.rejects(b.invoke('addNote', {}), { code: 'EXT_BACKEND_ERROR' })
//   })
//
// Run with `node --test`. The backend gets a ctx shaped like the real one, a
// temporary data folder, in-memory secrets, and the same rules for JSON
// arguments, results, events and error codes as in MonoRail. It is NOT
// sandboxed: permissions are not enforced here, so check file, network and
// program access by loading the extension in MonoRail ("Load a folder for
// development").
//
// No dependencies: Node 22+ only.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import util from 'node:util'

import { SDK_VERSION } from './client.js'

const CODE_RE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const SECRET_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/
const MAX_PAYLOAD = 1024 * 1024

/** The error a page would receive: { code, message, details? }. */
export class MonoRailTestError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'MonoRailError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}

function coded(code, message, details) {
  const err = new Error(message)
  err.code = code
  if (details !== undefined) err.details = details
  return err
}

/** Same mapping as MonoRail's runner: a usable code passes, anything else is EXT_BACKEND_ERROR. */
function toPageError(err) {
  let e = err
  let message
  if (e instanceof Error && e.cause instanceof Error && e.message === 'fetch failed') {
    message = `fetch failed: ${e.cause.message}`
    e = e.cause
  }
  if (!(e instanceof Error)) return new MonoRailTestError('EXT_BACKEND_ERROR', String(err))
  let code = typeof e.code === 'string' && CODE_RE.test(e.code) ? e.code : 'EXT_BACKEND_ERROR'
  if (code === 'ERR_ACCESS_DENIED') code = 'EXT_FS_DENIED'
  let details
  if (e.details !== undefined) {
    try {
      const json = JSON.stringify(e.details)
      if (json !== undefined && json.length <= 64 * 1024) details = JSON.parse(json)
    } catch {
      /* dropped, as in MonoRail */
    }
  }
  const out = new MonoRailTestError(code, message ?? e.message, details)
  out.cause = err
  return out
}

/** JSON round trip: what survives the trip between page, MonoRail and backend. */
function roundTrip(value, what) {
  let json
  try {
    json = JSON.stringify(value)
  } catch (err) {
    throw coded('EXT_BAD_PAYLOAD', `${what} must be plain JSON: ${err.message}`)
  }
  return { value: json === undefined ? null : JSON.parse(json), size: json?.length ?? 0 }
}

function normalizePermissions(p = {}) {
  const list = (v) => (v === true ? true : Array.isArray(v) && v.length ? [...v] : false)
  const fsp = p.filesystem ?? {}
  return {
    network: list(p.network),
    process: list(p.process),
    filesystem: { read: [...(fsp.read ?? [])], write: [...(fsp.write ?? [])], pickFolders: fsp.pickFolders === true },
  }
}

/**
 * A ctx like the one MonoRail gives a backend, for unit tests of single
 * methods. Everything it records is on the returned `record`.
 *
 * @param {object} [opts]
 * @param {{ id?: string, name?: string, version?: string, permissions?: object }} [opts.manifest]
 * @param {string} [opts.dataDir] defaults to a new temporary folder
 * @param {string} [opts.extensionDir] defaults to the current folder
 * @param {{ path: string, write: boolean }[]} [opts.folders] folders "the user picked"
 * @param {Record<string, string>} [opts.secrets] secrets stored beforehand
 * @param {boolean} [opts.secretsAvailable] false simulates a computer without encryption
 * @param {Record<string, unknown>} [opts.settings] values "the user entered" (defaults come from manifest.settings)
 */
export function createTestContext(opts = {}) {
  const m = opts.manifest ?? {}
  const dataDir = opts.dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), `monorail-test-${m.id ?? 'ext'}-`))
  fs.mkdirSync(dataDir, { recursive: true })
  const record = {
    /** @type {{ channel: string, payload: unknown }[]} */ events: [],
    /** @type {{ level: 'info' | 'warn' | 'error', line: string }[]} */ logs: [],
    /** @type {Map<string, string>} */ secrets: new Map(Object.entries(opts.secrets ?? {})),
    dataDir,
    ownsDataDir: !opts.dataDir,
    /** @type {Record<string, unknown>} */ settings: { ...(opts.settings ?? {}) },
  }
  const settingsValues = () =>
    Object.fromEntries(
      (m.settings ?? []).map((f) => [
        f.key,
        Object.hasOwn(record.settings, f.key) ? record.settings[f.key] : (f.default ?? (f.type === 'boolean' ? false : null)),
      ]),
    )
  record.settingsValues = settingsValues
  const secretsAvailable = opts.secretsAvailable !== false
  const checkName = (name) => {
    if (typeof name !== 'string' || !SECRET_NAME_RE.test(name))
      throw coded('EXT_INVALID_SECRET', 'A secret name is 1-100 characters of A-Z, a-z, 0-9, ".", "_" and "-"')
  }
  const log = (level) => (...a) => record.logs.push({ level, line: util.format(...a) })
  const ctx = Object.freeze({
    apiVersion: SDK_VERSION,
    runningIn: opts.runningIn === 'mcp' ? 'mcp' : 'app',
    extension: Object.freeze({ id: m.id ?? 'test-extension', name: m.name ?? 'Test extension', version: m.version ?? '0.0.0' }),
    dataDir,
    extensionDir: opts.extensionDir ?? process.cwd(),
    folders: Object.freeze((opts.folders ?? []).map((f) => Object.freeze({ path: f.path, write: !!f.write }))),
    permissions: normalizePermissions(m.permissions),
    log: log('info'),
    warn: log('warn'),
    error: log('error'),
    emit(channel, payload) {
      if (typeof channel !== 'string' || !channel || channel.length > 100)
        throw coded('EXT_BAD_PAYLOAD', 'emit(channel, payload) needs a channel name (1-100 characters)')
      if (channel.startsWith('monorail.')) throw coded('EXT_BAD_PAYLOAD', 'Channels starting with "monorail." are reserved for MonoRail')
      const { value, size } = roundTrip(payload, 'An event payload')
      if (size > MAX_PAYLOAD) throw coded('EXT_BAD_PAYLOAD', 'An event payload must be under 1 MB')
      record.events.push({ channel, payload: value })
    },
    fail(code, message, details) {
      throw coded(typeof code === 'string' && CODE_RE.test(code) ? code : 'EXT_BACKEND_ERROR', String(message ?? code), details)
    },
    secrets: Object.freeze({
      async get(name) {
        checkName(name)
        if (!record.secrets.has(name)) return null
        if (!secretsAvailable) throw coded('EXT_SECRETS_UNAVAILABLE', 'No encryption available (simulated)')
        return record.secrets.get(name)
      },
      async set(name, value) {
        checkName(name)
        if (typeof value !== 'string' || value.length > 64 * 1024) throw coded('EXT_INVALID_SECRET', 'A secret value is a string of at most 64 KB')
        if (!secretsAvailable) throw coded('EXT_SECRETS_UNAVAILABLE', 'No encryption available (simulated)')
        record.secrets.set(name, value)
      },
      async delete(name) {
        checkName(name)
        record.secrets.delete(name)
      },
      async list() {
        return [...record.secrets.keys()].sort()
      },
    }),
    settings: Object.freeze({
      async get() {
        return roundTrip(settingsValues(), 'Settings').value
      },
    }),
  })
  return { ctx, record }
}

/**
 * Load a backend the way MonoRail does: import backend.main, run
 * migrate(ctx, previousVersion) when the version differs, then start(ctx).
 *
 * @param {object} [opts] everything createTestContext takes, plus:
 * @param {string} [opts.root] the extension folder (with monorail.json); defaults to the current folder
 * @param {string} [opts.main] the backend file, if not backend.main from monorail.json
 * @param {string | null} [opts.previousVersion] the version that "last used" the data folder (default: null)
 */
export async function loadBackend(opts = {}) {
  const root = path.resolve(opts.root ?? process.cwd())
  let manifest = opts.manifest
  if (!manifest) {
    const file = path.join(root, 'monorail.json')
    if (fs.existsSync(file)) manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  const main = opts.main ?? manifest?.backend?.main
  if (!main) throw new Error('No backend: pass { main } or run from a folder whose monorail.json has backend.main')

  const { ctx, record } = createTestContext({ ...opts, manifest, extensionDir: root })
  const mod = await import(pathToFileURL(path.resolve(root, main)).href)
  const backend = mod.default && typeof mod.default === 'object' && mod.default.methods ? mod.default : mod
  if (!backend || typeof backend.methods !== 'object' || backend.methods === null)
    throw new Error('The backend must export { methods: { name: async (ctx, args) => result } }')

  const from = opts.previousVersion ?? null
  try {
    if (from !== ctx.extension.version && typeof backend.migrate === 'function') await backend.migrate(ctx, from)
    if (typeof backend.start === 'function') await backend.start(ctx)
  } catch (err) {
    throw new MonoRailTestError('EXT_START_FAILED', `failed to start: ${err?.message ?? err}`, undefined)
  }

  let closed = false
  return {
    ctx,
    backend,
    /** Events the backend emitted, oldest first: { channel, payload }. */
    events: record.events,
    /** Lines it logged: { level, line }. */
    logs: record.logs,
    /** Secrets it stored (in memory). */
    secrets: record.secrets,
    dataDir: record.dataDir,

    /** Call a method as a page would: JSON in, JSON out, errors as { code, message, details }. */
    async invoke(method, args) {
      if (closed) throw new MonoRailTestError('EXT_CRASHED', 'The backend was closed')
      try {
        const input = roundTrip(args, 'Arguments').value
        const fn = Object.hasOwn(backend.methods, method) ? backend.methods[method] : undefined
        if (typeof fn !== 'function') throw coded('EXT_UNKNOWN_METHOD', `Unknown method ${ctx.extension.id}.${method}`)
        const { value, size } = roundTrip(await fn(ctx, input), `The result of ${method}`)
        if (size > 16 * MAX_PAYLOAD) throw coded('EXT_BAD_PAYLOAD', `The result of ${method} must be under 16 MB`)
        return value
      } catch (err) {
        throw err instanceof MonoRailTestError ? err : toPageError(err)
      }
    },

    /**
     * Simulate the user saving settings: calls settingsChanged(ctx, values)
     * if the backend has it, else stop() and start() as MonoRail's restart does.
     */
    async changeSettings(values) {
      Object.assign(record.settings, values)
      const all = record.settingsValues()
      if (typeof backend.settingsChanged === 'function') await backend.settingsChanged(ctx, all)
      else {
        if (typeof backend.stop === 'function') await backend.stop(ctx)
        if (typeof backend.start === 'function') await backend.start(ctx)
      }
    },

    /** Run stop() and delete the temporary data folder (unless you passed your own dataDir). */
    async close({ keepData = false } = {}) {
      if (closed) return
      closed = true
      try {
        if (typeof backend.stop === 'function') await backend.stop(ctx)
      } finally {
        if (record.ownsDataDir && !keepData) fs.rmSync(record.dataDir, { recursive: true, force: true })
      }
    },
  }
}
