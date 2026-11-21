// @ts-check
// Preload: the only bridge between the sandboxed renderer and the main process.
// Exposes window.commandHub.invoke(moduleId, method, args), which routes to the
// module backends registered in electron/modules/index.cjs.
// Also exposes on(channel, cb) for the two push channels the extension system
// uses: 'extension:event' (an extension backend's ctx.emit) and
// 'extension:changed' (installed set or a status changed), plus
// 'window:fullscreen' (the window entered or left full screen, see
// electron/window-fullscreen.cjs, which also handles toggleFullScreen).
const { contextBridge, ipcRenderer } = require('electron')

const PUSH_CHANNELS = new Set(['extension:event', 'extension:changed', 'window:fullscreen'])

/** @param {import('../src/ipc/contract').InvokeRequest} request */
const invoke = (request) => ipcRenderer.invoke('module:invoke', request)

/** @type {import('../src/modules/types').CommandHubBridge} */
const bridge = {
  platform: process.platform,
  invoke: (moduleId, ...[method, args]) => invoke({ moduleId, method, args }),
  invokeExtension: (extensionId, method, args) => invoke({ moduleId: `ext:${extensionId}`, method, args }),
  toggleFullScreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  on: (channel, cb) => {
    if (!PUSH_CHANNELS.has(channel) || typeof cb !== 'function') return () => {}
    /** @param {import('electron').IpcRendererEvent} _event
     * @param {unknown} payload
     */
    const listener = (_event, payload) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('commandHub', bridge)
