// Developer Mode backend (Settings > Developer Mode, docs/developer-mode.md).
//
// Keeps no files. Developer Mode itself is a renderer switch; this backend
// only does what the renderer cannot: open Chromium's DevTools for the window.

const { BrowserWindow } = require('electron')

function mainWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

module.exports = {
  id: 'developer',
  // Methods that act on this PC's own screen (a dialog, Explorer, a terminal,
  // a restart). Remote access never runs them (electron/bridge/desktop-only.cjs).
  desktopOnly: ['toggleDevTools'],
  methods: {
    /** Open or close DevTools, docked to the right like a browser's. */
    toggleDevTools() {
      const win = mainWindow()
      if (!win) return { open: false, available: false }
      const wc = win.webContents
      if (wc.isDevToolsOpened()) wc.closeDevTools()
      else wc.openDevTools({ mode: 'right' })
      return { open: wc.isDevToolsOpened(), available: true }
    },
  },
}
