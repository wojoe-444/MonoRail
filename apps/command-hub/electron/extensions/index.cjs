// Wires the extension system into Electron:
//   - the monorail-ext:// scheme that serves each extension's UI folder to its
//     sandboxed iframe (one origin per extension, strict CSP, no network)
//   - the built-in "extensions" backend the Extensions page and the iframe
//     bridge call (install, update, remove, enable, folders, logs)
//   - routing of "ext:<id>" invokes to the extension's own backend process
//   - pushing extension events and "installed set changed" to the renderer

const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, dialog, net, protocol, safeStorage, shell } = require('electron')

const { API_VERSION, resolveInside } = require('./manifest.cjs')
const { BackendHost } = require('./host.cjs')
const { ExtensionManager } = require('./manager.cjs')
const { SecretStore, safeStorageCipher } = require('./secrets.cjs')
const { SettingsStore } = require('./settings.cjs')
const { toWire } = require('./errors.cjs')

const SCHEME = 'monorail-ext'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

// Extension pages may only load their own files. No remote scripts, no
// fetch/XHR/WebSocket to anywhere: network access goes through the backend,
// where the manifest's permissions apply.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/** Must run before app 'ready'. */
function registerExtensionScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  ])
}

let manager

// Extra receivers for push events besides windows (the browser dev bridge).
const broadcastListeners = new Set()

/** Also receive every push event as (channel, payload). Returns an unsubscribe. */
function onBroadcast(fn) {
  broadcastListeners.add(fn)
  return () => broadcastListeners.delete(fn)
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
  for (const fn of broadcastListeners) {
    try {
      fn(channel, payload)
    } catch (err) {
      console.error('[extensions] broadcast listener failed', err)
    }
  }
}

function notFound(status = 404) {
  return new Response(status === 404 ? 'Not found' : 'Forbidden', { status, headers: { 'content-type': 'text/plain' } })
}

async function serve(request) {
  let url
  try {
    url = new URL(request.url)
  } catch {
    return notFound()
  }
  const id = url.hostname
  let file
  const headers = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' }
  try {
    if (url.pathname === '/__monorail/icon') {
      // Read by the hub's nav as a CSS mask, so it needs CORS.
      file = manager.iconFile(id, url.searchParams.get('c') ?? undefined)
      headers['access-control-allow-origin'] = '*'
    } else {
      const root = manager.uiRoot(id)
      if (!root) return notFound()
      let rel = decodeURIComponent(url.pathname)
      if (rel.endsWith('/')) rel += 'index.html'
      file = resolveInside(root, `.${rel}`)
      headers['content-security-policy'] = CSP
    }
  } catch {
    return notFound(403)
  }
  if (!file) return notFound()
  try {
    const data = await fs.promises.readFile(file)
    headers['content-type'] = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
    return new Response(data, { status: 200, headers })
  } catch {
    return notFound()
  }
}

function focusedWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

async function pickPath(kind, title) {
  const props = kind === 'zip' ? ['openFile'] : ['openDirectory']
  const res = await dialog.showOpenDialog(focusedWindow(), {
    title,
    properties: props,
    filters: kind === 'zip' ? [{ name: 'MonoRail extension', extensions: ['zip'] }] : undefined,
  })
  return res.canceled || !res.filePaths[0] ? undefined : res.filePaths[0]
}

