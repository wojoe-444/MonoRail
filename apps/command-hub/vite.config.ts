import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// Set by scripts/dev-browser.cjs (`npm run dev:browser`): the page talks to the
// real backends through the window-less Electron bridge (electron/dev-bridge.cjs).
const bridgeToken = process.env.MONORAIL_BRIDGE_TOKEN
const bridgePort = process.env.MONORAIL_BRIDGE_PORT || '5198'

// Defines window.commandHub in the page the way the Electron preload does, but
// over HTTP to /__bridge (proxied to the bridge). Never overrides a real
// preload, so `npm run desktop` is unaffected. Mirrors electron/dev-bridge-codec.cjs.
const bridgeClient = `
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
    platform: ${JSON.stringify(process.platform)},
    devBridge: true,
    async invoke(moduleId, method, args) {
      const res = await fetch('/__bridge/invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ moduleId, method, args }),
      })
      const text = await res.text()
      let body
      try { body = decode(text) } catch { throw new Error('Dev bridge error (' + res.status + '): ' + text.slice(0, 200)) }
      if (!body.ok) {
        const err = new Error(body.error?.message ?? 'Dev bridge error')
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

function devBridge(): Plugin {
  return {
    name: 'monorail-dev-bridge',
    apply: 'serve',
    transformIndexHtml: () => [{ tag: 'script', children: bridgeClient, injectTo: 'head-prepend' }],
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(bridgeToken ? [devBridge()] : [])],
  // Shown in the drawer footer. CI stamps package.json before it builds the installer.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: bridgeToken
    ? {
        proxy: {
          '/__bridge': {
            target: `http://127.0.0.1:${bridgePort}`,
            headers: { 'x-monorail-bridge-token': bridgeToken },
          },
        },
      }
    : undefined,
})
