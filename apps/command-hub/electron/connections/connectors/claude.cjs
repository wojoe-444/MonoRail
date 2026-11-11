// Claude (Claude Code / Agent SDK) login connector.
//
// The Claude Agent SDK signs in the same way Claude Code does: a Claude
// account login (claude auth login, or /login inside claude), or an
// ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN environment variable. The
// status check reads only what it needs to answer "is this signed in": that
// the credentials file has a refresh token or a token that has not expired,
// and the account email from Claude Code's settings. Tokens are never
// returned or copied. Nothing is stored by MonoRail.

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

const PLAN = { max: 'Claude Max', pro: 'Claude Pro', team: 'Claude Team', enterprise: 'Claude Enterprise' }

/** Fold what was found into a status. Exported for tests. */
function summarize({ creds, config, env = {}, cli, now = Date.now() }) {
  const oauth = creds?.claudeAiOauth
  const account = config?.oauthAccount
  const details = []
  if (account?.emailAddress) details.push({ label: 'Account', value: account.emailAddress })
  if (account?.organizationName) details.push({ label: 'Organization', value: account.organizationName })
  if (oauth?.subscriptionType) details.push({ label: 'Plan', value: PLAN[oauth.subscriptionType] ?? oauth.subscriptionType })
  if (cli) details.push({ label: 'Claude Code CLI', value: cli })

  const expiresAt = Number(oauth?.expiresAt) || undefined
  const fresh = !!oauth?.accessToken && (!expiresAt || expiresAt > now)
  if (oauth?.refreshToken || fresh) {
    return { state: 'ok', summary: account?.emailAddress ? `Signed in as ${account.emailAddress}.` : 'Signed in with a Claude account.', details }
  }
  if (env.CLAUDE_CODE_OAUTH_TOKEN) {
    details.push({ label: 'Source', value: 'CLAUDE_CODE_OAUTH_TOKEN environment variable' })
    return { state: 'ok', summary: 'Using a long-lived token from the environment.', details }
  }
  if (env.ANTHROPIC_API_KEY) {
    details.push({ label: 'Source', value: 'ANTHROPIC_API_KEY environment variable' })
    return { state: 'ok', summary: 'Using an Anthropic API key from the environment.', details }
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

async function status() {
  const loc = locations()
  const [creds, config, version] = await Promise.all([
    readJson(loc.credentials),
    readJson(loc.globalConfig),
    runTool('claude', ['--version'], { timeoutMs: 20_000 }),
  ])
  const cli = version.code === 0 ? version.stdout.trim().split(/\r?\n/)[0] : undefined
  return summarize({
    creds,
    config,
    cli,
    env: { ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN: !!process.env.CLAUDE_CODE_OAUTH_TOKEN },
  })
}

module.exports = {
  kind: 'claude',
  title: 'Claude',
  description: 'The Claude account that Claude Code and the Claude Agent SDK use.',
  icon: 'sparkles',
  fields: [],
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
  _internal: { summarize, locations },
}
