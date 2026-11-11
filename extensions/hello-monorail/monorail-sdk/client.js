// MonoRail extension SDK: the page side (runs inside the extension's iframe).
//
//   import { monorail } from './monorail-sdk/client.js'
//   await monorail.ready()                       // { extension, contribution, theme, apiVersion }
//   const stats = await monorail.invoke('getStats', { days: 7 })   // your backend's methods
//   monorail.on('log', (line) => ...)           // events your backend sends with ctx.emit('log', line)
//   const folder = await monorail.pickFolder({ write: false })    // needs filesystem.pickFolders
//   await monorail.openExternal('https://example.com')
//
// The SDK also keeps the page's theme in step with MonoRail (adds/removes the
// "dark" class on <html>) and, for pages shown inside the hub, reports the
// page height so the hub sizes the frame to fit.
//
// No dependencies, no build step needed. Bridge protocol version 1.

const BRIDGE = 1
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
  if (!inFrame) return Promise.reject(new Error('Not running inside MonoRail'))
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
        else p.reject(new Error(msg.error?.message ?? 'Request failed'))
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
    return inFrame ? readyPromise : Promise.reject(new Error('Not running inside MonoRail'))
  },

  /** Call a method of this extension's backend. Rejects with the backend's error message. */
  invoke(method, args) {
    return request('invoke', { method, args })
  },

  /** Listen for events the backend sends with ctx.emit(channel, payload). Returns an unsubscribe function. */
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
}

export default monorail
