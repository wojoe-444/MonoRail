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
const access = require('./access.cjs')
const { readTools, writeTools } = require('./tools.cjs')

const INSTRUCTIONS = `MonoRail is the user's desktop hub for their coding agents. These tools read what MonoRail keeps on this machine: agent usage and cost (Claude Stats), recent agent chats, local issues of git repos opened in GitHub+, private local Jira+ projects, and whether the user's account connections work. Read tools return no secrets. Write tools (raising or commenting on local issues) are off until the user allows them for this agent in MonoRail under Configure > Agent access; if one is refused, tell the user where to turn it on rather than retrying. Every call is logged there. Data comes from MonoRail's caches, so it can be a few minutes old; results say when it was built.`

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
    tools: [...readTools({ rootDir }), ...writeTools({ rootDir })],
    // The agent shows up on the Agent access page with nothing allowed.
    onInitialize: async (clientInfo) => {
      try {
        return await access.noteAgent(rootDir, clientInfo)
      } catch (e) {
        log('could not record the agent:', e.message)
        return access.cleanName(clientInfo?.name)
      }
    },
    authorize: async ({ tool, agent }) => {
      if (!(await access.isAllowed(rootDir, agent, tool))) {
        throw new Error(`MonoRail has not allowed "${agent}" to use ${tool}. The user can turn it on in MonoRail under Configure > Agent access.`)
      }
    },
    onCall: (info) => {
      log(`tool ${info.tool} ${info.ok ? 'ok' : 'failed'} in ${info.ms} ms`)
      const { tool, agent, write, ok, ms, error, did } = info
      return access.appendAudit(rootDir, { agent, tool, write, ok, ms, error: error?.slice(0, 300), did }).catch((e) => log('audit log failed:', e.message))
    },
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
