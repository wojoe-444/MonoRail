// Preload: the only bridge between the sandboxed renderer and the main process.
// Exposes window.commandHub.invoke(moduleId, method, args), which routes to the
// module backends registered in electron/modules/index.cjs.
// Also exposes on(channel, cb) for the two push channels the extension system
// uses: 'extension:event' (an extension backend's ctx.emit) and
// 'extension:changed' (installed set or a status changed).
const { contextBridge, ipcRenderer } = require('electron')

const PUSH_CHANNELS = new Set(['extension:event', 'extension:changed'])

contextBridge.exposeInMainWorld('commandHub', {
  platform: process.platform,
  invoke: (moduleId, method, args) => ipcRenderer.invoke('module:invoke', { moduleId, method, args }),
  on: (channel, cb) => {
    if (!PUSH_CHANNELS.has(channel) || typeof cb !== 'function') return () => {}
    const listener = (_event, payload) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
