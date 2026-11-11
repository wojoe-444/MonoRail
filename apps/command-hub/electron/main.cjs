// Electron main process for the MonoRail desktop app.
//
// Private data rule: anything user-specific (API keys, tokens, local settings,
// run history) is stored under app.getPath('userData'), which on Windows is
// %APPDATA%\MonoRail. That folder is outside the repo and is never committed.

const path = require('node:path')
const { app, BrowserWindow, shell } = require('electron')

const { setupUserData } = require('./userData.cjs')
// Before anything touches userData: moves the old data folder to %APPDATA%\MonoRail once.
setupUserData(app)

const { registerModuleBackends } = require('./modules/index.cjs')

const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL

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
