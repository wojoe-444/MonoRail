// Preload: the only bridge between the sandboxed renderer and the main process.
// Exposes window.commandHub.invoke(moduleId, method, args), which routes to the
// module backends registered in electron/modules/index.cjs.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('commandHub', {
  platform: process.platform,
  invoke: (moduleId, method, args) => ipcRenderer.invoke('module:invoke', { moduleId, method, args }),
})
