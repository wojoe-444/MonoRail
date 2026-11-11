// Runs one extension backend inside its own child process.
//
// host.cjs starts this file with Node's permission model switched on
// (--permission plus --allow-fs-read/--allow-fs-write for the extension's own
// folders only, and --allow-child-process only when the extension declared the
// "process" permission). Node's permission model does not cover the network,
// so this file installs a network guard before any extension code loads.
//
// This file must stay self-contained (no requires of other MonoRail files):
// in the packaged app it is unpacked from the asar and is the only MonoRail
// file the sandboxed process may read.
//
// Protocol with the host (process IPC, JSON):
//   host -> child  { type: 'init', extension, main, dataDir, extensionDir, folders, permissions, previousVersion }
//   child -> host  { type: 'migrated', version }       (after migrate() succeeded, before start())
//   child -> host  { type: 'ready', methods, hooks } | { type: 'fatal', error }
//   host -> child  { type: 'invoke', id, method, args }
//   child -> host  { type: 'result', id, ok, value | error }   error = { code, message, details? }
//   child -> host  { type: 'emit', channel, payload }  (pushed to the extension's open pages)
//   child -> host  { type: 'host', id, op, args }      (op = 'secrets.get' | ... | 'settings.get')
//   host -> child  { type: 'hostResult', id, ok, value | error }
//   host -> child  { type: 'settings', values }    (settings saved; calls settingsChanged)
//   host -> child  { type: 'stop' }
//
// Error codes the runtime itself produces start with EXT_ (see ERROR_CODES in
// errors.cjs, kept in step with the list in docs/extensions/backend-api.md).

'use strict'

const { pathToFileURL } = require('node:url')
const net = require('node:net')
const dns = require('node:dns')
const dgram = require('node:dgram')
const util = require('node:util')

function send(msg) {
  if (process.connected) process.send(msg)
}

const CODE_RE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const MAX_DETAILS = 64 * 1024
const MAX_PAYLOAD = 1024 * 1024

/**
 * The error contract: every failed call reaches the page as { code, message,
 * details? }. A backend's own `code` (a short identifier) and JSON `details`
 * pass through; anything else becomes EXT_BACKEND_ERROR. Node's permission
 * model denials become EXT_FS_DENIED (files) or keep their EXT_ code.
 */
function errorInfo(err) {
  let e = err
  let message
  // fetch() hides the real reason (e.g. a network permission denial) in err.cause.
  if (e instanceof Error && e.cause instanceof Error && e.message === 'fetch failed') {
    message = `fetch failed: ${e.cause.message}`
    e = e.cause
  }
  if (!(e instanceof Error)) return { code: 'EXT_BACKEND_ERROR', message: String(err) }
  let code = typeof e.code === 'string' && CODE_RE.test(e.code) ? e.code : 'EXT_BACKEND_ERROR'
  if (code === 'ERR_ACCESS_DENIED') code = e.permission === 'ChildProcess' ? 'EXT_PROCESS_DENIED' : 'EXT_FS_DENIED'
  const out = { code, message: message ?? e.message, stack: err instanceof Error ? err.stack : undefined }
  if (e.details !== undefined) {
    try {
      const json = JSON.stringify(e.details)
      if (json !== undefined && json.length <= MAX_DETAILS) out.details = JSON.parse(json)
    } catch {
      /* details that are not JSON are dropped */
    }
  }
  return out
}

function codedError(code, message, details) {
  const err = new Error(message)
  err.code = code
  if (details !== undefined) err.details = details
  return err
}

// ----------------------------------------------------------- network guard --

function hostAllowed(policy, host, port) {
  if (policy === true) return true
  if (!Array.isArray(policy) || !host) return false
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '')
  return policy.some((rule) => {
    const [pattern, rulePort] = rule.split(/:(?=\d+$)/)
    if (rulePort && String(port) !== rulePort) return false
    if (pattern.startsWith('*.')) return h.endsWith(pattern.slice(1)) && h.length > pattern.length - 1
    return h === pattern
  })
}

