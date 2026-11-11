// Agent access backend: what the page needs to connect an agent to MonoRail's
// MCP server (electron/mcp): the command to run, ready-made config for common
// agents, the tools the server offers, which write tools each agent may use
// (access.json) and the log of calls (audit.jsonl). Nothing here runs the
// server; the agent starts it as its own subprocess.

const path = require('node:path')

const access = require('../mcp/access.cjs')
const { describeExtensionTools } = require('../mcp/extensions.cjs')
const { readTools, writeTools, coordinatorReadTools } = require('../mcp/tools.cjs')
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

function extensionToolsSafe(ctx) {
  try {
    return describeExtensionTools(ctx.rootDir)
  } catch (e) {
    ctx.log('could not read extension tools:', e.message)
    return []
  }
}

/** Every tool that needs the user's OK: built-in writes and every extension tool. */
function consentTools(ctx) {
  return [
    ...writeTools({ rootDir: ctx.rootDir }).map((t) => ({ name: t.name, title: t.title })),
    ...extensionToolsSafe(ctx).map((e) => ({ name: e.name, title: e.title, extension: e.rec.manifest.name })),
  ]
}

async function accessView(ctx) {
  const { agents } = await access.readAccess(ctx.rootDir)
  const writes = consentTools(ctx)
  return {
    writeTools: writes,
    agents: Object.entries(agents)
      .map(([name, a]) => ({ name, title: a.title, version: a.version, firstSeen: a.firstSeen, allow: writes.filter((t) => a.allow?.[t.name] === true).map((t) => t.name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
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
        tools: [
          ...[...readTools({ rootDir: ctx.rootDir }), ...coordinatorReadTools(), ...writeTools({ rootDir: ctx.rootDir })].map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            readOnly: !!t.annotations?.readOnlyHint,
            needsConsent: !!t.write,
          })),
          ...extensionToolsSafe(ctx).map((e) => ({ name: e.name, title: e.title, description: e.tool.description, readOnly: !e.tool.write, needsConsent: true, extension: e.rec.manifest.name })),
        ],
      }
    },
    /** Agents that have connected, and which write tools each may use. */
    getAccess: (ctx) => accessView(ctx),
    async setAllowed(ctx, args) {
      const tools = new Set(consentTools(ctx).map((t) => t.name))
      if (typeof args?.agent !== 'string' || !tools.has(args?.tool)) throw new Error('Unknown agent or tool')
      await access.setAllowed(ctx.rootDir, args.agent, args.tool, !!args.allowed)
      return accessView(ctx)
    },
    async forgetAgent(ctx, args) {
      if (typeof args?.agent === 'string') await access.forgetAgent(ctx.rootDir, args.agent)
      return accessView(ctx)
    },
    getAudit: (ctx, args) => access.readAudit(ctx.rootDir, { limit: Math.min(Math.max(Number(args?.limit) || 200, 1), 1000) }),
    clearAudit: (ctx) => access.clearAudit(ctx.rootDir),
  },
  _internal: { launchCommand, snippets, accessView },
}
