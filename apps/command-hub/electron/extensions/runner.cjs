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
//   host -> child  { type: 'init', extension, main, dataDir, extensionDir, folders, permissions }
//   child -> host  { type: 'ready', methods } | { type: 'fatal', error }
//   host -> child  { type: 'invoke', id, method, args }
//   child -> host  { type: 'result', id, ok, value | error }
//   child -> host  { type: 'emit', channel, payload }  (pushed to the extension's UI)
//   host -> child  { type: 'stop' }

'use strict'

const { pathToFileURL } = require('node:url')
const net = require('node:net')
const dns = require('node:dns')
const dgram = require('node:dgram')
const util = require('node:util')

function send(msg) {
  if (process.connected) process.send(msg)
}

function errorInfo(err) {
  // fetch() hides the real reason (e.g. a network permission denial) in err.cause.
  if (err instanceof Error && err.cause instanceof Error && err.message === 'fetch failed')
    return { message: `fetch failed: ${err.cause.message}`, code: err.cause.code, stack: err.stack }
  if (err instanceof Error) return { message: err.message, code: err.code, stack: err.stack }
  return { message: String(err) }
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

/** With a list of programs, only those may be started (checked by file name, without .exe/.cmd). */
function installProcessGuard(policy) {
  if (policy !== true && !Array.isArray(policy)) return // no permission: Node's permission model blocks it
  if (policy === true) return
  const cp = require('node:child_process')
  const allowed = new Set(policy.map((p) => p.toLowerCase()))
  const check = (file) => {
    const base = String(file ?? '').split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|com)$/, '')
    if (!allowed.has(base)) {
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
    /** Push an event to the extension's open pages (monorail.on(channel, cb) in the UI). */
    emit(channel, payload) {
      if (typeof channel !== 'string' || !channel) throw new Error('emit(channel, payload) needs a channel name')
      send({ type: 'emit', channel, payload })
    },
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
  if (typeof backend.start === 'function') await backend.start(ctx)
  send({ type: 'ready', methods: Object.keys(backend.methods).filter((k) => typeof backend.methods[k] === 'function') })
}

async function invoke(msg) {
  try {
    const fn = Object.hasOwn(backend.methods, msg.method) ? backend.methods[msg.method] : undefined
    if (typeof fn !== 'function') throw new Error(`Unknown method ${ctx.extension.id}.${msg.method}`)
    const value = await fn(ctx, msg.args)
    send({ type: 'result', id: msg.id, ok: true, value: value === undefined ? null : value })
  } catch (err) {
    send({ type: 'result', id: msg.id, ok: false, error: errorInfo(err) })
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
