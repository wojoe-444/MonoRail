// OpenAI connector: an OpenAI API key and the Codex CLI's sign-in.
//
// Nothing here runs on its own. The check only runs once the user has added
// the connection, and even then it starts no program and makes no network
// request: it looks at which environment variables are set (never their
// values), finds `codex` on PATH by looking for the file, and reads the
// login mode and plan from Codex's auth.json. Tokens and keys are never
// returned to the page or copied.
//
// The API key comes from one of four places (field keySource):
//
//   env      the OPENAI_API_KEY environment variable, read when needed
//   direct   pasted into MonoRail, stored encrypted with safeStorage
//   wincred  a named generic credential in Windows Credential Manager, read
//            each time it is needed; MonoRail stores only the name
//   none     no API key (only the Codex CLI's own sign-in)
//
// The one network call is the "Test API key" action, which the user starts:
// GET https://api.openai.com/v1/models with the key. Its result is kept in
// memory only (with a hash of the key, so a changed key is not shown as
// tested). Other backends get { apiKey } through credentials().

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const wincred = require('../wincred.cjs')
const { openTerminal } = require('../run.cjs')

const API = 'https://api.openai.com/v1'

const SOURCE_LABEL = {
  env: 'OPENAI_API_KEY environment variable',
  direct: 'Saved in MonoRail (encrypted)',
  wincred: 'Credential Manager',
  none: 'No API key',
}

