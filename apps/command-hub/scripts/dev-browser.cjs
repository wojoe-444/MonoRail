// `npm run dev:browser`: the app in a normal browser tab with real backends.
// Starts the window-less Electron backend bridge (electron/dev-bridge.cjs) and
// the Vite dev server on a fixed port, joined by a random per-run token that
// only Vite's proxy knows. Open http://localhost:5199. Ctrl+C stops both.
//
// Env overrides: MONORAIL_DEV_PORT (5199), MONORAIL_BRIDGE_PORT (5198),
// MONORAIL_DEV_USER_DATA (data folder, default %APPDATA%\MonoRail Dev).

const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const devPort = process.env.MONORAIL_DEV_PORT || '5199'
const bridgePort = process.env.MONORAIL_BRIDGE_PORT || '5198'
const env = {
  ...process.env,
  MONORAIL_BRIDGE_TOKEN: crypto.randomBytes(32).toString('hex'),
  MONORAIL_BRIDGE_PORT: bridgePort,
  MONORAIL_DEV_PORT: devPort,
  MONORAIL_BRIDGE_ORIGINS: `http://localhost:${devPort},http://127.0.0.1:${devPort}`,
}
delete env.ELECTRON_RUN_AS_NODE

const electronBin = require('electron') // in Node this is the path to the binary
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const children = [
  spawn(electronBin, [path.join(root, 'electron', 'dev-bridge.cjs')], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, [viteBin, '--port', devPort, '--strictPort'], { cwd: root, env, stdio: 'inherit' }),
]

let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  for (const c of children) if (c.exitCode === null) c.kill()
  process.exitCode = code ?? 0
}

for (const c of children) c.on('exit', (code) => stop(code ?? 0))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
