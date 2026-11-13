// Electron main process for the MonoRail desktop app.
//
// Private data rule: anything user-specific (API keys, tokens, local settings,
// run history) is stored under app.getPath('userData'), which on Windows is
// %APPDATA%\MonoRail. That folder is outside the repo and is never committed.

const path = require('node:path')
const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require('electron')

// `MonoRail.exe --mcp`: an agent started the MCP server (electron/mcp). No
// window, no app: hand stdio to the server and exit with it.
const { isMcpLaunch, launchMcp } = require('./mcp/launch.cjs')
if (isMcpLaunch()) launchMcp(app)
else startApp()

function startApp() {
  const { setupUserData } = require('./userData.cjs')
  // Before anything touches userData: picks the existing data folder (never moves it).
  setupUserData(app)
  // Developer Mode's New User profile starts blank each time it is switched
  // to: wipe its own folder (only profiles\new-user) before any backend opens it.
  try {
    if (require('./profiles/index.cjs').resetBlankProfile(app.getPath('userData'))) console.log('[profiles] New User profile reset to a blank slate')
  } catch (err) {
    console.error('[profiles] could not reset the New User profile', err)
  }

  // Remote access on (off by default): MonoRail may be running in the tray, so a
  // second launch opens that copy's window instead of starting another one.
  // With it off, nothing changes here.
  const { remoteService, readEnabledSync } = require('./remote/service.cjs')
  if (readEnabledSync(app.getPath('userData')) && !app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  const { registerExtensionScheme } = require('./extensions/index.cjs')
  // The monorail-ext:// scheme (extension UIs) must be registered before 'ready'.
  registerExtensionScheme()

  const { registerModuleBackends } = require('./modules/index.cjs')
  const { registerFullScreenIpc, attachFullScreen } = require('./window-fullscreen.cjs')

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
    attachFullScreen(win)

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
    registerFullScreenIpc()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Remote access (off by default) keeps serving a paired phone after the
  // window closes: MonoRail stays in the tray until it is turned off or quit.
  let tray
  let quitting = false
  app.on('before-quit', () => (quitting = true))

  async function showTray() {
    if (tray) return
    let icon = nativeImage.createEmpty()
    try {
      icon = await app.getFileIcon(process.execPath, { size: 'small' })
    } catch {
      // No icon: the tray entry still works.
    }
    tray = new Tray(icon)
    tray.setToolTip('MonoRail: Remote access is on')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open MonoRail', click: () => openWindow() },
        { label: 'Turn off Remote access and quit', click: () => void remoteService().setEnabled(false).finally(() => app.quit()) },
        { type: 'separator' },
        { label: 'Quit MonoRail', click: () => app.quit() },
      ]),
    )
    tray.on('click', () => openWindow())
  }

  function openWindow() {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.show()
      win.focus()
    } else createWindow()
    tray?.destroy()
    tray = undefined
  }

  app.on('second-instance', () => openWindow())
  remoteService().onChange((on) => {
    if (on) app.requestSingleInstanceLock()
    else app.releaseSingleInstanceLock()
  })

  app.on('window-all-closed', () => {
    if (!quitting && remoteService().isOn()) {
      void showTray()
      return
    }
    if (process.platform !== 'darwin') app.quit()
  })
}
