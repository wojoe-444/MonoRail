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

const { writeJsonAtomic, writeAtomic, tryLock, lockHolder, pidAlive, sleep } = require('../cache/files.cjs')

const ACCESS_FILE = 'access.json'
const ACCESS_LOCK = 'access.json.lock'
const RECOVERY_LOCK = 'access.json.recovery.lock'
const AUDIT_FILE = 'audit.jsonl'
const AUDIT_MAX_BYTES = 2 * 1024 * 1024
const AUDIT_KEEP_LINES = 2_000
const MAX_NAME = 100

const mcpDir = (rootDir) => path.join(rootDir, 'modules', 'mcp')

function cleanName(s) {
  const v = typeof s === 'string' ? [...s].filter((c) => c.charCodeAt(0) >= 32).join('').trim().slice(0, MAX_NAME) : ''
  return v || 'unknown agent'
}

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

async function readAccessFile(file) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return { agents: {} }
    throw e
  }
  try {
    const a = JSON.parse(text)
    if (isRecord(a?.agents) && Object.values(a.agents).every((agent) => isRecord(agent) && isRecord(agent.allow))) return a
  } catch {
    // The same error covers invalid JSON and invalid records.
  }
  throw new Error('The agent access file is damaged.')
}

async function readAccess(rootDir) {
  try {
    return await readAccessFile(path.join(mcpDir(rootDir), ACCESS_FILE))
  } catch {
    return { agents: {} }
  }
}

async function abandoned(file) {
  const held = await lockHolder(file)
  return Number.isInteger(held?.pid) && held.pid > 0 && !pidAlive(held.pid)
}

async function recoverAccessLock(dir, lockFile) {
  if (!(await abandoned(lockFile))) return
  // Only one contender may remove an abandoned lock. Check it again after
  // taking the recovery lock, as another writer may already have taken over.
  const release = await tryLock(path.join(dir, RECOVERY_LOCK), { recoverStale: false })
  if (!release) return
  try {
    if (await abandoned(lockFile)) await fs.rm(lockFile, { force: true })
  } finally {
    await release()
  }
}

/** Every writer, including MCP registration, reads and replaces the file under this lock. */
async function updateAccess(rootDir, change) {
  const dir = mcpDir(rootDir)
  const lockFile = path.join(dir, ACCESS_LOCK)
  const deadline = Date.now() + 10_000
  let release
  while (!(release = await tryLock(lockFile, { recoverStale: false }))) {
    if (Date.now() > deadline) throw new Error('The agent access file is busy. Try again in a moment.')
    await recoverAccessLock(dir, lockFile)
    await sleep(25)
  }
  try {
    const file = path.join(dir, ACCESS_FILE)
    const a = await readAccessFile(file)
    if (change(a)) await writeJsonAtomic(file, a)
    return a
  } finally {
    await release()
  }
}

/** May `agent` call write tool `tool`? Read fresh on every call, so a change on the page applies at once. */
async function isAllowed(rootDir, agent, tool) {
  const a = await readAccess(rootDir)
  return Object.hasOwn(a.agents, agent) && a.agents[agent].allow?.[tool] === true
}

/** Record an agent the first time it connects, with nothing allowed. */
async function noteAgent(rootDir, clientInfo) {
  const name = cleanName(clientInfo?.name)
  if (Object.hasOwn((await readAccess(rootDir)).agents, name)) return name
  await updateAccess(rootDir, (a) => {
    if (Object.hasOwn(a.agents, name)) return false
    a.agents = {
      ...a.agents,
      [name]: {
        title: typeof clientInfo?.title === 'string' ? clientInfo.title.slice(0, MAX_NAME) : undefined,
        version: typeof clientInfo?.version === 'string' ? clientInfo.version.slice(0, 40) : undefined,
        firstSeen: new Date().toISOString(),
        allow: {},
      },
    }
    return true
  })
  return name
}

/** The page turns one write tool on or off for one agent. */
function setAllowed(rootDir, agent, tool, allowed) {
  return updateAccess(rootDir, (a) => {
    if (!Object.hasOwn(a.agents, agent)) throw new Error(`Unknown agent: ${agent}`)
    const allow = { ...a.agents[agent].allow, ...(allowed ? { [tool]: true } : {}) }
    if (!allowed) delete allow[tool]
    a.agents[agent] = { ...a.agents[agent], allow }
    return true
  })
}

function forgetAgent(rootDir, agent) {
  return updateAccess(rootDir, (a) => {
    if (!Object.hasOwn(a.agents, agent)) return false
    delete a.agents[agent]
    return true
  })
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
