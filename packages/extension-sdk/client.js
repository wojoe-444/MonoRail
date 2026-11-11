// MonoRail extension SDK: the page side (runs inside the extension's iframe).
//
//   import { monorail } from './monorail-sdk/client.js'
//   await monorail.ready()                       // { extension, contribution, theme, apiVersion }
//   const stats = await monorail.invoke('getStats', { days: 7 })   // your backend's methods
//   monorail.on('log', (line) => ...)           // events your backend sends with ctx.emit('log', line)
//   const folder = await monorail.pickFolder({ write: false })    // needs filesystem.pickFolders
//   await monorail.openExternal('https://example.com')
//   const { values } = await monorail.getSettings()   // fields from "settings" in monorail.json
//   monorail.onSettings(({ values }) => ...)          // the user saved new settings
//   monorail.openSettings()                           // show the settings form
//
// The SDK also keeps the page's theme in step with MonoRail (adds/removes the
// "dark" class on <html>) and, for pages shown inside the hub, reports the
// page height so the hub sizes the frame to fit.
//
// Errors: a failed request rejects with a MonoRailError that has a `code`
// (EXT_* from MonoRail, or the backend's own code from ctx.fail()), a
// `message` and, if the backend sent them, JSON `details`.
//
// No dependencies, no build step needed. Bridge protocol version 1.

/** The SDK version: the same as the extension API version it was written for. */
export const SDK_VERSION = '1.1.0'

const BRIDGE = 1

/** Why a request failed: `code` is stable, `message` is for people. */
export class MonoRailError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'MonoRailError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}
const pending = new Map()
const listeners = new Map()
const themeListeners = new Set()
let seq = 0
let info
let resolveReady
const readyPromise = new Promise((r) => (resolveReady = r))
const inFrame = typeof window !== 'undefined' && window.parent !== window

function post(msg) {
  // The hub's origin is file:// (or the dev server), which postMessage can't
  // name, so target "*"; the hub checks that messages come from this frame.
  window.parent.postMessage({ monorail: BRIDGE, ...msg }, '*')
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  for (const cb of themeListeners) cb(theme)
}

function request(op, fields) {
  if (!inFrame) return Promise.reject(new MonoRailError('EXT_NOT_IN_MONORAIL', 'Not running inside MonoRail'))
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    post({ type: 'request', id, op, ...fields })
  })
}

if (inFrame) {
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return
    const msg = e.data
    if (!msg || typeof msg !== 'object' || msg.monorail !== BRIDGE) return
    switch (msg.type) {
      case 'init':
        info = { extension: msg.extension, contribution: msg.contribution, theme: msg.theme, apiVersion: msg.apiVersion }
        applyTheme(msg.theme)
        resolveReady(info)
        break
      case 'theme':
        if (info) info.theme = msg.theme
        applyTheme(msg.theme)
        break
      case 'response': {
        const p = pending.get(msg.id)
        if (!p) return
        pending.delete(msg.id)
        if (msg.ok) p.resolve(msg.value)
        else p.reject(new MonoRailError(msg.error?.code ?? 'EXT_HOST_ERROR', msg.error?.message ?? 'Request failed', msg.error?.details))
        break
      }
      case 'event':
        for (const cb of listeners.get(msg.channel) ?? []) cb(msg.payload)
        break
    }
  })
  post({ type: 'hello' })

  // Pages inside the hub grow with their content; apps fill the window.
  const report = () => post({ type: 'resize', height: document.documentElement.scrollHeight })
  const start = () => {
    new ResizeObserver(report).observe(document.documentElement)
    report()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
}

export const monorail = {
  /** True when the page runs inside MonoRail (false when opened directly, e.g. in a dev server). */
  inMonoRail: inFrame,

  /** Resolves once the hub has introduced itself: { extension, contribution, theme, apiVersion }. */
  ready() {
    return inFrame ? readyPromise : Promise.reject(new MonoRailError('EXT_NOT_IN_MONORAIL', 'Not running inside MonoRail'))
  },

  /** Call a method of this extension's backend. Rejects with a MonoRailError ({ code, message, details }). */
  invoke(method, args) {
    return request('invoke', { method, args })
  },

  /**
   * Listen for events the backend sends with ctx.emit(channel, payload).
   * Events are not queued: only pages open at that moment get them. Subscribe
   * first, then load the current state with invoke(). Returns an unsubscribe function.
   */
  on(channel, cb) {
    let set = listeners.get(channel)
    if (!set) listeners.set(channel, (set = new Set()))
    set.add(cb)
    return () => set.delete(cb)
  },

  /** Current theme ('light' | 'dark') and changes to it. Returns an unsubscribe function. */
  onTheme(cb) {
    themeListeners.add(cb)
    if (info) cb(info.theme)
    return () => themeListeners.delete(cb)
  },

  /**
   * Ask the user to choose a folder this extension may use. Resolves to
   * { path, write } or null if they cancel. The backend restarts with access,
   * and sees the folder in ctx.folders. Needs "filesystem": { "pickFolders": true }.
   */
  pickFolder({ write = false } = {}) {
    return request('pickFolder', { write })
  },

  /** Open an https:// link in the user's browser. */
  openExternal(url) {
    return request('openExternal', { url })
  },

  /**
   * The settings declared in monorail.json: { values, secrets }. `values` has
   * every non-secret field (defaults filled in); `secrets` says per secret
   * field whether one is set. Secret values never reach pages. API 1.1.
   */
  getSettings() {
    return request('getSettings', {})
  },

  /** Called with { values, secrets } after the user saves new settings. Returns an unsubscribe function. */
  onSettings(cb) {
    return monorail.on('monorail.settings', cb)
  },

  /** Take the user to this extension's settings form in MonoRail. */
  openSettings() {
    return request('openSettings', {})
  },
}

export default monorail
