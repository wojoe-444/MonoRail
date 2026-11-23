// @ts-check
// The page half of the HTTP bridge (electron/bridge/server.cjs): defines
// window.commandHub the way the Electron preload does, over fetch and
// server-sent events. Never overrides a real preload. Used by the browser dev
// bridge (injected by vite.config.ts), by Remote access (served as
// /__bridge/client.js, with remote: true so pages hide PC-only actions) and by
// the self-hosted mode (electron/host, hosted: true: a browser tab on this PC).
// The decoder mirrors electron/bridge/codec.cjs.

/** @typedef {{ platform: string, remote?: boolean, hosted?: boolean }} BridgeOptions */

/** Runs in the page. Keep all of its dependencies inside the function.
 * @param {BridgeOptions} options
 */
function installBridge({ platform, remote = false, hosted = false }) {
  if (window.commandHub) return
  const TAG = '__monorailBridge'
  /** @param {string} s */
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  /** @param {string} text */
  const decode = (text) => JSON.parse(text, (_k, v) => {
    if (!v || typeof v !== 'object' || typeof v[TAG] !== 'string') return v
    switch (v[TAG]) {
      case 'date': return new Date(v.v)
      case 'bytes': return fromB64(v.v)
      case 'map': return new Map(v.v)
      case 'set': return new Set(v.v)
      case 'bigint': return BigInt(v.v)
      default: return v
    }
  })
  /** @type {Map<string, Set<(payload: unknown) => void>>} */
  const listeners = new Map()
  /** @type {EventSource | undefined} */
  let source
  const connect = () => {
    if (source) return
    source = new EventSource('/__bridge/events')
    source.onmessage = (e) => {
      const { channel, payload } = decode(e.data)
      for (const cb of listeners.get(channel) ?? []) cb(payload)
    }
  }
  /** @param {import('../../src/ipc/contract').InvokeRequest} request */
  async function invoke(request) {
    const res = await fetch('/__bridge/invoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(request),
    })
    const text = await res.text()
    let body
    try { body = decode(text) } catch { throw new Error('Bridge error (' + res.status + '): ' + text.slice(0, 200)) }
    if (!body.ok) {
      const err = new Error(body.error?.message ?? 'Bridge error')
      if (body.error?.name) err.name = body.error.name
      throw err
    }
    return body.result
  }

  window.commandHub = {
    platform,
    ...(remote ? { remote: true } : hosted ? { hosted: true } : { devBridge: true }),
    invoke: (moduleId, ...[method, args]) => invoke({ moduleId, method, args }),
    invokeExtension: (extensionId, method, args) => invoke({ moduleId: `ext:${extensionId}`, method, args }),
    on(channel, cb) {
      if (channel !== 'extension:event' && channel !== 'extension:changed') return () => {}
      if (typeof cb !== 'function') return () => {}
      connect()
      const subscribers = listeners.get(channel) ?? new Set()
      listeners.set(channel, subscribers)
      subscribers.add(cb)
      return () => subscribers.delete(cb)
    },
  }
}

/** @param {BridgeOptions} options */
function bridgeClientScript(options) {
  return `;(${installBridge.toString()})(${JSON.stringify(options)})\n`
}

module.exports = { bridgeClientScript }
