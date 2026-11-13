// Remote access state for the running app (docs/remote-access.md): one per
// process, driven by the `remote` module backend (electron/modules/remote.cjs)
// and asked by main.cjs whether to stay in the tray when the window closes.
//
// Off by default. While off nothing runs: no server, no port, no Tailscale
// command. Turning it on starts the 127.0.0.1 server and checks Tailscale
// (then every 5 minutes); an address that turns public (Funnel) stops the
// server until it is private again. Turning it off stops the server and signs
// every paired device out.

const fs = require('node:fs')
const path = require('node:path')
const { createRemoteStore } = require('./store.cjs')
const { createRemoteServer, createPairing, PAIR_PATH } = require('./server.cjs')
const tailscale = require('./tailscale.cjs')

const CHECK_EVERY_MS = 5 * 60 * 1000

function createRemoteService({ distDir = path.join(__dirname, '..', '..', 'dist'), runTool, log = (...a) => console.log('[remote]', ...a) } = {}) {
  let store
  let settings = { enabled: false, port: 5170, allowedLogins: [], agentFromPhone: false }
  let backends
  let backendsReady
  const backendsPromise = new Promise((r) => (backendsReady = r))
  let server
  let serverError
  let blocked // 'public' while the tailnet address is public
  let lastCheck
  let checkedAt
  let timer
  const pairing = createPairing()
  const changeListeners = new Set()
  const run = runTool ? { run: runTool } : {}

  /** The PC's tailnet name, without a port. */
  const hostName = () => (lastCheck?.dnsName || lastCheck?.host || '').replace(/:\d+$/, '') || undefined

  function requireStore() {
    if (!store) throw new Error('Remote access is not ready yet.')
    return store
  }

  async function startServer() {
    if (server || blocked) return
    const b = await backendsPromise
    serverError = undefined
    const s = createRemoteServer({
      store: requireStore(),
      state: () => ({ settings, dnsName: hostName() }),
      pairing,
      invoke: b.invoke,
      isDesktopOnly: b.isDesktopOnly,
      subscribe: b.subscribe,
      distDir,
    })
    await new Promise((resolve) => {
      s.once('error', (err) => {
        serverError = err.code === 'EADDRINUSE' ? `Port ${settings.port} is already in use on this PC.` : err.message
        log('could not listen:', serverError)
        resolve()
      })
      s.listen(settings.port, '127.0.0.1', () => {
        server = s
        log(`listening on 127.0.0.1:${settings.port}`)
        resolve()
      })
    })
  }

  async function stopServer() {
    const s = server
    server = undefined
    if (!s) return
    s.closeAllConnections?.()
    await new Promise((r) => s.close(() => r()))
    log('stopped')
  }

  async function check() {
    if (!settings.enabled) return lastCheck
    lastCheck = await tailscale.checkTailscale(settings.port, run)
    checkedAt = Date.now()
    if (lastCheck.funnel) {
      if (blocked !== 'public') log('address is public (Funnel): stopping')
      blocked = 'public'
      pairing.cancel()
      await stopServer()
    } else if (blocked === 'public') {
      blocked = undefined
      await startServer()
    }
    // First time on: the PC's own Tailscale login may connect.
    if (lastCheck.login && settings.allowedLogins.length === 0) {
      settings = await requireStore().writeSettings({ allowedLogins: [lastCheck.login] })
    }
    return lastCheck
  }

  function schedule() {
    clearInterval(timer)
    timer = setInterval(() => void check().catch((e) => log('check failed:', e.message)), CHECK_EVERY_MS)
    timer.unref?.()
  }

  return {
    /** Called by the module's start(ctx) with its machine-wide data folder. */
    async init(dir) {
      store = createRemoteStore(dir)
      settings = await store.readSettings()
    },
    /** Called once the backends' invoke exists (electron/modules/index.cjs). */
    attach({ invoke, isDesktopOnly, subscribe }) {
      backends = { invoke, isDesktopOnly, subscribe }
      backendsReady(backends)
    },
    /** At startup: if the person left it on, start again. */
    async resume() {
      if (!store || !settings.enabled) return
      await startServer()
      schedule()
      await check().catch((e) => log('check failed:', e.message))
    },
    isOn: () => settings.enabled === true,
    /** fn(enabled) after the person turns it on or off. */
    onChange(fn) {
      changeListeners.add(fn)
      return () => changeListeners.delete(fn)
    },
    isListening: () => !!server,

    async status() {
      const s = requireStore()
      const fresh = await s.readSettings()
      settings = { ...fresh, damaged: undefined }
      const devices = await s.listDevices()
      const address = lastCheck?.serve === 'ok' && hostName() ? `https://${hostName()}` : undefined
      return {
        settings: { enabled: fresh.enabled, port: fresh.port, allowedLogins: fresh.allowedLogins, agentFromPhone: fresh.agentFromPhone },
        settingsDamaged: !!fresh.damaged,
        listening: !!server,
        serverError,
        blocked,
        tailscale: lastCheck ?? null,
        checkedAt: checkedAt ?? null,
        address: address ?? null,
        devices: devices.devices,
        devicesDamaged: devices.damaged,
        pairing: pairing.active() ?? null,
        audit: await s.readAudit({ limit: 50 }),
      }
    },

    async setEnabled(on) {
      const s = requireStore()
      settings = await s.writeSettings({ enabled: !!on })
      if (settings.enabled) {
        await startServer()
        schedule()
        await check().catch((e) => log('check failed:', e.message))
      } else {
        clearInterval(timer)
        pairing.cancel()
        blocked = undefined
        lastCheck = undefined
        await stopServer()
        await s.revokeAll()
      }
      for (const fn of changeListeners) {
        try {
          fn(settings.enabled)
        } catch {
          // A listener's failure never undoes the change.
        }
      }
    },

    check,

    async setupServe() {
      if (!settings.enabled) throw new Error('Turn Remote access on first.')
      await tailscale.setupServe(settings.port, run)
      await check()
    },

    startPairing() {
      if (!server) throw new Error('Remote access is not running.')
      const host = hostName()
      if (lastCheck?.serve !== 'ok' || !host) throw new Error('Set up the private address first.')
      const p = pairing.start()
      return { url: `https://${host}${PAIR_PATH}?code=${p.code}`, expiresAt: p.expiresAt }
    },
    cancelPairing: () => pairing.cancel(),

    async setAgentFromPhone(on) {
      settings = await requireStore().writeSettings({ agentFromPhone: !!on })
    },
    async setLogins(logins) {
      settings = await requireStore().writeSettings({ allowedLogins: Array.isArray(logins) ? logins : [] })
      return settings.allowedLogins
    },
    renameDevice: (id, name) => requireStore().renameDevice(id, name),
    revokeDevice: (id) => requireStore().revokeDevice(id),
    clearAudit: () => requireStore().clearAudit(),

    /** For tests and shutdown. */
    async stop() {
      clearInterval(timer)
      await stopServer()
    },
  }
}

/**
 * Whether Remote access was left on, read straight from the file before the
 * app is ready (main.cjs: a second launch hands over to the tray copy).
 * The folder is machine-wide: <data folder>/modules/remote.
 */
function readEnabledSync(userDataDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(userDataDir, 'modules', 'remote', 'settings.json'), 'utf8'))?.enabled === true
  } catch {
    return false
  }
}

let shared
/** The app's one service. */
function remoteService() {
  if (!shared) shared = createRemoteService()
  return shared
}

module.exports = { createRemoteService, remoteService, readEnabledSync }
