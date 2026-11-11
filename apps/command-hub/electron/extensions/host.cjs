// Starts, talks to and stops extension backends.
//
// Each enabled extension with a backend gets its own child process running
// runner.cjs under Node's permission model. The child sees only:
//   - read:  runner.cjs, the extension's folder, its data folder, granted folders
//   - write: its data folder and folders granted with write access
//   - child processes only with the "process" permission
//   - network only as its manifest allows (enforced in runner.cjs)
//   - a minimal environment (no inherited tokens or secrets from the user's env)
// The child is MonoRail's own executable in ELECTRON_RUN_AS_NODE mode, so no
// separate Node install is needed. Tests run it with plain Node.

const { fork } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { ExtensionCallError } = require('./errors.cjs')

const RUNNER = path.join(__dirname, 'runner.cjs').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
const CALL_TIMEOUT_MS = 2 * 60 * 1000
const START_TIMEOUT_MS = 20 * 1000
const LOG_LINES = 300
const MAX_CRASHES = 3
const CRASH_WINDOW_MS = 60 * 1000

/** Expand "~/x" from a manifest to an absolute path in the user's home folder. */
function expandHome(p, home = os.homedir()) {
  return p === '~' ? home : path.join(home, p.slice(2))
}

/** Node flags that confine the child to what the extension was granted. */
function sandboxFlags({ extensionDir, dataDir, folders = [], permissions, home }) {
  const read = new Set([RUNNER, extensionDir, dataDir])
  const write = new Set([dataDir])
  for (const p of permissions.filesystem.read) read.add(expandHome(p, home))
  for (const p of permissions.filesystem.write) {
    read.add(expandHome(p, home))
    write.add(expandHome(p, home))
  }
  for (const f of folders) {
    read.add(f.path)
    if (f.write) write.add(f.path)
  }
  const flags = ['--permission']
  for (const p of read) flags.push(`--allow-fs-read=${p}`)
  for (const p of write) flags.push(`--allow-fs-write=${p}`)
  if (permissions.process) flags.push('--allow-child-process')
  return flags
}

/** Only what programs need to run; nothing that could carry a secret. */
function sandboxEnv(dataDir) {
  const keep = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'windir', 'COMSPEC', 'ComSpec', 'LANG', 'LC_ALL', 'TZ', 'HOME', 'USERPROFILE', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']
  const env = { ELECTRON_RUN_AS_NODE: '1' }
  for (const k of keep) if (process.env[k] !== undefined) env[k] = process.env[k]
  const tmp = path.join(dataDir, 'tmp')
  fs.mkdirSync(tmp, { recursive: true })
  env.TMP = env.TEMP = env.TMPDIR = tmp
  return env
}

class BackendHost {
  /**
   * @param {object} opts
   * @param {string} [opts.execPath] executable used to run the child (MonoRail itself, or node in tests)
   * @param {(id: string, channel: string, payload: unknown) => void} [opts.onEmit]
   * @param {(id: string) => void} [opts.onStatus] called when a backend's status changes
   * @param {(id: string, version: string) => void} [opts.onMigrated] the backend's data folder is now at this version
   * @param {(id: string) => import('./secrets.cjs').ExtensionSecrets} [opts.secrets] secret storage for one extension
   * @param {(id: string) => Promise<object>} [opts.settings] an extension's settings values, for ctx.settings.get()
   * @param {'app'|'mcp'} [opts.runningIn] ctx.runningIn: 'mcp' in the MCP server's process (electron/mcp)
   */
  constructor({ execPath = process.execPath, onEmit = () => {}, onStatus = () => {}, onMigrated = () => {}, secrets, settings, apiVersion, runningIn = 'app' } = {}) {
    this.runningIn = runningIn
    this.settings = settings
    this.execPath = execPath
    this.onEmit = onEmit
    this.onStatus = onStatus
    this.onMigrated = onMigrated
    this.secrets = secrets
    this.apiVersion = apiVersion
    /** @type {Map<string, any>} */
    this.procs = new Map()
    this.logs = new Map()
    this.crashes = new Map()
  }

  status(id) {
    const p = this.procs.get(id)
    if (p) return { state: p.ready ? 'running' : 'starting', pid: p.child.pid }
    const c = this.crashes.get(id)
    if (c?.blocked) return { state: 'crashed', error: c.lastError }
    if (c?.lastError) return { state: 'stopped', error: c.lastError }
    return { state: 'stopped' }
  }

  getLogs(id) {
    return [...(this.logs.get(id) ?? [])]
  }

  log(id, level, line) {
    let list = this.logs.get(id)
    if (!list) this.logs.set(id, (list = []))
    for (const l of String(line).split(/\r?\n/)) if (l) list.push({ at: new Date().toISOString(), level, line: l.slice(0, 2000) })
    if (list.length > LOG_LINES) list.splice(0, list.length - LOG_LINES)
  }

