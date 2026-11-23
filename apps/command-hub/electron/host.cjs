// Self-hosted mode: MonoRail run from a checkout of this repo instead of the
// installed .exe (docs/guide/setup/run-from-source.md). Started by the
// launcher, scripts/host.cjs (`npm start` or Start MonoRail.cmd), as
// `electron .` with MONORAIL_HOST_KEY set, which main.cjs hands over to this
// file. Never packaged (electron-builder.json excludes it).
//
// A window-less Electron process: every module and app backend runs here, as
// in the desktop app, and electron/host/server.cjs serves the built pages
// (dist/) plus the backends to the user's browser on 127.0.0.1. Unlike the
// browser dev bridge it uses the real data folder (the same one the installed
// app uses; userData.cjs picks it and never moves it) and one copy per data
// folder at a time.
//
// Env (set by the launcher): MONORAIL_HOST_KEY (required, random per launch),
// MONORAIL_HOST_PORT (5180), MONORAIL_HOST_OPEN ('0' = don't open the browser),
// MONORAIL_HOST_USER_DATA (another data folder, e.g. for trying it out).

const path = require('node:path')
const { app, shell } = require('electron')

process.env.MONORAIL_HOSTED = '1'
const { HOST_RESTART_CODE, onHostRestart } = require('./host/mode.cjs')

const KEY = process.env.MONORAIL_HOST_KEY
// Out of the environment at once: agent turns, git and terminals started from
// here inherit it, and the key would let them drive every backend.
delete process.env.MONORAIL_HOST_KEY
const PORT = Number(process.env.MONORAIL_HOST_PORT || 5180)
// Exit codes the launcher understands besides 0 and HOST_RESTART_CODE.
const ALREADY_RUNNING = 3
const PORT_IN_USE = 4

if (!KEY || KEY.length < 32) {
  console.error('[host] Start MonoRail with `npm start` (or Start MonoRail.cmd), not directly.')
  process.exit(1)
}

if (process.env.MONORAIL_HOST_USER_DATA) {
  app.setName('MonoRail')
  app.setPath('userData', path.resolve(process.env.MONORAIL_HOST_USER_DATA))
} else {
  // Before anything touches userData: picks the existing data folder (never moves it).
  require('./userData.cjs').setupUserData(app)
}

// One MonoRail per data folder. A second start hands over to the running copy
// (which opens its page in the browser, or its window for the installed app
// with Remote access on) and stops here.
if (!app.requestSingleInstanceLock()) {
  console.log('[host] MonoRail is already running with this data folder; opening it there.')
  app.exit(ALREADY_RUNNING)
} else {
  start()
}

function start() {
  // Developer Mode's New User profile starts blank each time it is switched to.
  try {
    if (require('./profiles/index.cjs').resetBlankProfile(app.getPath('userData'))) console.log('[profiles] New User profile reset to a blank slate')
  } catch (err) {
    console.error('[profiles] could not reset the New User profile', err)
  }

  const { registerExtensionScheme, onBroadcast } = require('./extensions/index.cjs')
  registerExtensionScheme()
  const { startModuleBackends } = require('./modules/index.cjs')
  const { createHostServer, OPEN_PATH } = require('./host/server.cjs')

  const openUrl = () => `http://127.0.0.1:${PORT}${OPEN_PATH}?key=${KEY}`
  const openInBrowser = () => void shell.openExternal(openUrl()).catch((err) => console.error('[host] could not open the browser:', err.message))

  // No windows: keep running until the launcher stops us.
  app.on('window-all-closed', () => {})
  app.dock?.hide()

  let restarting = false
  // Developer Mode's profile switch: quit normally (backends stop their turns
  // on will-quit), then exit with the code that makes the launcher start us again.
  onHostRestart(() => {
    setTimeout(() => {
      restarting = true
      app.quit()
    }, 150)
  })
  app.on('quit', () => {
    if (restarting) process.exit(HOST_RESTART_CODE)
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.quit())

  app.on('second-instance', () => openInBrowser())

  app.whenReady().then(() => {
    const server = createHostServer({
      key: KEY,
      invoke: startModuleBackends(),
      subscribe: onBroadcast,
      distDir: path.join(__dirname, '..', 'dist'),
    })
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[host] Port ${PORT} is in use by another program. Start MonoRail with another port, e.g. \`npm start -- --port 5181\`.`)
        app.exit(PORT_IN_USE)
      } else {
        console.error(`[host] could not listen on 127.0.0.1:${PORT}:`, err.message)
        app.exit(1)
      }
    })
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[host] MonoRail is running. Data folder: ${app.getPath('userData')}`)
      console.log(`[host] Open it in your browser with this link (it works until you stop MonoRail):\n\n    ${openUrl()}\n`)
      if (process.env.MONORAIL_HOST_OPEN !== '0') openInBrowser()
    })
  })
}
