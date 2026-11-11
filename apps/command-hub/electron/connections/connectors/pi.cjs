// pi coding agent connector.
//
// Detects the pi coding agent the way Chat does (findPiSdk: the package
// behind the `pi` command, under its new npm name @earendil-works or the old
// @mariozechner one), reports its version, which providers it is signed in to
// (the provider names and login kind from pi's auth.json; the credential
// values are dropped as soon as the file is parsed, never returned or kept),
// and its scoped models.
//
// Scoped models are the models pi cycles through (Ctrl+P) and offers in its
// model picker, the list pi's own /scoped-models command saves. pi keeps it
// as `enabledModels` in its global settings file (<agent dir>/settings.json,
// the agent dir being PI_CODING_AGENT_DIR or ~/.pi/agent). This connector's
// one setting is that list: saving the connection writes it there, the same
// way /scoped-models does, under pi's own lock file so a running pi and
// MonoRail never write at once. Every other pi setting is left as it is.

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const DEFAULT_SCOPED_MODELS = ['anthropic/claude-haiku-5-5', 'anthropic/claude-sonnet-5-5', 'anthropic/claude-opus-5-5']

// What pi accepts in --models / enabledModels: provider/id, globs, an
// optional :thinking suffix. Nothing else is written into pi's settings.
const PATTERN = /^[\w.@/*?[\]:+-]{1,200}$/
const MAX_PATTERNS = 50

function agentDir(env = process.env, home = os.homedir()) {
  const dir = env.PI_CODING_AGENT_DIR
  if (dir) return dir.startsWith('~') ? path.join(home, dir.slice(1)) : dir
  return path.join(home, '.pi', 'agent')
}

/** The connection's list, from its text value (commas, spaces or new lines between entries). */
function parsePatterns(text) {
  const out = []
  for (const p of String(text ?? '').split(/[\s,]+/)) if (p && !out.includes(p)) out.push(p)
  return out
}

function validatePatterns(patterns) {
  if (patterns.length > MAX_PATTERNS) throw new Error(`At most ${MAX_PATTERNS} scoped models.`)
  for (const p of patterns) if (!PATTERN.test(p)) throw new Error(`"${p}" is not a model pattern pi understands (e.g. anthropic/claude-sonnet-5-5).`)
}

/** pi's settings.json as an object, {} when there is none. Throws if it exists but is not JSON. */
async function readSettings(file) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
  const parsed = JSON.parse(text.replace(/^﻿/, ''))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('pi settings.json is not a JSON object.')
  return parsed
}

// pi writes settings.json under proper-lockfile: a `<file>.lock` directory,
// stale after 10 seconds. Taking the same lock keeps the two writers apart.
const LOCK_STALE_MS = 10_000

