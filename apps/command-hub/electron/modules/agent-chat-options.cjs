// Options for one Claude Agent SDK turn, built from a validated job.
//
// Safety rules (L4):
//   - Ask (the default) offers only read tools (Read, Grep, Glob), loads no MCP
//     servers, and denies anything that is not pre-approved.
//   - Agent uses Claude Code's normal permission rules, including the allow
//     rules in the repo's own .claude/settings.json. Nobody can answer an
//     approval prompt from the page, so every prompt is denied (and shown).
//   - No mode ever bypasses permissions: the settings overlay disables bypass
//     mode, and assertNoBypass() refuses to hand the SDK options that contain it.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/** Fixed model list for the picker. `undefined` = the CLI's own default. */
const CLAUDE_MODELS = [
  { id: 'default', label: 'Default' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
  { id: 'claude-fable-5-2', label: 'Fable 5.2' },
]

/** Effort picker. Default sends no effort, so the SDK chooses as it would with no picker. */
const EFFORTS = ['default', 'low', 'medium', 'high', 'xhigh', 'max']

/** pi models as provider/id. pi must know the model (an older pi may not). */
const PI_MODELS = [
  { id: 'default', label: 'Default' },
  { id: 'anthropic/claude-opus-4-7', label: 'Claude Opus 4.7' },
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5' },
  { id: 'google/gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
]

const SDKS = ['claude', 'pi']

const MODES = ['ask', 'agent']

const ASK_TOOLS = ['Read', 'Grep', 'Glob']

const DENY_MESSAGE = 'Nobody can approve tool use from the MonoRail Chat page, so this request was denied.'

const PATH_KEYS = new Set(['cwd', 'pathToClaudeCodeExecutable', 'resume'])

/** Throws if anything in the options would bypass permissions. Checks keys and values, deeply. */
function assertNoBypass(options) {
  const seen = new Set()
  const walk = (v, where) => {
    if (v == null) return
    if (typeof v === 'string') {
      if (/bypass|dangerously/i.test(v)) throw new Error(`Refusing to run: ${where} asks to bypass permissions.`)
      return
    }
    if (typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    for (const [k, child] of Object.entries(v)) {
      if (typeof child === 'function') continue
      if (/dangerously|bypass/i.test(k) && child !== undefined && child !== false && k !== 'disableBypassPermissionsMode') throw new Error(`Refusing to run: option ${k} is set.`)
      if (k === 'disableBypassPermissionsMode') continue // the setting that turns bypass off
      if (PATH_KEYS.has(k)) continue // a folder may be named anything
      walk(child, `${where}.${k}`)
    }
  }
  walk(options, 'options')
  if (options.permissionMode === 'bypassPermissions' || options.allowDangerouslySkipPermissions) {
    throw new Error('Refusing to run: bypass permissions is never allowed.')
  }
  return options
}

/** Validate a job coming from the renderer (through the main process). */
function validateJob(job) {
  if (!job || typeof job !== 'object') throw new Error('Missing job')
  if (typeof job.prompt !== 'string' || !job.prompt.trim()) throw new Error('Type a message first.')
  if (job.prompt.length > 100_000) throw new Error('That message is too long.')
  if (job.sdk === undefined) job.sdk = 'claude'
  if (!SDKS.includes(job.sdk)) throw new Error('Unknown SDK')
  if (!MODES.includes(job.mode)) throw new Error('Unknown mode')
  if (!(job.sdk === 'pi' ? PI_MODELS : CLAUDE_MODELS).some((m) => m.id === job.model)) throw new Error('Unknown model')
  if (!EFFORTS.includes(job.effort)) throw new Error('Unknown effort')
  return job
}

/**
 * SDK options for one turn. `job` is validated; `cwd` and `resume` were
 * resolved by the main process, never taken from the page.
 */
function buildClaudeOptions({ job, cwd, resume, executable, canUseTool }) {
  const options = {
    cwd,
    pathToClaudeCodeExecutable: executable,
    includePartialMessages: true,
    // Explicit, so a repo's permissions.defaultMode (or auto mode) never picks it.
    permissionMode: job.mode === 'ask' ? 'dontAsk' : 'default',
    settings: { permissions: { disableBypassPermissionsMode: 'disable' } },
    // CLAUDE.md, project settings and session-start hooks still load; hook
    // output is not forwarded to the page.
    settingSources: ['user', 'project', 'local'],
  }
  if (resume) options.resume = resume
  if (job.model !== 'default') options.model = job.model
  if (job.effort !== 'default') options.effort = job.effort
  if (job.mode === 'ask') {
    options.tools = ASK_TOOLS
    options.allowedTools = ASK_TOOLS
    options.mcpServers = {}
    options.strictMcpConfig = true
    options.settings.permissions.blockReadsOutsideWorkingDirectories = true
  } else {
    options.canUseTool = canUseTool
  }
  return assertNoBypass(options)
}

// ---------------------------------------------------------------------------
// pi
//
// pi has no permission prompts, so its safety comes from the tool list and a
// path guard:
//   - Ask: read, grep, find, ls.
//   - Agent: the same plus edit and write.
//   - Every tool's path must resolve (real path) inside the chat's repo.
//   - No mode ever offers bash, and the user's own pi extensions (which could
//     add tools) are not loaded.

const PI_READ_TOOLS = ['read', 'grep', 'find', 'ls']
const PI_WRITE_TOOLS = ['edit', 'write']

/** The pi tool allowlist for a mode. Throws if it would ever include a shell. */
function piTools(mode) {
  const tools = mode === 'agent' ? [...PI_READ_TOOLS, ...PI_WRITE_TOOLS] : [...PI_READ_TOOLS]
  if (tools.some((t) => /bash|shell|exec/i.test(t))) throw new Error('Refusing to run: pi never gets shell commands.')
  return tools
}

/** Effort -> pi thinking level. Default sets none; pi clamps to what the model supports. */
function piThinkingLevel(effort) {
  if (!effort || effort === 'default') return undefined
  return effort === 'max' ? 'xhigh' : effort
}

/**
 * Whether a tool may touch `target` (as the model wrote it). The path is
 * resolved against the chat folder, then to its real path (following links
 * and junctions); a path that does not exist yet (a new file) is checked
 * through its nearest existing parent.
 */
async function piPathAllowed(root, cwd, target) {
  const fsp = fs.promises
  let p = typeof target === 'string' && target.trim() ? target.trim() : '.'
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) p = path.join(os.homedir(), p.slice(1))
  p = path.resolve(cwd, p)
  let rest = ''
  for (;;) {
    try {
      const r = await fsp.realpath(p)
      const full = rest ? path.join(r, rest) : r
      const rel = path.relative(root, full)
      return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
    } catch {
      const parent = path.dirname(p)
      if (parent === p) return false
      rest = rest ? path.join(path.basename(p), rest) : path.basename(p)
      p = parent
    }
  }
}

/**
 * The pi coding agent SDK this machine already has: the package behind the
 * `pi` command (npm global install). MonoRail does not ship one, so pi runs
 * with the user's own version, settings and sign-in.
 */
function findPiSdk(env = process.env, home = os.homedir()) {
  const win = process.platform === 'win32'
  const dirs = [
    ...(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean),
    ...(win && env.APPDATA ? [path.join(env.APPDATA, 'npm')] : []),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.local', 'bin'),
  ]
  const pkgDir = (d) => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'))
      if (pkg.name === '@mariozechner/pi-coding-agent') return { dir: d, entry: path.join(d, 'dist', 'index.js'), version: pkg.version }
    } catch {
      // not it
    }
    return undefined
  }
  for (const dir of dirs) {
    for (const name of win ? ['pi.cmd', 'pi.exe', 'pi'] : ['pi']) {
      const bin = path.join(dir, name)
      if (!fs.existsSync(bin)) continue
      // npm on Windows: <prefix>\pi.cmd next to <prefix>\node_modules
      // npm on POSIX: <prefix>/bin/pi -> ../lib/node_modules/.../dist/cli.js
      const candidates = [path.join(dir, 'node_modules', '@mariozechner', 'pi-coding-agent'), path.join(dir, '..', 'lib', 'node_modules', '@mariozechner', 'pi-coding-agent')]
      try {
        let d = path.dirname(fs.realpathSync(bin))
        for (let i = 0; i < 4; i++, d = path.dirname(d)) candidates.unshift(d)
      } catch {
        // broken link
      }
      for (const c of candidates) {
        const found = pkgDir(c)
        if (found) return found
      }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Finding the user's Claude Code

/**
 * The Claude Code executable this machine already has. MonoRail does not ship
 * one (it is several hundred MB); it uses the user's own install, signed in as
 * they are in their terminal.
 */
function findClaudeExecutable(env = process.env, home = os.homedir()) {
  const win = process.platform === 'win32'
  const names = win ? ['claude.exe'] : ['claude']
  const dirs = [
    ...(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean),
    path.join(home, '.local', 'bin'),
    path.join(home, '.claude', 'local'),
  ]
  for (const dir of dirs) {
    for (const name of names) {
      const p = path.join(dir, name)
      try {
        if (fs.statSync(p).isFile()) return p
      } catch {
        // not here
      }
    }
  }
  return undefined
}

module.exports = { CLAUDE_MODELS, PI_MODELS, SDKS, PI_READ_TOOLS, piTools, piThinkingLevel, piPathAllowed, findPiSdk, EFFORTS, MODES, ASK_TOOLS, DENY_MESSAGE, assertNoBypass, validateJob, buildClaudeOptions, findClaudeExecutable }
