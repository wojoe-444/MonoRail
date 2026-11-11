// Claude (Claude Code / Agent SDK) login connector.
//
// The Claude Agent SDK signs in the same way Claude Code does: a Claude
// account login (claude auth login, or /login inside claude), or an
// ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN environment variable. The
// status check reads only what it needs to answer "is this signed in": that
// the credentials file has a refresh token or a token that has not expired,
// and the account email from Claude Code's settings. Tokens are never
// returned or copied.
//
// It also sorts the login into an account type, because that decides what
// usage costs: a Subscription (Pro, Max, Team) is a flat fee, while API logins
// (Console, API key, Bedrock/Vertex/Foundry) and Enterprise logins bill every
// token at API prices. Signing in through claude.ai does not by itself mean a
// subscription. The type comes from `claude auth status --json` (what Claude
// Code itself reports, with MonoRail's environment), falling back to the
// credentials file and environment for older CLIs. The user can override it
// in the connection's settings (the only value MonoRail stores here).

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const { runTool, openTerminal } = require('../run.cjs')

function locations(env = process.env, home = os.homedir()) {
  const configDir = env.CLAUDE_CONFIG_DIR || path.join(home, '.claude')
  return {
    credentials: path.join(configDir, '.credentials.json'),
    globalConfig: env.CLAUDE_CONFIG_DIR ? path.join(env.CLAUDE_CONFIG_DIR, '.claude.json') : path.join(home, '.claude.json'),
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

const ACCOUNT_TYPES = ['subscription', 'api', 'enterprise']
const ACCOUNT_LABEL = { subscription: 'Subscription', api: 'API', enterprise: 'Enterprise', unknown: 'Unknown' }
const BILLING = {
  subscription: 'Flat-fee plan: usage is not billed per token. Costs shown are what the same use would cost at API prices.',
  api: 'Billed per token at API prices.',
  enterprise: 'Enterprise login: billed per token at API prices, even though it signs in through claude.ai.',
  unknown: 'MonoRail could not tell how this login is billed. Choose the account type in Edit.',
}
const PROVIDER = { bedrock: 'Amazon Bedrock', vertex: 'Google Vertex AI', foundry: 'Microsoft Foundry' }

/**
 * Sort the login into subscription | api | enterprise | unknown. `auth` is
 * the parsed output of `claude auth status --json` (undefined when the CLI
 * is missing or too old); creds/config/env are the fallback. Exported for tests.
 */
function detectAccount({ auth, creds, config, env = {} }) {
  const plan = (p) => (typeof p === 'string' ? p.toLowerCase() : undefined)
  const fromPlan = (p, how) => {
    if (p === 'enterprise') return { type: 'enterprise', reason: `${how}, Claude Enterprise plan.` }
    if (p === 'pro' || p === 'max' || p === 'team') return { type: 'subscription', reason: `${how}, ${PLAN[p]} plan.` }
    return { type: 'unknown', reason: p ? `${how}, plan "${p}".` : `${how}, but Claude Code did not report a plan.` }
  }
  if (auth && typeof auth === 'object' && typeof auth.authMethod === 'string') {
    const provider = typeof auth.apiProvider === 'string' ? auth.apiProvider.toLowerCase() : 'firstparty'
    if (provider !== 'firstparty' && provider !== 'gateway') return { type: 'api', reason: `Claude Code uses ${PROVIDER[provider] ?? provider}, billed by that cloud.` }
    switch (auth.authMethod) {
      case 'claude.ai':
        return fromPlan(plan(auth.subscriptionType), 'Signed in through claude.ai')
      case 'api_key':
        return {
          type: 'api',
          reason: auth.apiKeySource === 'ANTHROPIC_API_KEY' ? 'Claude Code uses the ANTHROPIC_API_KEY environment variable.' : 'Signed in with a Claude Console (API) account.',
        }
      case 'api_key_helper':
        return { type: 'api', reason: 'Claude Code gets an API key from an apiKeyHelper script.' }
      case 'third_party':
        return { type: 'api', reason: 'Claude Code uses a third-party provider, billed per token.' }
      case 'oauth_token':
        if (env.ANTHROPIC_AUTH_TOKEN) return { type: 'api', reason: 'Claude Code uses the ANTHROPIC_AUTH_TOKEN environment variable (a gateway or API token).' }
        return { type: 'subscription', reason: 'Claude Code uses a long-lived subscription token (CLAUDE_CODE_OAUTH_TOKEN).' }
      case 'none':
        return { type: 'unknown', reason: 'Claude Code is not signed in.' }
    }
  }
  // Older CLI without `auth status`: read what Claude Code keeps on disk.
  if (env.CLAUDE_CODE_USE_BEDROCK || env.CLAUDE_CODE_USE_VERTEX || env.CLAUDE_CODE_USE_FOUNDRY) return { type: 'api', reason: 'Claude Code is set to use a cloud provider, billed by that cloud.' }
  if (env.ANTHROPIC_API_KEY) return { type: 'api', reason: 'The ANTHROPIC_API_KEY environment variable is set.' }
  if (env.ANTHROPIC_AUTH_TOKEN) return { type: 'api', reason: 'The ANTHROPIC_AUTH_TOKEN environment variable is set.' }
  if (env.CLAUDE_CODE_OAUTH_TOKEN) return { type: 'subscription', reason: 'A long-lived subscription token (CLAUDE_CODE_OAUTH_TOKEN) is set.' }
  const oauth = creds?.claudeAiOauth
  if (oauth?.accessToken || oauth?.refreshToken) {
    if (oauth.subscriptionType) return fromPlan(plan(oauth.subscriptionType), 'Signed in through claude.ai')
    if (config?.primaryApiKey !== undefined) return { type: 'api', reason: 'Signed in with a Claude Console (API) account.' }
    return fromPlan(undefined, 'Signed in')
  }
  if (config?.primaryApiKey !== undefined) return { type: 'api', reason: 'Signed in with a Claude Console (API) account.' }
  return { type: 'unknown', reason: 'No Claude login was found.' }
}

/** The account type to use: the user's override, else what was detected. */
function resolveAccount(detected, override) {
  const type = ACCOUNT_TYPES.includes(override) ? override : detected.type
  return {
    type,
    label: ACCOUNT_LABEL[type],
    source: ACCOUNT_TYPES.includes(override) ? 'override' : 'detected',
    detected: detected.type,
    reason: detected.reason,
    billing: BILLING[type],
    // Enterprise and API pay list prices; a subscription does not pay per token.
    billedAtApiPrices: type === 'api' || type === 'enterprise',
  }
}

const PLAN = { max: 'Claude Max', pro: 'Claude Pro', team: 'Claude Team', enterprise: 'Claude Enterprise' }

/** Fold what was found into a status. Exported for tests. */
function summarize(input) {
  const s = summarizeLogin(input)
  const account = resolveAccount(detectAccount(input), input.override)
  s.details.unshift({
    label: 'Account type',
    value: account.source === 'override' ? `${account.label} (set by you; detected: ${ACCOUNT_LABEL[account.detected]})` : account.label,
  })
  return { ...s, account }
}

function summarizeLogin({ creds, config, env = {}, cli, auth, now = Date.now() }) {
  const oauth = creds?.claudeAiOauth
  const account = config?.oauthAccount
  const details = []
  if (account?.emailAddress) details.push({ label: 'Account', value: account.emailAddress })
  if (account?.organizationName) details.push({ label: 'Organization', value: account.organizationName })
  const planName = auth?.subscriptionType ?? oauth?.subscriptionType
  if (planName) details.push({ label: 'Plan', value: PLAN[planName] ?? planName })
  if (cli) details.push({ label: 'Claude Code CLI', value: cli })

  const expiresAt = Number(oauth?.expiresAt) || undefined
  const fresh = !!oauth?.accessToken && (!expiresAt || expiresAt > now)
  if (oauth?.refreshToken || fresh) {
    return { state: 'ok', summary: account?.emailAddress ? `Signed in as ${account.emailAddress}.` : 'Signed in with a Claude account.', details }
  }
  if (auth?.loggedIn && auth.authMethod === 'claude.ai') {
    return { state: 'ok', summary: auth.email ? `Signed in as ${auth.email}.` : 'Signed in with a Claude account.', details }
  }
  if (env.CLAUDE_CODE_OAUTH_TOKEN) {
    details.push({ label: 'Source', value: 'CLAUDE_CODE_OAUTH_TOKEN environment variable' })
    return { state: 'ok', summary: 'Using a long-lived token from the environment.', details }
  }
  if (env.ANTHROPIC_API_KEY) {
    details.push({ label: 'Source', value: 'ANTHROPIC_API_KEY environment variable' })
    return { state: 'ok', summary: 'Using an Anthropic API key from the environment.', details }
  }
  if (auth?.loggedIn) {
    const how = { api_key: 'a Claude Console (API) account', api_key_helper: 'an apiKeyHelper script', third_party: 'a cloud provider', oauth_token: 'a token from the environment' }
    return { state: 'ok', summary: `Claude Code is signed in with ${how[auth.authMethod] ?? 'a Claude account'}.`, details }
  }
  if (oauth) {
    return { state: 'expired', summary: 'The Claude login has expired.', hint: 'Sign in opens a terminal running claude auth login.', details }
  }
  return {
    state: cli ? 'needs-setup' : 'unavailable',
    summary: cli ? 'Not signed in to Claude yet.' : 'Not signed in, and the Claude Code CLI was not found.',
    hint: cli ? 'Sign in opens a terminal running claude auth login.' : 'Install Claude Code (npm install -g @anthropic-ai/claude-code), then sign in.',
    details,
  }
}

/** Parse `claude auth status --json`; undefined if it failed or is not JSON (older CLIs). */
function parseAuthStatus(result) {
  if (!result || result.notFound || result.timedOut) return undefined
  const text = (result.stdout ?? '').trim()
  const start = text.indexOf('{')
  if (start < 0) return undefined
  try {
    const parsed = JSON.parse(text.slice(start))
    return parsed && typeof parsed === 'object' && 'loggedIn' in parsed ? parsed : undefined
  } catch {
    return undefined
  }
}

const ENV_FLAGS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY']

async function status(conn) {
  const loc = locations()
  const [creds, config, version, authResult] = await Promise.all([
    readJson(loc.credentials),
    readJson(loc.globalConfig),
    runTool('claude', ['--version'], { timeoutMs: 20_000 }),
    // Exits 1 when signed out, but still prints its JSON.
    runTool('claude', ['auth', 'status', '--json'], { timeoutMs: 20_000 }),
  ])
  const cli = version.code === 0 ? version.stdout.trim().split(/\r?\n/)[0] : undefined
  // Only whether each variable is set: never its value.
  const env = Object.fromEntries(ENV_FLAGS.map((k) => [k, !!process.env[k]]))
  return summarize({ creds, config, cli, env, auth: parseAuthStatus(authResult), override: conn?.values?.accountType })
}

module.exports = {
  kind: 'claude',
  title: 'Claude',
  description: 'The Claude account that Claude Code and the Claude Agent SDK use.',
  icon: 'sparkles',
  fields: [
    {
      key: 'accountType',
      label: 'Account type',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { value: 'auto', label: 'Detect automatically' },
        { value: 'subscription', label: 'Subscription (Pro, Max, Team): flat fee' },
        { value: 'api', label: 'API (Console, API key, cloud provider): billed per token' },
        { value: 'enterprise', label: 'Enterprise: billed per token at API prices' },
      ],
      help: 'Decides how MonoRail treats Claude costs. Choose one only if the detected type is wrong.',
    },
  ],
  actions: [
    {
      id: 'sign-in',
      label: 'Sign in',
      description: 'Opens a terminal running claude auth login. Finish there, then check again.',
      showWhen: ['expired', 'needs-setup', 'ok', 'error'],
      // Interactive (it asks which kind of account), so it gets a visible window.
      run: async () => openTerminal('Claude sign-in', 'claude', ['auth', 'login']),
    },
  ],
  status,
  _internal: { summarize, locations, detectAccount, resolveAccount, parseAuthStatus },
}