function denied(what) {
  const err = new Error(`This extension has no network permission for ${what}. Add it to "permissions.network" in monorail.json.`)
  err.code = 'EXT_NETWORK_DENIED'
  return err
}

/** Gate every outgoing connection: net, tls, http(s), fetch and WebSocket all go through Socket#connect. */
function installNetworkGuard(policy) {
  if (policy === true) return
  const original = net.Socket.prototype.connect
  function guardedConnect(...args) {
    // net.connect() passes its normalized [options, cb] array straight through.
    const first = Array.isArray(args[0]) ? args[0][0] : args[0]
    const second = Array.isArray(args[0]) ? args[0][1] : args[1]
    let host
    let port
    let pipe
    if (first && typeof first === 'object') {
      pipe = first.path
      host = first.host ?? 'localhost'
      port = first.port
    } else if (typeof first === 'number' || /^\d+$/.test(String(first))) {
      port = first
      host = typeof second === 'string' ? second : 'localhost'
    } else if (typeof first === 'string') {
      pipe = first
    }
    if (pipe !== undefined || !hostAllowed(policy, host, port)) {
      const err = denied(pipe !== undefined ? `the local socket ${pipe}` : `${host}:${port}`)
      process.nextTick(() => this.destroy(err))
      return this
    }
    return original.apply(this, args)
  }
  Object.defineProperty(net.Socket.prototype, 'connect', { value: guardedConnect, writable: false, configurable: false })

  // UDP has no host rules here: only "network": true allows it.
  const noUdp = () => {
    throw denied('UDP sockets')
  }
  Object.defineProperty(dgram, 'createSocket', { value: noUdp, writable: false, configurable: false })

  // Direct DNS queries can leak data too; allow them only for permitted hosts.
  const wrap = (obj, name) => {
    const fn = obj[name]
    if (typeof fn !== 'function' || name === 'Resolver' || /^[A-Z]/.test(name)) return
    Object.defineProperty(obj, name, {
      value: function guardedDns(hostname, ...rest) {
        if (typeof hostname === 'string' && hostAllowed(policy, hostname, undefined)) return fn.call(this, hostname, ...rest)
        if (typeof hostname === 'string' && Array.isArray(policy) && policy.some((r) => r.split(/:(?=\d+$)/)[0] === hostname.toLowerCase()))
          return fn.call(this, hostname, ...rest)
        const err = denied(`DNS lookups of ${hostname}`)
        const cb = rest.find((r) => typeof r === 'function')
        if (cb) return process.nextTick(cb, err)
        if (obj === dns.promises || obj === dns.promises.Resolver?.prototype) return Promise.reject(err)
        throw err
      },
      writable: false,
      configurable: false,
    })
  }
  for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype])
    for (const name of Object.getOwnPropertyNames(target)) {
      if (['lookup', 'lookupService', 'reverse'].includes(name) || name.startsWith('resolve')) wrap(target, name)
    }
}

// ----------------------------------------------------------- process guard --

/**
 * A program name as the process guard compares it: the file name only (no
 * folder), lower case, without a Windows launcher extension. Applied to both
 * the allowlist entry and the program being started, so "node", "node.exe"
 * and "C:\\Program Files\\nodejs\\node.exe" are the same program.
 */
function programName(file) {
  return String(file ?? '').split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|com)$/, '')
}

