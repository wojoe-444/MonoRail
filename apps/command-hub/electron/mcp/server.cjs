// MonoRail's MCP server: the entry point of the process an agent launches.
//
//   MonoRail.exe --mcp            (main.cjs starts this file in Node mode)
//   node electron/mcp/server.cjs [--data-dir <folder>]   (development, tests)
//
// It speaks MCP over stdio only: no network port is opened, so only the
// program that started it can talk to it. It reads MonoRail's data folder
// (the same one the app uses; userData.cjs picks it, never moving anything)
// and works whether or not the app is open.
//
// stdout carries protocol messages only, so every log line goes to stderr,
// and logs hold metadata (tool, outcome, time), never arguments or results.

const os = require('node:os')
const path = require('node:path')

const { resolveUserDataDir } = require('../userData.cjs')
const { createMcpServer } = require('./protocol.cjs')
const { serveStdio } = require('./stdio.cjs')
const { readTools } = require('./tools.cjs')

const INSTRUCTIONS = `MonoRail is the user's desktop hub for their coding agents. These tools read what MonoRail keeps on this machine: agent usage and cost (Claude Stats), recent agent chats, local issues of git repos opened in GitHub+, private local Jira+ projects, and whether the user's account connections work. They are read-only and return no secrets. Data comes from MonoRail's caches, so it can be a few minutes old; results say when it was built.`

function defaultAppData(env = process.env, platform = process.platform, home = os.homedir()) {
  if (platform === 'win32') return env.APPDATA || path.join(home, 'AppData', 'Roaming')
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support')
  return env.XDG_CONFIG_HOME || path.join(home, '.config')
}

function parseArgs(argv) {
  const i = argv.indexOf('--data-dir')
  return { dataDir: i >= 0 ? argv[i + 1] : undefined }
}

function version() {
  try {
    return require('../../package.json').version
  } catch {
    return '0.0.0'
  }
}

function createServer({ rootDir, log = () => {} }) {
  return createMcpServer({
    name: 'monorail',
    version: version(),
    instructions: INSTRUCTIONS,
    tools: readTools({ rootDir }),
    onCall: ({ tool, ok, ms }) => log(`tool ${tool} ${ok ? 'ok' : 'failed'} in ${ms} ms`),
  })
}

async function main() {
  // Keep stdout for protocol messages.
  const toStderr = (...a) => process.stderr.write(`${a.map(String).join(' ')}\n`)
  console.log = console.info = console.warn = console.debug = toStderr

  const { dataDir } = parseArgs(process.argv.slice(2))
  const rootDir = dataDir || process.env.MONORAIL_DATA_DIR || resolveUserDataDir(defaultAppData())
  const log = (...a) => toStderr('[monorail-mcp]', ...a)
  log(`serving ${rootDir}`)
  await serveStdio(createServer({ rootDir, log }))
  process.exit(0)
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`[monorail-mcp] ${e?.stack ?? e}\n`)
    process.exit(1)
  })
}

module.exports = { createServer, defaultAppData, parseArgs, INSTRUCTIONS }