/** The built-in backend behind the Extensions page and the extension frame bridge. */
const extensionsBackend = {
  id: 'extensions',
  methods: {
    async list() {
      return manager.list()
    },

    /** args: { kind: 'folder' | 'zip' | 'dev', path? } | { kind: 'github', repo }. Without a path, asks with a dialog. */
    async inspect(_ctx, args) {
      const kind = args?.kind
      let source = { ...args }
      if (kind === 'folder' || kind === 'zip' || kind === 'dev') {
        if (!source.path) {
          const titles = { folder: 'Install an extension from a folder', zip: 'Install an extension from a .zip', dev: 'Load an extension folder for development' }
          source.path = await pickPath(kind, titles[kind])
          if (!source.path) return null
        }
      }
      return manager.inspect(source)
    },

    async confirm(_ctx, { token }) {
      return manager.confirm(token)
    },
    async cancel(_ctx, { token }) {
      manager.cancel(token)
      return null
    },
    async uninstall(_ctx, { id, deleteData }) {
      await manager.uninstall(id, { deleteData: !!deleteData })
      return manager.list()
    },
    async setEnabled(_ctx, { id, enabled }) {
      return manager.setEnabled(id, enabled)
    },
    async approve(_ctx, { id }) {
      return manager.approve(id)
    },
    async reload(_ctx, { id }) {
      return manager.reload(id)
    },
    async checkUpdates() {
      return manager.checkUpdates()
    },
    async stageUpdate(_ctx, { id }) {
      return manager.stageUpdate(id)
    },
    async revokeFolder(_ctx, { id, path: folder }) {
      return manager.revokeFolder(id, folder)
    },
    async getSettings(_ctx, { id }) {
      return manager.getSettings(id)
    },
    async saveSettings(_ctx, { id, values }) {
      return manager.saveSettings(id, values)
    },
    async logs(_ctx, { id }) {
      return manager.logs(id)
    },
    async openFolder(_ctx, { id, which }) {
      const rec = manager.record(id)
      const dir = which === 'data' ? manager.dataDir(id) : rec.extensionDir
      fs.mkdirSync(dir, { recursive: true })
      const err = await shell.openPath(dir)
      if (err) throw new Error(err)
      return null
    },

    // ---- called by the hub on behalf of an extension page (bridge) ----

    /**
     * Call an extension's backend for its page. Resolves to { ok, value } or
     * { ok: false, error: { code, message, details? } }: Electron's IPC keeps
     * only an error's message, and pages need the code and details too.
     */
    async call(_ctx, { id, method, args }) {
      try {
        return { ok: true, value: await manager.invoke(id, method, args) }
      } catch (err) {
        return { ok: false, error: toWire(err) }
      }
    },

    /** The extension asked for a folder: the user picks it, and the backend restarts with access. */
    async requestFolder(_ctx, { id, write }) {
      const rec = manager.active(id)
      if (!rec.manifest.permissions.filesystem.pickFolders)
        throw new Error(`${rec.manifest.name} did not ask to use folders you pick`)
      const res = await dialog.showOpenDialog(focusedWindow(), {
        title: `Choose a folder ${rec.manifest.name} may ${write ? 'read and change' : 'read'}`,
        buttonLabel: 'Allow access',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (res.canceled || !res.filePaths[0]) return null
      return manager.grantFolder(id, res.filePaths[0], !!write)
    },

    async openExternal(_ctx, { url }) {
      if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('Only https:// links can be opened')
      await shell.openExternal(url)
      return null
    },
  },
}

/** Call after app 'ready'. Returns the "extensions" backend for the module registry. */
function setupExtensions() {
  const userData = app.getPath('userData')
  const secretStore = new SecretStore({ root: path.join(userData, 'extension-secrets'), cipher: safeStorageCipher(safeStorage) })
  const settingsStore = new SettingsStore({ root: path.join(userData, 'extension-settings'), secretStore })
  const host = new BackendHost({
    apiVersion: API_VERSION,
    onEmit: (id, channel, payload) => broadcast('extension:event', { id, channel, payload }),
    onStatus: () => broadcast('extension:changed', {}),
    onMigrated: (id, version) => manager.recordDataVersion(id, version),
    secrets: (id) => secretStore.forExtension(id),
    settings: (id) => settingsStore.backendValues(manager.record(id).manifest),
  })
  manager = new ExtensionManager({
    userData,
    host,
    secretStore,
    settingsStore,
    onSettings: (id, values) => broadcast('extension:event', { id, channel: 'monorail.settings', payload: values }),
    // Electron's net uses the system proxy settings, like the updater.
    fetchImpl: (url, init) => net.fetch(url, init),
    onChange: () => broadcast('extension:changed', {}),
  })
  protocol.handle(SCHEME, serve)
  manager.init()
  app.on('before-quit', () => {
    void host.stopAll()
  })
  return extensionsBackend
}

function invokeExtension(id, method, args) {
  if (!manager) throw new Error('Extensions are not ready yet')
  return manager.invoke(id, method, args)
}

module.exports = { registerExtensionScheme, setupExtensions, invokeExtension, onBroadcast, SCHEME }