async function withPiLock(file, fn, { attempts = 25, delayMs = 40 } = {}) {
  const lock = `${file}.lock`
  for (let i = 0; ; i++) {
    try {
      await fs.mkdir(lock)
      break
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const st = await fs.stat(lock).catch(() => undefined)
      if (st && Date.now() - st.mtimeMs > LOCK_STALE_MS) {
        await fs.rm(lock, { recursive: true, force: true })
        continue
      }
      if (i >= attempts) throw new Error('pi is busy saving its settings. Try again in a moment.')
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  try {
    return await fn()
  } finally {
    await fs.rm(lock, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Set pi's enabledModels (an empty list removes it, which pi reads as "all
 * models"), keeping every other setting. Returns true when the file changed.
 */
async function applyScopedModels(dir, patterns) {
  validatePatterns(patterns)
  const file = path.join(dir, 'settings.json')
  await fs.mkdir(dir, { recursive: true })
  return withPiLock(file, async () => {
    const settings = await readSettings(file)
    if (sameList(settings.enabledModels, patterns)) return false
    if (patterns.length) settings.enabledModels = [...patterns]
    else delete settings.enabledModels
    const tmp = `${file}.${process.pid}.monorail.tmp`
    await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8')
    await fs.rename(tmp, file)
    return true
  })
}

function sameList(current, patterns) {
  const a = Array.isArray(current) ? current : []
  return a.length === patterns.length && a.every((x, i) => x === patterns[i])
}

/** Provider names and login kind from pi's auth.json. The credentials themselves are dropped here. */
async function readProviders(dir) {
  try {
    const data = JSON.parse((await fs.readFile(path.join(dir, 'auth.json'), 'utf8')).replace(/^﻿/, ''))
    if (!data || typeof data !== 'object') return []
    return Object.entries(data)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([provider, v]) => ({ provider, kind: v.type === 'oauth' ? 'login' : v.type === 'api_key' ? 'API key' : 'other' }))
  } catch {
    return []
  }
}

/** "anthropic/a, anthropic/b" -> "anthropic: a, b", so the list fits on the card. */
function shortList(patterns) {
  const groups = new Map()
  for (const p of patterns) {
    const i = p.indexOf('/')
    const provider = i > 0 ? p.slice(0, i) : ''
    if (!groups.has(provider)) groups.set(provider, [])
    groups.get(provider).push(i > 0 ? p.slice(i + 1) : p)
  }
  return [...groups].map(([provider, ids]) => (provider ? `${provider}: ${ids.join(', ')}` : ids.join(', '))).join('; ')
}

const PACKAGE_NOTE = { '@earendil-works/pi-coding-agent': '', '@mariozechner/pi-coding-agent': ' (old package name)' }

/** Fold what was found into a status. Exported for tests. */
function summarize({ sdk, settings, settingsError, providers = [], wanted, managed }) {
  const details = []
  if (sdk) details.push({ label: 'pi', value: `${sdk.version ?? 'unknown version'}${PACKAGE_NOTE[sdk.name] ?? ''}` })
  if (providers.length) details.push({ label: 'Signed in to', value: providers.map((p) => `${p.provider} (${p.kind})`).join(', ') })
  const current = Array.isArray(settings?.enabledModels) ? settings.enabledModels.filter((x) => typeof x === 'string') : undefined
  details.push({ label: 'Scoped in pi', value: settingsError ? `Could not read settings.json: ${settingsError}` : current?.length ? shortList(current) : 'All models (none scoped)' })
  let inSync
  if (managed && !settingsError) {
    inSync = sameList(current, wanted)
    details.push({ label: 'Matches this connection', value: inSync ? 'Yes' : 'No: Apply writes your list to pi', ok: inSync })
  }

  if (!sdk) {
    return {
      state: 'unavailable',
      summary: 'The pi coding agent was not found.',
      hint: 'Install it (npm install -g @earendil-works/pi-coding-agent), then check again.',
      details,
    }
  }
  if (settingsError) return { state: 'error', summary: 'pi is installed, but its settings.json could not be read.', hint: 'Fix or remove the file, then check again.', details }
  if (!providers.length) {
    return { state: 'needs-setup', summary: `pi ${sdk.version ?? ''} is installed but not signed in to any provider.`.replace('  ', ' '), hint: 'Run pi in a terminal and use /login.', details }
  }
  if (inSync === false) return { state: 'error', summary: "pi's scoped models differ from this connection.", hint: 'Apply scoped models writes your list to pi again.', details }
  return { state: 'ok', summary: `pi ${sdk.version ?? ''} is ready${managed && wanted.length ? ` with ${wanted.length} scoped models` : ''}.`.replace('  ', ' '), details }
}

function findSdk(deps) {
  if (deps.findPiSdk) return deps.findPiSdk()
  return require('../../modules/agent-chat-options.cjs').findPiSdk()
}

async function status(conn, deps = {}) {
  const dir = deps.piAgentDir ?? agentDir()
  const sdk = findSdk(deps)
  let settings
  let settingsError
  try {
    settings = await readSettings(path.join(dir, 'settings.json'))
  } catch (e) {
    settingsError = e instanceof Error ? e.message : String(e)
  }
  const providers = await readProviders(dir)
  return summarize({ sdk, settings, settingsError, providers, managed: !!conn, wanted: parsePatterns(conn?.values?.scopedModels) })
}

module.exports = {
  kind: 'pi',
  title: 'pi',
  description: 'The pi coding agent that Chat runs pi sessions with, and the models it is scoped to.',
  icon: 'terminal',
  fields: [
    {
      key: 'scopedModels',
      label: 'Scoped models',
      type: 'text',
      defaultValue: DEFAULT_SCOPED_MODELS.join(', '),
      placeholder: DEFAULT_SCOPED_MODELS.join(', '),
      help: "The models pi cycles through and offers, as pi's /scoped-models saves them (provider/model, comma separated; globs like anthropic/*sonnet* work). Saving writes them to pi's settings. Leave empty to allow all models.",
    },
  ],
  validate({ values }) {
    validatePatterns(parsePatterns(values.scopedModels))
  },
  /** After a save: put the list where pi reads it. */
  async afterSave(conn, deps = {}) {
    await applyScopedModels(deps.piAgentDir ?? agentDir(), parsePatterns(conn?.values?.scopedModels))
  },
  actions: [
    {
      id: 'apply-scoped-models',
      label: 'Apply scoped models',
      description: "Writes this connection's scoped models to pi's settings again (for example after /scoped-models changed them).",
      showWhen: ['ok', 'error', 'needs-setup'],
      run: async (conn, _job, deps = {}) => {
        if (!conn) throw new Error('Add the pi connection first.')
        await applyScopedModels(deps.piAgentDir ?? agentDir(), parsePatterns(conn.values?.scopedModels))
      },
    },
  ],
  status,
  _internal: { summarize, shortList, parsePatterns, validatePatterns, applyScopedModels, readSettings, readProviders, agentDir, withPiLock, DEFAULT_SCOPED_MODELS },
}
