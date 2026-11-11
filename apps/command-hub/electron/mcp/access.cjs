// Agent access records for the MCP server, shared by the server process and
// the Agent access page (electron/modules/mcp.cjs). Both live in
// %APPDATA%\MonoRail\modules\mcp:
//
//   access.json   { agents: { [name]: { title?, version?, firstSeen, allow: { [tool]: true } } } }
//                 Write tools are off for every agent until the user turns one
//                 on there. The server only adds an agent it has not seen
//                 before; only the page changes what an agent may do.
//   audit.jsonl   one line per tool call: { at, agent, tool, write, ok, ms, error?, did? }
//                 `did` is a one-line description of what a write tool
//                 changed ("Created issue #4 in demo-repo"). Arguments and
//                 results are not logged. Trimmed to the newest lines.
//
// The agent's name is what its MCP client reports in `initialize`
// (clientInfo.name, e.g. "claude-code"). It is self-reported: consent is per
// agent program on this machine, not authentication.

const fs = require('node:fs/promises')
const path = require('node:path')

const { readJson, writeJsonAtomic, writeAtomic } = require('../cache/files.cjs')

const ACCESS_FILE = 'access.json'
const AUDIT_FILE = 'audit.jsonl'
const AUDIT_MAX_BYTES = 2 * 1024 * 1024
const AUDIT_KEEP_LINES = 2_000
const MAX_NAME = 100

const mcpDir = (rootDir) => path.join(rootDir, 'modules', 'mcp')

function cleanName(s) {
  const v = typeof s === 'string' ? [...s].filter((c) => c.charCodeAt(0) >= 32).join('').trim().slice(0, MAX_NAME) : ''
  return v || 'unknown agent'
}

async function readAccess(rootDir) {
  const a = await readJson(path.join(mcpDir(rootDir), ACCESS_FILE))
  return a && typeof a.agents === 'object' && a.agents ? a : { agents: {} }
}

/** May `agent` call write tool `tool`? Read fresh on every call, so a change on the page applies at once. */
async function isAllowed(rootDir, agent, tool) {
  const a = await readAccess(rootDir)
  return Object.hasOwn(a.agents, agent) && a.agents[agent].allow?.[tool] === true
}

/** Record an agent the first time it connects, with nothing allowed. */
async function noteAgent(rootDir, clientInfo) {
  const name = cleanName(clientInfo?.name)
  const a = await readAccess(rootDir)
  if (Object.hasOwn(a.agents, name)) return name
  a.agents[name] = {
    title: typeof clientInfo?.title === 'string' ? clientInfo.title.slice(0, MAX_NAME) : undefined,
    version: typeof clientInfo?.version === 'string' ? clientInfo.version.slice(0, 40) : undefined,
    firstSeen: new Date().toISOString(),
    allow: {},
  }
  await writeJsonAtomic(path.join(mcpDir(rootDir), ACCESS_FILE), a)
  return name
}

/** The page turns one write tool on or off for one agent. */
async function setAllowed(rootDir, agent, tool, allowed) {
  const a = await readAccess(rootDir)
  if (!Object.hasOwn(a.agents, agent)) throw new Error(`Unknown agent: ${agent}`)
  const allow = { ...a.agents[agent].allow }
  if (allowed) allow[tool] = true
  else delete allow[tool]
  a.agents[agent] = { ...a.agents[agent], allow }
  await writeJsonAtomic(path.join(mcpDir(rootDir), ACCESS_FILE), a)
  return a
}

async function forgetAgent(rootDir, agent) {
  const a = await readAccess(rootDir)
  delete a.agents[agent]
  await writeJsonAtomic(path.join(mcpDir(rootDir), ACCESS_FILE), a)
  return a
}

// ---------- audit log ----------

async function appendAudit(rootDir, entry) {
  const file = path.join(mcpDir(rootDir), AUDIT_FILE)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.appendFile(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
  try {
    if ((await fs.stat(file)).size > AUDIT_MAX_BYTES) {
      const lines = (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean)
      await writeAtomic(file, `${lines.slice(-AUDIT_KEEP_LINES).join('\n')}\n`)
    }
  } catch {
    // Trimming is best effort; the next call tries again.
  }
}

/** The newest `limit` entries, newest first. */
async function readAudit(rootDir, { limit = 200 } = {}) {
  let text
  try {
    text = await fs.readFile(path.join(mcpDir(rootDir), AUDIT_FILE), 'utf8')
  } catch {
    return []
  }
  const out = []
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    if (!lines[i]) continue
    try {
      out.push(JSON.parse(lines[i]))
    } catch {
      // A line cut by a crash: skip it.
    }
  }
  return out
}

async function clearAudit(rootDir) {
  await fs.rm(path.join(mcpDir(rootDir), AUDIT_FILE), { force: true })
}

module.exports = { ACCESS_FILE, AUDIT_FILE, mcpDir, cleanName, readAccess, isAllowed, noteAgent, setAllowed, forgetAgent, appendAudit, readAudit, clearAudit }
