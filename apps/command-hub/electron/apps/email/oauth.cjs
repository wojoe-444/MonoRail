// OAuth 2.0 for desktop apps: authorization code + PKCE with a loopback redirect
// (RFC 8252). The system browser opens the provider's sign-in page; the
// provider redirects to http://127.0.0.1:<random port>/ on this machine,
// where a one-shot server reads the code and closes. Nothing here is
// provider specific; connectors pass their endpoints in.

const crypto = require('node:crypto')
const http = require('node:http')

const base64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** A fresh PKCE verifier (43-128 chars) and its S256 challenge. */
function createPkce() {
  const verifier = base64url(crypto.randomBytes(48))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge, method: 'S256' }
}

function buildAuthUrl(authEndpoint, params) {
  const url = new URL(authEndpoint)
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, String(v))
  return url.toString()
}

const PAGE = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font:15px/1.5 'Segoe UI',system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f6f7fb;color:#1d2433">` +
  `<div style="text-align:center;max-width:420px"><h2 style="margin:0 0 8px">${title}</h2><p style="margin:0;color:#5b6475">${body}</p></div>`

/**
 * Start a loopback listener on 127.0.0.1 with an OS-picked port.
 * Resolves to { redirectUri, waitForCode(state, timeoutMs), close() }.
 * waitForCode resolves with the authorization code for a request whose
 * state matches, and rejects on a provider error, a timeout or close().
 */
function startLoopback() {
  return new Promise((resolve, reject) => {
    let settle = null
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname !== '/') {
        res.writeHead(404).end()
        return
      }
      const result = {
        code: url.searchParams.get('code'),
        state: url.searchParams.get('state'),
        error: url.searchParams.get('error'),
      }
      const ok = !!(result.code && settle?.expectState === result.state)
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(
        ok
          ? PAGE('Signed in to MonoRail', 'You can close this tab and go back to MonoRail.')
          : PAGE('Sign-in did not finish', result.error ? `The provider said: ${escapeHtml(result.error)}. Go back to MonoRail and try again.` : 'Go back to MonoRail and try again.'),
      )
      if (!settle) return
      if (ok) settle.resolve(result.code)
      else if (result.error) settle.reject(new Error(result.error === 'access_denied' ? 'Sign-in was cancelled.' : `Sign-in failed: ${result.error}`))
      // A request with a wrong state is ignored (it is not ours); keep waiting.
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      let timer = null
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        clearTimeout(timer)
        server.close()
        server.closeAllConnections?.()
      }
      resolve({
        redirectUri: `http://127.0.0.1:${port}`,
        port,
        waitForCode(expectState, timeoutMs = 5 * 60_000) {
          return new Promise((res, rej) => {
            settle = {
              expectState,
              resolve: (c) => {
                close()
                res(c)
              },
              reject: (e) => {
                close()
                rej(e)
              },
            }
            timer = setTimeout(() => settle.reject(new Error('Sign-in timed out. Try again.')), timeoutMs)
          })
        },
        close() {
          if (settle && !closed) settle.reject(new Error('Sign-in was cancelled.'))
          else close()
        },
      })
    })
  })
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** POST a form to a token endpoint; throws with the provider's error text. */
async function postForm(fetchImpl, url, form) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(form).toString(),
  })
  const text = await res.text()
  let json = {}
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const err = new Error(json.error_description || json.error || `HTTP ${res.status}`)
    err.code = json.error
    err.status = res.status
    throw err
  }
  return json
}

module.exports = { base64url, createPkce, buildAuthUrl, startLoopback, postForm }
