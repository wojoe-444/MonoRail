// The page half of the HTTP bridge (electron/bridge/server.cjs): defines
// window.commandHub the way the Electron preload does, over fetch and
// server-sent events. Never overrides a real preload. Used by the browser dev
// bridge (injected by vite.config.ts) and by Remote access (served as
// /__bridge/client.js, with remote: true so pages hide PC-only actions).
// The decoder mirrors electron/bridge/codec.cjs.

/** @param {{ platform: string, remote?: boolean }} opts */
function bridgeClientScript({ platform, remote = false }) {
  return `
(() => {
  if (window.commandHub) return
  const TAG = '__monorailBridge'
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
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
  const listeners = new Map()
  let source
  const connect = () => {
    if (source) return
    source = new EventSource('/__bridge/events')
    source.onmessage = (e) => {
      const { channel, payload } = decode(e.data)
      for (const cb of listeners.get(channel) ?? []) cb(payload)
    }
  }
  window.commandHub = {
    platform: ${JSON.stringify(platform)},
    ${remote ? 'remote: true' : 'devBridge: true'},
    async invoke(moduleId, method, args) {
      const res = await fetch('/__bridge/invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ moduleId, method, args }),
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
    },
    on(channel, cb) {
      if (channel !== 'extension:event' && channel !== 'extension:changed') return () => {}
      if (typeof cb !== 'function') return () => {}
      connect()
      if (!listeners.has(channel)) listeners.set(channel, new Set())
      listeners.get(channel).add(cb)
      return () => listeners.get(channel)?.delete(cb)
    },
  }
})()
`
}

module.exports = { bridgeClientScript }
