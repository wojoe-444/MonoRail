// Tailscale checks for Remote access. Runs only while Remote access is on
// (opt-in): `tailscale status --json` and `tailscale serve status --json`,
// fixed arguments, no shell input from the page. The one write is the user's
// "Set it up" button: `tailscale serve --bg http://127.0.0.1:<port>`, which
// forwards the PC's tailnet HTTPS address to MonoRail. MonoRail never turns on
// Funnel (public), and treats a Funnel on its address as a reason to stop.

const { runTool } = require('../connections/run.cjs')

/** Parse `tailscale status --json`. */
function parseStatus(text) {
  let s
  try {
    s = JSON.parse(text)
  } catch {
    return { state: 'error', error: 'Tailscale gave an answer MonoRail could not read.' }
  }
  const state = s?.BackendState === 'Running' ? 'running' : 'stopped'
  const dnsName = typeof s?.Self?.DNSName === 'string' ? s.Self.DNSName.replace(/\.$/, '').toLowerCase() : undefined
  const userId = s?.Self?.UserID
  const login = userId !== undefined && s?.User ? s.User[String(userId)]?.LoginName : undefined
  return { state, dnsName, login: typeof login === 'string' ? login.toLowerCase() : undefined, backendState: s?.BackendState }
}

/** Every { host, handlers } web entry in a serve config, foreground ones included. */
function webEntries(config) {
  const out = []
  const add = (web) => {
    if (!web || typeof web !== 'object') return
    for (const [host, v] of Object.entries(web)) out.push({ host: host.toLowerCase(), handlers: v?.Handlers ?? {} })
  }
  add(config?.Web)
  for (const fg of Object.values(config?.Foreground ?? {})) add(fg?.Web)
  return out
}

function funnelHosts(config) {
  const out = []
  const add = (f) => {
    for (const [host, on] of Object.entries(f ?? {})) if (on) out.push(host.toLowerCase())
  }
  add(config?.AllowFunnel)
  for (const fg of Object.values(config?.Foreground ?? {})) add(fg?.AllowFunnel)
  return out
}

/**
 * Parse `tailscale serve status --json` for MonoRail's port.
 * serve: 'ok' (an address forwards to MonoRail) | 'missing' | 'other' (the root is taken by something else)
 * funnel: true when any address that forwards to MonoRail is public.
 */
function parseServe(text, port) {
  let config
  try {
    config = text.trim() ? JSON.parse(text) : {}
  } catch {
    return { serve: 'missing', funnel: false, error: 'Could not read the Tailscale serve settings.' }
  }
  const target = new RegExp(`^(https?://)?(127\\.0\\.0\\.1|localhost):${port}/?$`, 'i')
  const funnels = new Set(funnelHosts(config))
  let serve = 'missing'
  let funnel = false
  let host
  for (const e of webEntries(config)) {
    const root = e.handlers['/']
    if (!root) continue
    if (typeof root.Proxy === 'string' && target.test(root.Proxy)) {
      serve = 'ok'
      host = e.host
      if (funnels.has(e.host)) funnel = true
    } else if (serve !== 'ok') serve = 'other'
  }
  return { serve, funnel, host }
}

/**
 * The full check: { state: 'missing' | 'stopped' | 'running' | 'error', login, dnsName, serve, funnel, error }.
 * `run` is injectable for tests.
 */
async function checkTailscale(port, { run = runTool } = {}) {
  const st = await run('tailscale', ['status', '--json'], { timeoutMs: 15_000 })
  if (st.notFound) return { state: 'missing' }
  if (st.timedOut) return { state: 'error', error: 'Tailscale did not answer in time.' }
  // `tailscale status` exits non-zero when stopped or logged out, but still prints JSON.
  const status = parseStatus(st.stdout || '{}')
  if (status.state === 'error') return status
  if (status.state !== 'running') return { ...status, serve: 'missing', funnel: false }
  const sv = await run('tailscale', ['serve', 'status', '--json'], { timeoutMs: 15_000 })
  const serve = sv.code === 0 ? parseServe(sv.stdout, port) : { serve: 'missing', funnel: false }
  return { ...status, ...serve }
}

/** The user's "Set it up" button: forward the tailnet HTTPS address to MonoRail, in the background. */
async function setupServe(port, { run = runTool } = {}) {
  if (!Number.isInteger(port)) throw new Error('Bad port')
  const r = await run('tailscale', ['serve', '--bg', `http://127.0.0.1:${port}`], { timeoutMs: 30_000 })
  if (r.notFound) throw new Error('Tailscale is not installed on this PC.')
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || 'Tailscale could not set up the address.').trim().split('\n').slice(-3).join(' '))
}

module.exports = { checkTailscale, setupServe, parseStatus, parseServe }