/** With a list of programs, only those may be started (see programName). */
function installProcessGuard(policy) {
  if (policy !== true && !Array.isArray(policy)) return // no permission: Node's permission model blocks it
  if (policy === true) return
  const cp = require('node:child_process')
  const allowed = new Set(policy.map(programName))
  const check = (file) => {
    if (!allowed.has(programName(file))) {
      const err = new Error(`This extension may not run "${file}". Add it to "permissions.process" in monorail.json.`)
      err.code = 'EXT_PROCESS_DENIED'
      throw err
    }
  }
  const origSpawn = cp.ChildProcess.prototype.spawn
  Object.defineProperty(cp.ChildProcess.prototype, 'spawn', {
    value: function guardedSpawn(options) {
      check(options?.file)
      return origSpawn.call(this, options)
    },
    writable: false,
    configurable: false,
  })
  for (const name of ['spawnSync', 'execFileSync']) {
    const fn = cp[name]
    Object.defineProperty(cp, name, {
      value: function guarded(file, ...rest) {
        check(file)
        return fn.call(this, file, ...rest)
      },
      writable: false,
      configurable: false,
    })
  }
  const origExecSync = cp.execSync
  Object.defineProperty(cp, 'execSync', {
    value: function guardedExecSync(command, ...rest) {
      check(String(command).trim().split(/\s+/)[0])
      return origExecSync.call(this, command, ...rest)
    },
    writable: false,
    configurable: false,
  })
}

// --------------------------------------------------------------- lifecycle --

let backend
let ctx
const hostCalls = new Map()
let hostSeq = 0

/** Ask MonoRail's main process for something only it can do (secrets: safeStorage). */
function hostCall(op, args) {
  const id = ++hostSeq
  return new Promise((resolve, reject) => {
    hostCalls.set(id, { resolve, reject })
    send({ type: 'host', id, op, args })
  })
}

function onHostResult(msg) {
  const p = hostCalls.get(msg.id)
  if (!p) return
  hostCalls.delete(msg.id)
  if (msg.ok) p.resolve(msg.value)
  else p.reject(codedError(msg.error?.code ?? 'EXT_HOST_ERROR', msg.error?.message ?? 'MonoRail could not do that'))
}

/** Is this value plain JSON that survives the trip to a page unchanged? Returns its size. */
function jsonSize(value, what) {
  let json
  try {
    json = JSON.stringify(value)
  } catch (err) {
    throw codedError('EXT_BAD_PAYLOAD', `${what} must be plain JSON: ${err.message}`)
  }
  return json === undefined ? 0 : json.length
}

function makeCtx(init) {
  const prefix = `[${init.extension.id}]`
  const log = (level) => (...a) => {
    const line = util.format(...a)
    send({ type: 'log', level, line })
    ;(level === 'error' ? console.error : console.log)(prefix, line)
  }
  return Object.freeze({
    apiVersion: init.apiVersion,
    extension: Object.freeze({ ...init.extension }),
    dataDir: init.dataDir,
    extensionDir: init.extensionDir,
    /** Folders the user granted through monorail.pickFolder(), as { path, write }. */
    folders: Object.freeze(init.folders.map((f) => Object.freeze({ ...f }))),
    permissions: init.permissions,
    log: log('info'),
    warn: log('warn'),
    error: log('error'),
    /**
     * Push an event to every open page of this extension (monorail.on(channel, cb)).
     * Fire and forget: events are not queued, so with no page open they are
     * dropped. Pages load current state with invoke() when they open.
     */
    emit(channel, payload) {
      if (typeof channel !== 'string' || !channel || channel.length > 100)
        throw codedError('EXT_BAD_PAYLOAD', 'emit(channel, payload) needs a channel name (1-100 characters)')
      if (channel.startsWith('monorail.')) throw codedError('EXT_BAD_PAYLOAD', 'Channels starting with "monorail." are reserved for MonoRail')
      if (jsonSize(payload, 'An event payload') > MAX_PAYLOAD) throw codedError('EXT_BAD_PAYLOAD', 'An event payload must be under 1 MB')
      send({ type: 'emit', channel, payload: payload === undefined ? null : payload })
    },
    /** Throw an error with a code (and JSON details) that the page receives as error.code / error.details. */
    fail(code, message, details) {
      throw codedError(typeof code === 'string' && CODE_RE.test(code) ? code : 'EXT_BACKEND_ERROR', String(message ?? code), details)
    },
    /**
     * Secrets (tokens, passwords) encrypted by MonoRail with the operating
     * system's key store (safeStorage) and kept outside the extension's
     * folders, so they are never in a file the backend or a backup can read
     * as plain text. Rejects with EXT_SECRETS_UNAVAILABLE when the system
     * offers no encryption.
     */
    secrets: Object.freeze({
      get: (name) => hostCall('secrets.get', { name }),
      set: (name, value) => hostCall('secrets.set', { name, value }),
      delete: (name) => hostCall('secrets.delete', { name }),
      list: () => hostCall('secrets.list', {}),
    }),
    /** Values of the settings declared in monorail.json (secrets decrypted; defaults filled in). */
    settings: Object.freeze({
      get: () => hostCall('settings.get', {}),
    }),
  })
}

