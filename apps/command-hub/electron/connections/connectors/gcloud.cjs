// Google Cloud CLI connector.
//
// Nothing is stored: gcloud keeps its own credentials. The status check asks
// gcloud for the active account and whether both kinds of credentials still
// work: the CLI's own login (gcloud auth login) and Application Default
// Credentials, which client libraries use (gcloud auth application-default
// login). Access tokens printed by the checks are discarded, never returned.
//
// "Sign in again" runs both logins one after the other. Each opens the
// browser for Google's consent page and waits for its loopback redirect.

const { runTool, spawnTool, killTree } = require('../run.cjs')

const QUIET = { CLOUDSDK_CORE_DISABLE_PROMPTS: '1' }

const AUTH_ERROR = /reauth|invalid_grant|refresh|expired|revoked|login|credentials/i
const NO_ADC = /could not automatically determine credentials|application-default login|was not found|does not exist/i

function firstLine(text) {
  return (
    String(text ?? '')
      .split(/\r?\n/)
      .map((l) => l.replace(/^ERROR:\s*/, '').trim())
      .find(Boolean) ?? ''
  )
}

/** Active account from `gcloud auth list --format=json`. */
function parseAuthList(stdout) {
  try {
    const list = JSON.parse(stdout)
    if (!Array.isArray(list)) return { accounts: [] }
    return { active: list.find((a) => a?.status === 'ACTIVE')?.account, accounts: list.map((a) => a?.account).filter(Boolean) }
  } catch {
    return { accounts: [] }
  }
}

/** Fold the checks into one status. Exported for tests. */
function summarize({ list, user, adc, project }) {
  if (list.notFound) {
    return {
      state: 'unavailable',
      summary: 'The Google Cloud CLI (gcloud) was not found.',
      hint: 'Install the Google Cloud CLI, then check again.',
      details: [],
    }
  }
  const { active, accounts } = parseAuthList(list.stdout)
  const details = []
  if (active) details.push({ label: 'Account', value: active })
  if (project) details.push({ label: 'Project', value: project })

  const userOk = !!active && user?.code === 0
  const adcOk = adc?.code === 0
  const adcMissing = !adcOk && NO_ADC.test(adc?.stderr ?? '')
  details.push({
    label: 'gcloud login',
    value: !active ? 'Not signed in' : userOk ? 'Valid' : AUTH_ERROR.test(user?.stderr ?? '') ? 'Expired' : firstLine(user?.stderr) || 'Not working',
    ok: userOk,
  })
  details.push({ label: 'Application default credentials', value: adcOk ? 'Valid' : adcMissing ? 'Not set up' : 'Expired', ok: adcOk })

  if (!active && !accounts.length && !adcOk) {
    return { state: 'needs-setup', summary: 'Not signed in to Google Cloud yet.', hint: 'Sign in runs gcloud auth login and gcloud auth application-default login.', details }
  }
  if (userOk && adcOk) return { state: 'ok', summary: `Signed in as ${active}.`, details }
  const broken = [!userOk && 'gcloud login', !adcOk && 'application default credentials'].filter(Boolean).join(' and ')
  return { state: 'expired', summary: `Google sign-in needs renewing (${broken}).`, hint: 'Sign in again runs both logins.', details }
}

async function status() {
  const list = await runTool('gcloud', ['auth', 'list', '--format=json'], { env: QUIET, timeoutMs: 60_000 })
  if (list.notFound) return summarize({ list })
  const [user, adc, proj] = await Promise.all([
    runTool('gcloud', ['auth', 'print-access-token', '--quiet'], { env: QUIET, timeoutMs: 60_000 }),
    runTool('gcloud', ['auth', 'application-default', 'print-access-token', '--quiet'], { env: QUIET, timeoutMs: 60_000 }),
    runTool('gcloud', ['config', 'get-value', 'project', '--quiet'], { env: QUIET, timeoutMs: 60_000 }),
  ])
  const project = proj.code === 0 ? proj.stdout.trim().split(/\r?\n/).pop() : undefined
  return summarize({ list, user, adc, project: project && project !== '(unset)' ? project : undefined })
}

const LOGIN_STEPS = [
  { label: 'gcloud auth login', args: ['auth', 'login'] },
  { label: 'gcloud auth application-default login', args: ['auth', 'application-default', 'login'] },
]

/**
 * Run both logins in order. job is the shared job record (see index.cjs):
 * we update step, url and output, and resolve when both finish.
 */
function signIn(job) {
  return new Promise((resolve, reject) => {
    let i = 0
    const next = () => {
      if (job.cancelled) return reject(new Error('Cancelled.'))
      if (i >= LOGIN_STEPS.length) return resolve()
      const step = LOGIN_STEPS[i]
      job.step = i + 1
      job.stepLabel = step.label
      job.url = undefined
      let child
      try {
        child = spawnTool('gcloud', step.args, { stdio: ['pipe', 'pipe', 'pipe'] })
      } catch (e) {
        return reject(e)
      }
      job.kill = () => killTree(child)
      child.stdin.end()
      const onData = (d) => {
        const text = String(d)
        job.appendOutput(text)
        const url = text.match(/https:\/\/accounts\.google\.com\/\S+/)
        if (url) job.url = url[0]
      }
      child.stdout.on('data', onData)
      child.stderr.on('data', onData)
      child.on('error', reject)
      child.on('close', (code) => {
        job.kill = undefined
        if (job.cancelled) return reject(new Error('Cancelled.'))
        if (code !== 0) return reject(new Error(`${step.label} did not finish (exit ${code}).`))
        i++
        next()
      })
    }
    next()
  })
}

module.exports = {
  kind: 'gcloud',
  title: 'Google Cloud',
  description: 'The gcloud CLI login and Application Default Credentials, used by Google Cloud tools and client libraries.',
  icon: 'cloud',
  fields: [],
  actions: [
    {
      id: 'sign-in',
      label: 'Sign in again',
      description: 'Runs gcloud auth login, then gcloud auth application-default login. Each opens Google sign-in in your browser.',
      showWhen: ['expired', 'needs-setup', 'ok', 'error'],
      steps: LOGIN_STEPS.length,
      run: (_conn, job) => signIn(job),
    },
  ],
  status,
  _internal: { summarize, parseAuthList },
}
