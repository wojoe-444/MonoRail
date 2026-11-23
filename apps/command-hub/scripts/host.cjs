// `npm start` (or Start MonoRail.cmd at the repo root): run MonoRail from this
// checkout in your own browser, no .exe needed
// (docs/guide/setup/run-from-source.md).
//
// 1. Builds the pages (vite build into dist/) when they are missing or the code
//    changed since the last build (git HEAD plus uncommitted changes), or with
//    --rebuild.
// 2. Starts the window-less host (electron/host.cjs) with a random launch key
//    it opens in the browser. Starts it again when it asks (exit code 75: a
//    Developer Mode profile switch), keeping the key so the open tab keeps working.
// 3. Ctrl+C or closing this window stops MonoRail.
//
// Options: --port <n> (5180), --rebuild, --no-open, --data <folder> (another
// data folder instead of the installed app's).

const { spawn, spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const STAMP = path.join(dist, '.monorail-build.json')
const HOST_RESTART_CODE = 75
const ALREADY_RUNNING = 3

function parseArgs(argv) {
  const opts = { port: process.env.MONORAIL_HOST_PORT || '5180', rebuild: false, open: true, data: process.env.MONORAIL_HOST_USER_DATA }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--rebuild') opts.rebuild = true
    else if (a === '--no-open') opts.open = false
    else if (a === '--port') opts.port = argv[++i]
    else if (a === '--data') opts.data = argv[++i]
    else {
      console.error(`Unknown option ${a}. Options: --port <n>, --rebuild, --no-open, --data <folder>`)
      process.exit(2)
    }
  }
  if (!/^\d+$/.test(String(opts.port)) || Number(opts.port) < 1024 || Number(opts.port) > 65535) {
    console.error('--port must be a number from 1024 to 65535.')
    process.exit(2)
  }
  if (opts.data !== undefined && !opts.data) {
    console.error('--data needs a folder.')
    process.exit(2)
  }
  return opts
}

/** git output in this folder, or undefined (no git, or not a checkout: e.g. a downloaded zip). */
function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
  return r.status === 0 ? r.stdout : undefined
}

/** What the built pages were made from: HEAD plus a hash of uncommitted changes to the page sources. */
function sourceVersion() {
  const head = git(['rev-parse', 'HEAD'])
  if (!head) return undefined
  const diff = git(['diff', 'HEAD', '--', 'src', 'public', 'index.html', 'vite.config.ts', 'package.json']) ?? ''
  return `${head.trim()}+${crypto.createHash('sha256').update(diff).digest('hex').slice(0, 16)}`
}

function readStamp() {
  try {
    return JSON.parse(fs.readFileSync(STAMP, 'utf8')).source
  } catch {
    return undefined
  }
}

function buildIfNeeded(force) {
  const source = sourceVersion()
  const built = fs.existsSync(path.join(dist, 'index.html'))
  const reason = force ? 'asked to rebuild' : !built ? 'first start' : source && source !== readStamp() ? 'the code changed' : undefined
  if (!reason) return
  console.log(`\nBuilding MonoRail's pages (${reason}). This takes a minute or two...\n`)
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  const r = spawnSync(process.execPath, [vite, 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error('\nThe build failed (see above). MonoRail did not start.')
    process.exit(1)
  }
  if (source) fs.writeFileSync(STAMP, JSON.stringify({ source, at: new Date().toISOString() }))
}

/** The installed app uses the same data folder: two copies at once would trip over each other's files. */
function installedAppRunning() {
  if (process.platform !== 'win32') return false
  const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq MonoRail.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true })
  return r.status === 0 && /"MonoRail\.exe"/i.test(r.stdout)
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.data && installedAppRunning()) {
    console.error('\nThe installed MonoRail app is open. It uses the same data, so close it first (also from the tray, if Remote access is on), then start again.\n')
    process.exit(1)
  }
  buildIfNeeded(opts.rebuild)

  const electronBin = require('electron') // in Node this is the path to the binary
  const env = {
    ...process.env,
    MONORAIL_HOST_KEY: crypto.randomBytes(32).toString('hex'),
    MONORAIL_HOST_PORT: String(opts.port),
    MONORAIL_HOST_OPEN: opts.open ? '1' : '0',
  }
  if (opts.data) env.MONORAIL_HOST_USER_DATA = path.resolve(opts.data)
  else delete env.MONORAIL_HOST_USER_DATA
  delete env.ELECTRON_RUN_AS_NODE

  let child
  let stopping = false
  const run = () => {
    // The app folder, so name and version come from package.json; main.cjs
    // hands over to electron/host.cjs when it sees MONORAIL_HOST_KEY.
    child = spawn(electronBin, [root], { cwd: root, env, stdio: 'inherit' })
    child.on('exit', (code) => {
      if (!stopping && code === HOST_RESTART_CODE) {
        console.log('\nRestarting MonoRail...\n')
        env.MONORAIL_HOST_OPEN = '0' // the open tab reloads by itself
        return run()
      }
      process.exit(code === ALREADY_RUNNING ? 0 : (code ?? 0))
    })
  }

  // Ctrl+C reaches the host too (same console) and it quits on its own,
  // stopping running agent turns first. Force it only if it hangs.
  const stop = () => {
    if (stopping) return
    stopping = true
    console.log('\nStopping MonoRail...')
    setTimeout(() => child?.exitCode === null && child.kill(), 5000).unref()
    if (process.platform !== 'win32') child?.kill('SIGINT')
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  process.on('SIGHUP', stop)

  console.log(`\nStarting MonoRail on http://127.0.0.1:${opts.port}. Keep this window open; close it (or press Ctrl+C) to stop MonoRail.\n`)
  run()
}

main()