async function init(msg) {
  installNetworkGuard(msg.permissions.network)
  installProcessGuard(msg.permissions.process)
  process.chdir(msg.dataDir)
  ctx = makeCtx(msg)
  const mod = await import(pathToFileURL(msg.main).href)
  backend = mod.default && typeof mod.default === 'object' && mod.default.methods ? mod.default : mod
  if (!backend || typeof backend.methods !== 'object' || backend.methods === null)
    throw new Error('The backend must export { methods: { name: async (ctx, args) => result } }')
  // migrate(ctx, fromVersion) runs before start() whenever the version that
  // last used ctx.dataDir differs from this one (fromVersion null: no record).
  const from = msg.previousVersion ?? null
  if (from !== ctx.extension.version) {
    if (typeof backend.migrate === 'function') await backend.migrate(ctx, from)
    send({ type: 'migrated', version: ctx.extension.version })
  }
  if (typeof backend.start === 'function') await backend.start(ctx)
  send({
    type: 'ready',
    methods: Object.keys(backend.methods).filter((k) => typeof backend.methods[k] === 'function'),
    hooks: { settingsChanged: typeof backend.settingsChanged === 'function' },
  })
}

async function invoke(msg) {
  try {
    const fn = Object.hasOwn(backend.methods, msg.method) ? backend.methods[msg.method] : undefined
    if (typeof fn !== 'function') throw codedError('EXT_UNKNOWN_METHOD', `Unknown method ${ctx.extension.id}.${msg.method}`)
    const value = await fn(ctx, msg.args)
    if (jsonSize(value, `The result of ${msg.method}`) > 16 * MAX_PAYLOAD)
      throw codedError('EXT_BAD_PAYLOAD', `The result of ${msg.method} must be under 16 MB`)
    send({ type: 'result', id: msg.id, ok: true, value: value === undefined ? null : value })
  } catch (err) {
    const error = errorInfo(err)
    send({ type: 'log', level: 'warn', line: `${msg.method} failed: [${error.code}] ${error.message}` })
    send({ type: 'result', id: msg.id, ok: false, error })
  }
}

async function stop() {
  try {
    if (backend && typeof backend.stop === 'function') await backend.stop(ctx)
  } finally {
    process.exit(0)
  }
}

process.on('message', (msg) => {
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'init') init(msg).catch((err) => {
    send({ type: 'fatal', error: errorInfo(err) })
    setTimeout(() => process.exit(1), 50)
  })
  else if (msg.type === 'invoke') void invoke(msg)
  else if (msg.type === 'hostResult') onHostResult(msg)
  else if (msg.type === 'settings' && backend && typeof backend.settingsChanged === 'function')
    Promise.resolve()
      .then(() => backend.settingsChanged(ctx, msg.values))
      .catch((err) => send({ type: 'log', level: 'error', line: `settingsChanged failed: ${err?.stack ?? err}` }))
  else if (msg.type === 'stop') void stop()
})

// The host going away (MonoRail quit or crashed) ends the backend too.
process.on('disconnect', () => process.exit(0))
process.on('uncaughtException', (err) => {
  send({ type: 'log', level: 'error', line: `Uncaught: ${err?.stack ?? err}` })
})
process.on('unhandledRejection', (err) => {
  send({ type: 'log', level: 'error', line: `Unhandled rejection: ${err?.stack ?? err}` })
})
