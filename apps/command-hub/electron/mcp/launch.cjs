// `MonoRail.exe --mcp`: start the MCP server (server.cjs) instead of the app.
//
// The server runs in a child process in Node mode (ELECTRON_RUN_AS_NODE, the
// same way Chat's worker runs) with this process's stdin/stdout/stderr handed
// straight to it. This process opens no window and exits with the server.

const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const { resolveUserDataDir } = require('../userData.cjs')

const SERVER = path.join(__dirname, 'server.cjs')

function isMcpLaunch(argv = process.argv) {
  return argv.includes('--mcp')
}

function launchMcp(app) {
  // The same folder the app would pick; nothing is created or moved here.
  const dataDir = resolveUserDataDir(app.getPath('appData'))
  // Chromium still starts in this process and writes its own files (GPU cache,
  // Crashpad). Keep them out of the user's data folders: an empty folder with
  // an old name would otherwise be picked as the data folder on a new machine.
  app.setPath('userData', path.join(os.tmpdir(), 'MonoRail MCP launcher'))
  app.disableHardwareAcceleration()
  app.dock?.hide?.()
  const child = spawn(process.execPath, [SERVER, '--data-dir', dataDir], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
  })
  child.on('error', (e) => {
    process.stderr.write(`[monorail-mcp] could not start: ${e.message}\n`)
    app.exit(1)
  })
  child.on('exit', (code) => app.exit(code ?? 0))
}

module.exports = { isMcpLaunch, launchMcp, SERVER }
