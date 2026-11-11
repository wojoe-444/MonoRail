// Electron main process for the MonoRail desktop app.
//
// Private data rule: anything user-specific (API keys, tokens, local settings,
// run history) is stored under app.getPath('userData'), which on Windows is
// %APPDATA%\MonoRail. That folder is outside the repo and is never committed.

const path = require('node:path')
const { app, BrowserWindow, shell } = require('electron')

// `MonoRail.exe --mcp`: an agent started the MCP server (electron/mcp). No
// window, no app: hand stdio to the server and exit with it.
const { isMcpLaunch, launchMcp } = require('./mcp/launch.cjs')
if (isMcpLaunch()) launchMcp(app)
else startApp()

function startApp() {
  const { setupUserData } = require('./userData.cjs')
  // Before anything touches userData: picks the existing data folder (never moves it).
  setupUserData(app)

  const { registerExtensionScheme } = require('./extensions/index.cjs')
  // The monorail-ext:// scheme (extension UIs) must be registered before 'ready'.
  registerExtensionScheme()

  const { registerModuleBackends } = require('./modules/index.cjs')

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL

  /** "monorail-ext://<id>" for an extension page URL, else undefined. */
  function extensionOrigin(url) {
    const m = /^monorail-ext:\/\/([^/?#]+)/i.exec(url ?? '')
    return m ? `monorail-ext://${m[1].toLowerCase()}` : undefined
  }

  function createWindow() {
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 960,
      minHeight: 600,
      title: 'MonoRail',
      backgroundColor: '#f8f9fc',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    })

    win.once('ready-to-show', () => win.show())

    // Open external links in the user's browser, not inside the app.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url)
      return { action: 'deny' }
    })

    // Extension pages run in iframes and must stay on their own monorail-ext://
    // origin: a frame can't navigate itself to the web (which could leak data).
    // Other iframes (e.g. Email's srcdoc mail bodies) are not affected.
    win.webContents.on('will-frame-navigate', (event) => {
      if (event.isMainFrame) return
      const from = extensionOrigin(event.frame?.url)
      if (from && extensionOrigin(event.url) !== from) event.preventDefault()
    })

    if (isDev) {
      win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
      win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }
  }

  app.whenReady().then(() => {
    registerModuleBackends()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
