// Agent access backend: what the page needs to connect an agent to MonoRail's
// MCP server (electron/mcp): the command to run, ready-made config for common
// agents, and the tools the server offers. Nothing here runs the server; the
// agent starts it as its own subprocess.

const path = require('node:path')

const { readTools } = require('../mcp/tools.cjs')
const { SERVER } = require('../mcp/launch.cjs')

/**
 * The command an agent runs. The installed app: `MonoRail.exe --mcp`, which
 * picks the data folder itself. A development build (npm run desktop, or the
 * browser dev bridge with its own data folder) runs server.cjs in Node mode
 * with this process's data folder, so it serves the data you are looking at.
 */
function launchCommand(ctx) {
  if (ctx.isPackaged) return { command: process.execPath, args: ['--mcp'], env: {} }
  return { command: process.execPath, args: [SERVER, '--data-dir', ctx.rootDir], env: { ELECTRON_RUN_AS_NODE: '1' } }
}

const quote = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)

function snippets({ command, args, env }) {
  const envFlags = Object.entries(env).map(([k, v]) => `-e ${k}=${v} `).join('')
  const cmdLine = [command, ...args].map(quote).join(' ')
  const json = { mcpServers: { monorail: { command, args, ...(Object.keys(env).length ? { env } : {}) } } }
  return {
    claudeCode: `claude mcp add --scope user ${envFlags}monorail -- ${cmdLine}`,
    json: JSON.stringify(json, null, 2),
  }
}

module.exports = {
  id: 'mcp',
  methods: {
    getSetup(ctx) {
      const launch = launchCommand(ctx)
      return {
        packaged: !!ctx.isPackaged,
        ...launch,
        serverFile: path.basename(SERVER),
        dataDir: ctx.rootDir,
        snippets: snippets(launch),
        tools: readTools({ rootDir: ctx.rootDir }).map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          readOnly: !!t.annotations?.readOnlyHint,
        })),
      }
    },
  },
  _internal: { launchCommand, snippets },
}