  /**
   * Start a backend if it isn't running. `spec` = { manifest, extensionDir,
   * dataDir, folders } from the extension store.
   */
  ensure(spec) {
    const id = spec.manifest.id
    const existing = this.procs.get(id)
    if (existing) return existing.ready
    const c = this.crashes.get(id)
    if (c?.blocked)
      return Promise.reject(new ExtensionCallError('EXT_CRASHED', `${spec.manifest.name} stopped after crashing ${MAX_CRASHES} times. Reload it from the Extensions page. Last error: ${c.lastError}`))

    const { manifest, extensionDir, dataDir, folders = [] } = spec
    fs.mkdirSync(dataDir, { recursive: true })
    const execArgv = sandboxFlags({ extensionDir, dataDir, folders, permissions: manifest.permissions })
    const child = fork(RUNNER, [], {
      execPath: this.execPath,
      execArgv,
      env: sandboxEnv(dataDir),
      cwd: dataDir,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      serialization: 'json',
      windowsHide: true,
    })
    const proc = { child, pending: new Map(), seq: 0, methods: [] }
    child.stdout.on('data', (d) => this.log(id, 'info', d))
    child.stderr.on('data', (d) => this.log(id, 'error', d))

    proc.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ExtensionCallError('EXT_START_FAILED', `${manifest.name} did not start within ${START_TIMEOUT_MS / 1000}s`))
        child.kill()
      }, START_TIMEOUT_MS)
      proc.settleStart = (err, methods) => {
        clearTimeout(timer)
        proc.settleStart = undefined
        if (err) reject(err)
        else {
          proc.methods = methods
          resolve(true)
        }
      }
    })
    proc.ready.then(() => this.onStatus(id), () => {})
    proc.ready.catch(() => {}) // callers attach their own handlers

    child.on('message', (msg) => this.handleMessage(id, proc, msg))
    child.on('error', (err) => {
      this.log(id, 'error', `Process error: ${err.message}`)
      proc.settleStart?.(new ExtensionCallError('EXT_START_FAILED', `${manifest.name}'s backend could not start: ${err.message}`))
    })
    child.on('exit', (code, signal) => {
      this.procs.delete(id)
      const reason = proc.fatal ?? (proc.stopping ? undefined : `exited (${signal ?? `code ${code}`})`)
      if (reason) this.recordCrash(id, reason)
      const err = new ExtensionCallError(proc.fatal ? 'EXT_START_FAILED' : 'EXT_CRASHED', `${manifest.name}'s backend ${reason ?? 'stopped'}`)
      proc.settleStart?.(err)
      for (const p of proc.pending.values()) p.reject(err)
      proc.pending.clear()
      this.onStatus(id)
    })

    this.procs.set(id, proc)
    child.send({
      type: 'init',
      apiVersion: this.apiVersion,
      runningIn: this.runningIn,
      extension: { id, name: manifest.name, version: manifest.version },
      main: path.join(extensionDir, manifest.backend.main),
      extensionDir,
      dataDir,
      folders,
      permissions: manifest.permissions,
      previousVersion: spec.dataVersion ?? null,
    })
    this.onStatus(id)
    return proc.ready
  }

  recordCrash(id, reason) {
    this.log(id, 'error', `Backend ${reason}`)
    const now = Date.now()
    const c = this.crashes.get(id) ?? { times: [] }
    c.times = [...c.times.filter((t) => now - t < CRASH_WINDOW_MS), now]
    c.lastError = reason
    c.blocked = c.times.length >= MAX_CRASHES
    this.crashes.set(id, c)
  }

  handleMessage(id, proc, msg) {
    if (!msg || typeof msg !== 'object') return
    switch (msg.type) {
      case 'ready':
        proc.hooks = msg.hooks && typeof msg.hooks === 'object' ? msg.hooks : {}
        proc.settleStart?.(null, Array.isArray(msg.methods) ? msg.methods : [])
        break
      case 'fatal':
        proc.fatal = `failed to start: ${msg.error?.message ?? 'unknown error'}`
        this.log(id, 'error', msg.error?.stack ?? msg.error?.message)
        proc.settleStart?.(new ExtensionCallError('EXT_START_FAILED', proc.fatal))
        break
      case 'result': {
        const p = proc.pending.get(msg.id)
        if (!p) return
        proc.pending.delete(msg.id)
        clearTimeout(p.timer)
        if (msg.ok) p.resolve(msg.value)
        else p.reject(new ExtensionCallError(msg.error?.code ?? 'EXT_BACKEND_ERROR', msg.error?.message ?? 'Extension call failed', msg.error?.details))
        break
      }
      case 'migrated':
        if (typeof msg.version === 'string') this.onMigrated(id, msg.version)
        break
      case 'host':
        void this.hostRequest(id, proc, msg)
        break
      case 'emit':
        if (typeof msg.channel === 'string') this.onEmit(id, msg.channel, msg.payload)
        break
      case 'log':
        this.log(id, msg.level === 'error' ? 'error' : msg.level === 'warn' ? 'warn' : 'info', msg.line)
        break
    }
  }

  /** A request from the backend for something only the main process can do (ctx.secrets). */
  async hostRequest(id, proc, msg) {
    let reply
    try {
      const args = msg.args ?? {}
      const store = this.secrets?.(id)
      if (typeof msg.op === 'string' && msg.op.startsWith('secrets.') && !store)
        throw new ExtensionCallError(
          'EXT_SECRETS_UNAVAILABLE',
          this.runningIn === 'mcp' ? 'Secrets are only available inside MonoRail, not when an agent calls a tool (ctx.runningIn is "mcp")' : 'Secret storage is not available in this MonoRail',
        )
      let value
      switch (msg.op) {
        case 'secrets.get':
          value = await store.get(args.name)
          break
        case 'secrets.set':
          await store.set(args.name, args.value)
          value = null
          break
        case 'secrets.delete':
          await store.delete(args.name)
          value = null
          break
        case 'secrets.list':
          value = await store.list()
          break
        case 'settings.get':
          value = this.settings ? await this.settings(id) : {}
          break
        default:
          throw new ExtensionCallError('EXT_HOST_ERROR', `Unknown host request ${String(msg.op)}`)
      }
      reply = { type: 'hostResult', id: msg.id, ok: true, value: value ?? null }
    } catch (err) {
      reply = { type: 'hostResult', id: msg.id, ok: false, error: { code: typeof err?.code === 'string' ? err.code : 'EXT_HOST_ERROR', message: err?.message ?? String(err) } }
    }
    try {
      if (proc.child.connected) proc.child.send(reply)
    } catch {
      /* the backend exited meanwhile */
    }
  }

  /**
   * Settings were saved. A running backend that exports settingsChanged gets
   * the new values and true is returned; otherwise false (the caller restarts
   * it, so the next start reads the new values).
   */
  async settingsChanged(id, values) {
    const proc = this.procs.get(id)
    if (!proc) return true // not running: it reads fresh values when it starts
    try {
      await proc.ready
    } catch {
      return true
    }
    if (!proc.hooks?.settingsChanged || !proc.child.connected) return false
    proc.child.send({ type: 'settings', values: await values() })
    return true
  }

  async invoke(spec, method, args) {
    if (typeof method !== 'string' || !method) throw new ExtensionCallError('EXT_UNKNOWN_METHOD', 'Method name required')
    try {
      // Arguments cross a process boundary as JSON: refuse what would not survive it.
      JSON.stringify(args)
    } catch (err) {
      throw new ExtensionCallError('EXT_BAD_PAYLOAD', `Arguments must be plain JSON: ${err.message}`)
    }
    await this.ensure(spec)
    const proc = this.procs.get(spec.manifest.id)
    if (!proc) throw new ExtensionCallError('EXT_CRASHED', `${spec.manifest.name}'s backend is not running`)
    if (!proc.methods.includes(method)) throw new ExtensionCallError('EXT_UNKNOWN_METHOD', `Unknown method ${spec.manifest.id}.${method}`)
    const id = ++proc.seq
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        proc.pending.delete(id)
        reject(new ExtensionCallError('EXT_TIMEOUT', `${spec.manifest.id}.${method} timed out after ${CALL_TIMEOUT_MS / 1000}s`))
      }, CALL_TIMEOUT_MS)
      proc.pending.set(id, { resolve, reject, timer })
      proc.child.send({ type: 'invoke', id, method, args: args === undefined ? null : args })
    })
  }

  /** Stop a backend; resolves once the process is gone. Clears its crash record. */
  stop(id, { clearCrashes = true } = {}) {
    if (clearCrashes) this.crashes.delete(id)
    const proc = this.procs.get(id)
    if (!proc) return Promise.resolve()
    proc.stopping = true
    return new Promise((resolve) => {
      const kill = setTimeout(() => proc.child.kill(), 3000)
      proc.child.once('exit', () => {
        clearTimeout(kill)
        resolve()
      })
      try {
        proc.child.send({ type: 'stop' })
      } catch {
        proc.child.kill()
      }
    })
  }

  stopAll() {
    return Promise.all([...this.procs.keys()].map((id) => this.stop(id)))
  }
}

module.exports = { BackendHost, sandboxFlags, sandboxEnv, expandHome, RUNNER }