// Only whether each is set: never its value.
const ENV_FLAGS = ['OPENAI_API_KEY', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID', 'OPENAI_BASE_URL']

const PLAN = {
  free: 'ChatGPT Free',
  plus: 'ChatGPT Plus',
  pro: 'ChatGPT Pro',
  team: 'ChatGPT Business',
  business: 'ChatGPT Business',
  enterprise: 'ChatGPT Enterprise',
  edu: 'ChatGPT Edu',
}

function validate({ values, secretsSet }) {
  const source = values.keySource || 'env'
  if (!SOURCE_LABEL[source]) throw new Error('Choose where the API key is.')
  if (source === 'direct' && !secretsSet.apiKey) throw new Error('Paste your OpenAI API key.')
  if (source === 'wincred') wincred.validTarget(values.credentialTarget)
  if (source === 'none' && values.codex === 'no') throw new Error('With no API key, turn on the Codex CLI check, or there is nothing to connect.')
}

/** The API key, from wherever the connection says. Throws a readable error. */
async function credentials(conn, { readCredential = wincred.readCredential, env = process.env } = {}) {
  if (!conn) throw new Error('Add an OpenAI connection on the Connections page first.')
  const { values, secrets } = conn
  const source = values.keySource || 'env'
  let apiKey
  if (source === 'env') {
    apiKey = env.OPENAI_API_KEY
    if (!apiKey) throw new Error('The OPENAI_API_KEY environment variable is not set for MonoRail. Set it, then restart MonoRail.')
  } else if (source === 'direct') {
    apiKey = secrets.apiKey
    if (!apiKey) throw new Error('The saved OpenAI API key could not be read. Paste it again on the Connections page.')
  } else if (source === 'wincred') {
    apiKey = (await readCredential(values.credentialTarget)).secret
    if (!apiKey) throw new Error(`The Credential Manager entry "${values.credentialTarget}" has no password stored.`)
  } else {
    throw new Error('This OpenAI connection has no API key (Codex CLI only).')
  }
  return { apiKey: apiKey.trim() }
}

const keyHash = (key) => crypto.createHash('sha256').update(key).digest('hex')

// ---------- Codex CLI, found without running it ----------

function codexHome(env = process.env, home = os.homedir()) {
  return env.CODEX_HOME || path.join(home, '.codex')
}

/** The first `codex` program on PATH, by looking at files only. */
async function findOnPath(name, { env = process.env, platform = process.platform, stat = fs.stat } = {}) {
  const dirs = String(env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)
  const exts = platform === 'win32' ? String(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean).concat('.ps1') : ['']
  for (const dir of dirs) {
    for (const ext of exts) {
      const file = path.join(dir, name + ext.toLowerCase())
      try {
        if ((await stat(file)).isFile()) return file
      } catch {
        // not here
      }
    }
  }
  return undefined
}

/** The installed @openai/codex version, from its package.json next to the shim (npm), if it is there. */
async function codexVersion(bin, { realpath = fs.realpath, readFile = fs.readFile } = {}) {
  const candidates = []
  const dir = path.dirname(bin)
  candidates.push(path.join(dir, 'node_modules', '@openai', 'codex', 'package.json')) // npm on Windows
  candidates.push(path.join(dir, '..', 'lib', 'node_modules', '@openai', 'codex', 'package.json')) // npm prefix on Unix
  try {
    const real = await realpath(bin) // .../@openai/codex/bin/codex.js
    candidates.unshift(path.join(path.dirname(path.dirname(real)), 'package.json'))
  } catch {
    // keep the others
  }
  for (const file of candidates) {
    try {
      const pkg = JSON.parse(await readFile(file, 'utf8'))
      if (pkg?.name === '@openai/codex' && typeof pkg.version === 'string') return pkg.version
    } catch {
      // next
    }
  }
  return undefined
}

/** The plan claim of a ChatGPT id token, nothing else. Undefined if it does not parse. */
function planFromIdToken(idToken) {
  if (typeof idToken !== 'string') return undefined
  const part = idToken.split('.')[1]
  if (!part) return undefined
  try {
    const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    const plan = claims?.['https://api.openai.com/auth']?.chatgpt_plan_type
    return typeof plan === 'string' ? plan.toLowerCase() : undefined
  } catch {
    return undefined
  }
}

/**
 * How Codex is signed in, from its auth.json: { mode: 'chatgpt'|'apikey'|'none', plan? }.
 * Only the mode and the plan leave this function. Exported for tests.
 */
function readCodexAuth(auth) {
  if (!auth || typeof auth !== 'object') return { mode: 'none' }
  const tokens = auth.tokens && typeof auth.tokens === 'object' ? auth.tokens : undefined
  const mode = typeof auth.auth_mode === 'string' ? auth.auth_mode.toLowerCase() : undefined
  if ((mode === 'chatgpt' || !mode) && (tokens?.refresh_token || tokens?.access_token)) return { mode: 'chatgpt', plan: planFromIdToken(tokens.id_token) }
  if (auth.OPENAI_API_KEY) return { mode: 'apikey' }
  return { mode: 'none' }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** True when Codex keeps its login in the system keyring instead of auth.json. */
async function codexUsesKeyring(home) {
  try {
    const toml = await fs.readFile(path.join(home, 'config.toml'), 'utf8')
    return /^\s*cli_auth_credentials_store\s*=\s*["'](keyring|auto)["']/m.test(toml)
  } catch {
    return false
  }
}

async function findCodex(deps = {}) {
  const env = deps.env ?? process.env
  const home = deps.codexHome ?? codexHome(env)
  const bin = await (deps.findOnPath ?? findOnPath)('codex', { env })
  const [version, auth, keyring] = await Promise.all([
    bin ? (deps.codexVersion ?? codexVersion)(bin) : undefined,
    readJson(path.join(home, 'auth.json')),
    codexUsesKeyring(home),
  ])
  return { installed: !!bin, version, auth: readCodexAuth(auth), keyring }
}

// ---------- status ----------

/** Fold what was found into one status. Exported for tests. */
function summarize({ source, credentialTarget, key, test, codex, codexWanted, env = {} }) {
  const details = []
  const actions = []
  const keyPart = { found: false }

  if (source !== 'none') {
    const where = source === 'wincred' ? `${SOURCE_LABEL.wincred}: ${credentialTarget}` : SOURCE_LABEL[source]
    details.push({ label: 'API key', value: key.found ? where : `${where}: ${key.error ?? 'not found'}`, ok: key.found })
    keyPart.found = key.found
    if (key.found) {
      actions.push('test-key')
      if (test) {
        details.push({ label: 'Key test', value: test.ok ? `Passed (${test.message})` : `Failed: ${test.message}`, ok: test.ok })
      } else {
        details.push({ label: 'Key test', value: 'Not tested yet' })
      }
    }
    const extra = ['OPENAI_ORG_ID', 'OPENAI_PROJECT_ID', 'OPENAI_BASE_URL'].filter((k) => env[k])
    if (extra.length) details.push({ label: 'Also set', value: extra.join(', ') })
  }

  let codexSignedIn = false
  if (codexWanted) {
    if (!codex.installed) {
      details.push({ label: 'Codex CLI', value: 'Not found on PATH' })
    } else {
      details.push({ label: 'Codex CLI', value: codex.version ? `Installed (${codex.version})` : 'Installed', ok: true })
      if (codex.auth.mode === 'chatgpt') {
        codexSignedIn = true
        details.push({ label: 'Codex sign-in', value: codex.auth.plan ? `ChatGPT account, ${PLAN[codex.auth.plan] ?? codex.auth.plan} plan` : 'ChatGPT account', ok: true })
      } else if (codex.auth.mode === 'apikey') {
        codexSignedIn = true
        details.push({ label: 'Codex sign-in', value: 'API key (billed per token)', ok: true })
      } else if (codex.keyring) {
        codexSignedIn = true
        details.push({ label: 'Codex sign-in', value: 'Kept in the system keyring (MonoRail does not read it)' })
      } else {
        details.push({ label: 'Codex sign-in', value: 'Not signed in', ok: false })
        actions.push('codex-login')
      }
    }
  }

  const base = { details, actions }
  if (keyPart.found && test && !test.ok && test.rejected) {
    return { ...base, state: 'expired', summary: 'OpenAI rejected the API key. It may have been revoked.', hint: 'Create a new key at platform.openai.com > API keys and update it here.' }
  }
  if (source !== 'none' && !keyPart.found) {
    return {
      ...base,
      state: key.error && source === 'wincred' ? 'error' : 'needs-setup',
      summary: key.error && source === 'wincred' ? key.error : source === 'env' ? 'OPENAI_API_KEY is not set for MonoRail.' : 'No OpenAI API key is saved.',
      hint: source === 'env' ? 'Set the OPENAI_API_KEY environment variable and restart MonoRail, or paste the key in Edit.' : 'Add the key in Edit.',
    }
  }
  if (source === 'none' && !codexSignedIn) {
    return {
      ...base,
      state: codex.installed ? 'needs-setup' : 'unavailable',
      summary: codex.installed ? 'The Codex CLI is installed but not signed in.' : 'The Codex CLI was not found, and no API key is set up.',
      hint: codex.installed ? 'Sign in to Codex opens a terminal running codex login.' : 'Install Codex (npm install -g @openai/codex) or add an API key in Edit.',
    }
  }
  const parts = []
  if (keyPart.found) parts.push(test?.ok ? 'API key works' : 'API key found')
  if (codexSignedIn) parts.push('Codex is signed in')
  else if (codexWanted && codex.installed) parts.push('Codex is not signed in')
  return {
    ...base,
    state: 'ok',
    summary: `${parts.join('; ')}.`,
    hint: keyPart.found && !test ? 'Test API key makes one request to OpenAI to confirm the key works.' : undefined,
  }
}

// Last "Test API key" result, in memory only, per key hash.
let lastTest

async function status(conn, deps = {}) {
  if (!conn) return { state: 'needs-setup', summary: 'Not set up.', details: [] }
  const env = deps.env ?? process.env
  const source = conn.values.keySource || 'env'
  const codexWanted = conn.values.codex !== 'no'
  let key = { found: false }
  let hash
  if (source !== 'none') {
    try {
      const { apiKey } = await credentials(conn, { ...deps, env })
      key = { found: true }
      hash = keyHash(apiKey)
    } catch (e) {
      key = { found: false, error: source === 'wincred' ? e.message : undefined }
    }
  }
  const codex = codexWanted ? await findCodex({ ...deps, env }) : { installed: false, auth: { mode: 'none' } }
  const test = hash && lastTest?.hash === hash ? lastTest : undefined
  return summarize({
    source,
    credentialTarget: conn.values.credentialTarget,
    key,
    test,
    codex,
    codexWanted,
    env: Object.fromEntries(ENV_FLAGS.map((k) => [k, !!env[k]])),
  })
}

/** GET /v1/models with the key. Returns { ok, rejected?, message }. Exported for tests. */
async function testKey(apiKey, fetchImpl = fetch) {
  let res
  try {
    res = await fetchImpl(`${API}/models`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
  } catch (e) {
    return { ok: false, message: `Could not reach api.openai.com: ${e.cause?.code ?? e.message}` }
  }
  if (res.status === 401) return { ok: false, rejected: true, message: 'OpenAI rejected the key (401).' }
  if (res.status === 403) return { ok: false, message: 'The key works but may not list models (403). Check its permissions.' }
  if (res.status === 429) return { ok: false, message: 'OpenAI says the key is over its rate limit or quota (429).' }
  if (!res.ok) return { ok: false, message: `OpenAI answered ${res.status} ${res.statusText}.` }
  const body = await res.json().catch(() => ({}))
  const n = Array.isArray(body?.data) ? body.data.length : undefined
  return { ok: true, message: n !== undefined ? `${n} models available` : 'key accepted' }
}

module.exports = {
  kind: 'openai',
  title: 'OpenAI',
  description: 'An OpenAI API key and the Codex CLI sign-in. Nothing is checked until you add it.',
  icon: 'aperture',
  fields: [
    {
      key: 'keySource',
      label: 'API key',
      type: 'select',
      defaultValue: 'env',
      options: [
        { value: 'env', label: 'OPENAI_API_KEY environment variable' },
        { value: 'direct', label: 'Paste it into MonoRail' },
        { value: 'wincred', label: 'Windows Credential Manager entry' },
        { value: 'none', label: 'No API key (Codex CLI only)' },
      ],
      help: 'MonoRail only checks that the key is there. Test API key makes one request to OpenAI, only when you press it.',
    },
    {
      key: 'apiKey',
      label: 'OpenAI API key',
      type: 'secret',
      showIf: { keySource: 'direct' },
      placeholder: 'sk-...',
      help: 'Create one at platform.openai.com > API keys. Stored encrypted on this PC.',
    },
    {
      key: 'credentialTarget',
      label: 'Credential Manager entry',
      type: 'text',
      showIf: { keySource: 'wincred' },
      placeholder: 'e.g. openai-api-key',
      help: 'The name of a generic credential. Its password is the key; MonoRail reads it each time and does not copy it.',
      credentialPicker: true,
    },
    {
      key: 'codex',
      label: 'Codex CLI',
      type: 'select',
      defaultValue: 'yes',
      options: [
        { value: 'yes', label: 'Also look for the Codex CLI and its sign-in' },
        { value: 'no', label: 'Do not look for Codex' },
      ],
      help: 'Looks for the codex file on PATH and reads how Codex is signed in. It never runs codex.',
    },
  ],
  actions: [
    {
      id: 'test-key',
      label: 'Test API key',
      description: 'Makes one request to OpenAI (lists the models) to confirm the key works.',
      showWhen: ['ok', 'expired', 'error'],
      run: async (conn, job, deps = {}) => {
        const { apiKey } = await credentials(conn, deps)
        const r = await testKey(apiKey, deps.fetch ?? fetch)
        lastTest = { ...r, hash: keyHash(apiKey), at: new Date().toISOString() }
        job.note = r.ok ? `The key works: ${r.message}.` : r.message
        if (!r.ok) throw new Error(r.message)
      },
    },
    {
      id: 'codex-login',
      label: 'Sign in to Codex',
      description: 'Opens a terminal running codex login. Finish there, then check again.',
      showWhen: ['ok', 'needs-setup'],
      run: async () => openTerminal('Codex sign-in', 'codex', ['login']),
    },
  ],
  validate,
  status,
  credentials,
  _internal: { summarize, readCodexAuth, planFromIdToken, findOnPath, codexVersion, testKey, resetTest: () => (lastTest = undefined) },
}
