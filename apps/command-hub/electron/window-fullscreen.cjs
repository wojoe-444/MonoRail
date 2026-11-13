// Full screen mode for the app window.
//
// F11 toggles it (handled here, before the page or the menu sees the key), and
// the page's top-bar button calls window.commandHub.toggleFullScreen(). The
// page hears every change on the 'window:fullscreen' push channel, so the
// button stays right however full screen was entered or left.

const { BrowserWindow, ipcMain } = require('electron')

function windowOf(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

/** Register the IPC handlers once, after app 'ready'. */
function registerFullScreenIpc() {
  ipcMain.handle('window:toggle-fullscreen', (event) => {
    const win = windowOf(event)
    if (!win) return false
    win.setFullScreen(!win.isFullScreen())
    return win.isFullScreen()
  })
  ipcMain.handle('window:is-fullscreen', (event) => windowOf(event)?.isFullScreen() ?? false)
}

/** Wire F11 and the change notifications for one window. */
function attachFullScreen(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F11') return
    if (input.alt || input.control || input.meta || input.shift) return
    event.preventDefault()
    win.setFullScreen(!win.isFullScreen())
  })
  const notify = () => {
    if (!win.isDestroyed()) win.webContents.send('window:fullscreen', win.isFullScreen())
  }
  win.on('enter-full-screen', notify)
  win.on('leave-full-screen', notify)
}

module.exports = { registerFullScreenIpc, attachFullScreen }
