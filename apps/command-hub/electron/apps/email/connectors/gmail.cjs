// Gmail connector: Google sign-in (OAuth 2.0, PKCE, loopback redirect) and
// the Gmail REST API v1. No Google SDK; plain fetch.
//
// The OAuth client is the user's own "Desktop app" client from Google Cloud
// Console. Google issues desktop clients a client secret but documents that
// it cannot be kept secret in an installed app; PKCE is what protects the
// code exchange. We still treat it as private: it is pasted into the app,
// encrypted with safeStorage, and never committed or shown again.

const crypto = require('node:crypto')

const { buildAuthUrl, createPkce, postForm, startLoopback, base64url } = require('../oauth.cjs')
const mime = require('../mime.cjs')

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'
// gmail.modify: read, send, label and archive. It cannot permanently delete.
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

const SYSTEM_FOLDERS = [
  { id: 'INBOX', name: 'Inbox', role: 'inbox' },
  { id: 'STARRED', name: 'Starred', role: 'starred' },
  { id: 'IMPORTANT', name: 'Important', role: 'important' },
  { id: 'SENT', name: 'Sent', role: 'sent' },
  { id: 'DRAFT', name: 'Drafts', role: 'drafts' },
  { id: 'SPAM', name: 'Spam', role: 'spam' },
  { id: 'TRASH', name: 'Trash', role: 'trash' },
]
/** Labels a user may add or remove on a thread. UNREAD is handled by markRead. */
const SETTABLE_SYSTEM = new Set(['INBOX', 'STARRED', 'IMPORTANT'])

class ReauthError extends Error {
  constructor(message = 'Google sign-in expired. Reconnect the account.') {
    super(message)
    this.code = 'reauth'
  }
}

/** Run fn over items with at most `limit` in flight; keeps order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function requireConfig(config) {
  const clientId = String(config?.clientId ?? '').trim()
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('Paste the OAuth client ID first (it ends in .apps.googleusercontent.com).')
  return { clientId, clientSecret: String(config?.clientSecret ?? '').trim() }
}

async function signIn(env, config, { signal } = {}) {
  const { clientId, clientSecret } = requireConfig(config)
  const pkce = createPkce()
  const state = base64url(crypto.randomBytes(16))
  const loopback = await startLoopback()
  const onAbort = () => loopback.close()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const url = buildAuthUrl(AUTH_URL, {
      client_id: clientId,
      redirect_uri: loopback.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
      state,
      access_type: 'offline',
      // consent every time, so Google always returns a refresh token.
      prompt: 'consent select_account',
    })
    const codeP = loopback.waitForCode(state)
    codeP.catch(() => {}) // awaited below; avoid an unhandled rejection while the browser opens
    await env.openExternal(url)
    const code = await codeP
    const tokens = await postForm(env.fetch, TOKEN_URL, {
      code,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      redirect_uri: loopback.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: pkce.verifier,
    })
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Try again.')
    const granted = String(tokens.scope ?? '').split(' ')
    if (!SCOPES.every((s) => granted.includes(s))) throw new Error('Gmail access was not granted. Tick the Gmail box on the consent screen and try again.')
    const profile = await apiJson(env.fetch, tokens.access_token, '/profile')
    return {
      account: { key: String(profile.emailAddress).toLowerCase(), address: profile.emailAddress, name: profile.emailAddress },
      credentials: { refreshToken: tokens.refresh_token, scope: tokens.scope },
      // Handed to createSession so the first calls skip a refresh.
      accessToken: { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 },
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    loopback.close()
  }
}

async function signOut(env, { credentials }) {
  if (!credentials?.refreshToken) return
  await env.fetch(`${REVOKE_URL}?token=${encodeURIComponent(credentials.refreshToken)}`, { method: 'POST' }).catch(() => {})
}

async function apiJson(fetchImpl, accessToken, pathAndQuery, init = {}) {
  const res = await fetchImpl(`${API}${pathAndQuery}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  if (res.status === 204) return {}
  const text = await res.text()
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const err = new Error(json.error?.message || `Gmail API error (HTTP ${res.status})`)
    err.status = res.status
    throw err
  }
  return json
}

function createSession(env, { config, credentials, onCredentials, accessToken }) {
  const { clientId, clientSecret } = requireConfig(config)
  let creds = credentials
  let access = accessToken ?? null
  let refreshing = null

  async function refresh() {
    refreshing ??= (async () => {
      try {
        const t = await postForm(env.fetch, TOKEN_URL, {
          client_id: clientId,
          ...(clientSecret ? { client_secret: clientSecret } : {}),
          refresh_token: creds.refreshToken,
          grant_type: 'refresh_token',
        })
        access = { token: t.access_token, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 }
        if (t.refresh_token && t.refresh_token !== creds.refreshToken) {
          creds = { ...creds, refreshToken: t.refresh_token }
          await onCredentials?.(creds)
        }
      } catch (e) {
        if (e.code === 'invalid_grant' || e.code === 'unauthorized_client') throw new ReauthError()
        throw e
      } finally {
        refreshing = null
      }
    })()
    await refreshing
  }

  async function call(pathAndQuery, init) {
    if (!access || access.expiresAt - 60_000 < Date.now()) await refresh()
    try {
      return await apiJson(env.fetch, access.token, pathAndQuery, init)
    } catch (e) {
      if (e.status !== 401) {
        if (e.status === 403 && /insufficient/i.test(e.message)) throw new ReauthError('MonoRail needs Gmail access again. Reconnect the account.')
        throw e
      }
      await refresh()
      return apiJson(env.fetch, access.token, pathAndQuery, init)
    }
  }

  const post = (p, body) => call(p, { method: 'POST', body: JSON.stringify(body ?? {}) })

  function summarize(thread) {
    const msgs = thread.messages ?? []
    const first = msgs[0]
    const last = msgs.at(-1)
    const labelIds = [...new Set(msgs.flatMap((m) => m.labelIds ?? []))]
    const participants = [...new Set(msgs.map((m) => mime.nameOf(mime.decodeHeaderText(mime.header(m.payload?.headers, 'From')))))]
    return {
      id: thread.id,
      subject: mime.decodeHeaderText(mime.header(first?.payload?.headers, 'Subject')) || '(no subject)',
      from: mime.decodeHeaderText(mime.header(last?.payload?.headers, 'From')),
      participants,
      snippet: decodeEntities(last?.snippet ?? thread.snippet ?? ''),
      date: last?.internalDate ? new Date(Number(last.internalDate)).toISOString() : null,
      messageCount: msgs.length,
      unread: msgs.some((m) => m.labelIds?.includes('UNREAD')),
      starred: labelIds.includes('STARRED'),
      labelIds,
      hasAttachments: msgs.some((m) => hasAttachment(m.payload)),
    }
  }

  function normalizeMessage(m) {
    const h = m.payload?.headers
    const { text, html, attachments } = mime.extractBodies(m.payload)
    return {
      id: m.id,
      threadId: m.threadId,
      from: mime.decodeHeaderText(mime.header(h, 'From')),
      to: mime.decodeHeaderText(mime.header(h, 'To')),
      cc: mime.decodeHeaderText(mime.header(h, 'Cc')),
      replyTo: mime.decodeHeaderText(mime.header(h, 'Reply-To')),
      subject: mime.decodeHeaderText(mime.header(h, 'Subject')),
      date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
      snippet: decodeEntities(m.snippet ?? ''),
      text,
      html,
      attachments,
      labelIds: m.labelIds ?? [],
      unread: !!m.labelIds?.includes('UNREAD'),
    }
  }

  return {
    capabilities: { labels: true, multipleLabels: true, search: true, folderTree: false, fullStoreSearch: false, daysBack: true, unreadFilter: true },

    async listFolders() {
      const { labels = [] } = await call('/labels')
      const inbox = await call('/labels/INBOX').catch(() => null)
      const present = new Set(labels.map((l) => l.id))
      const system = SYSTEM_FOLDERS.filter((f) => present.has(f.id)).map((f) => ({
        ...f,
        kind: 'system',
        unread: f.id === 'INBOX' ? (inbox?.threadsUnread ?? 0) : undefined,
      }))
      const user = labels
        .filter((l) => l.type === 'user')
        .map((l) => ({ id: l.id, name: l.name, kind: 'user', color: l.color?.backgroundColor }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return [...system, ...user]
    },

    async listThreads({ folderId, query, pageToken, pageSize = 25, daysBack, unreadOnly } = {}) {
      const qs = new URLSearchParams({ maxResults: String(Math.min(Math.max(pageSize, 1), 50)) })
      // A search looks through all mail, like Gmail's own search box.
      if (folderId && !query) qs.append('labelIds', folderId)
      const q = [query, daysBack ? `newer_than:${Math.round(daysBack)}d` : '', unreadOnly ? 'is:unread' : ''].filter(Boolean).join(' ')
      if (q) qs.set('q', q)
      if (pageToken) qs.set('pageToken', String(pageToken))
      const list = await call(`/threads?${qs}`)
      const meta = new URLSearchParams({ format: 'metadata' })
      for (const h of ['From', 'Subject', 'Date']) meta.append('metadataHeaders', h)
      const threads = await mapLimit(list.threads ?? [], 8, (t) => call(`/threads/${encodeURIComponent(t.id)}?${meta}`))
      return { threads: threads.map(summarize), nextPageToken: list.nextPageToken ?? null, estimate: list.resultSizeEstimate ?? 0 }
    },

    async getThread(id) {
      const t = await call(`/threads/${encodeURIComponent(id)}?format=full`)
      const messages = (t.messages ?? []).map(normalizeMessage)
      return { id: t.id, subject: messages[0]?.subject || '(no subject)', labelIds: [...new Set(messages.flatMap((m) => m.labelIds))], messages }
    },

    async modifyThread(id, { add = [], remove = [] } = {}) {
      const ok = (l) => typeof l === 'string' && (SETTABLE_SYSTEM.has(l) || l.startsWith('Label_'))
      const t = await post(`/threads/${encodeURIComponent(id)}/modify`, { addLabelIds: add.filter(ok), removeLabelIds: remove.filter(ok) })
      return { id, labelIds: [...new Set((t.messages ?? []).flatMap((m) => m.labelIds ?? []))] }
    },

    archive(id) {
      return post(`/threads/${encodeURIComponent(id)}/modify`, { removeLabelIds: ['INBOX'] }).then(() => ({ id }))
    },

    markRead(id, read = true) {
      return post(`/threads/${encodeURIComponent(id)}/modify`, read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] }).then(() => ({ id }))
    },

    async createFolder(name) {
      const n = String(name ?? '').trim()
      if (!n) throw new Error('Give the label a name.')
      const l = await post('/labels', { name: n, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
      return { id: l.id, name: l.name, kind: 'user' }
    },

    async send(draft) {
      const profile = await call('/profile')
      const message = { ...draft, from: profile.emailAddress }
      let threadId
      if (draft.replyTo?.messageId) {
        // Threading headers come from the original message, not the page.
        const meta = new URLSearchParams({ format: 'metadata' })
        for (const hn of ['Message-ID', 'References']) meta.append('metadataHeaders', hn)
        const orig = await call(`/messages/${encodeURIComponent(draft.replyTo.messageId)}?${meta}`)
        const msgId = mime.header(orig.payload?.headers, 'Message-ID')
        const refs = mime.header(orig.payload?.headers, 'References')
        if (msgId) {
          message.inReplyTo = msgId
          message.references = [refs, msgId].filter(Boolean).join(' ')
        }
        threadId = orig.threadId
      }
      const raw = base64url(Buffer.from(mime.buildMessage(message, { messageIdDomain: String(profile.emailAddress).split('@')[1] }), 'utf8'))
      const sent = await post('/messages/send', threadId ? { raw, threadId } : { raw })
      return { id: sent.id, threadId: sent.threadId }
    },
  }
}

function hasAttachment(part) {
  if (!part) return false
  if (part.filename && part.body?.attachmentId) return true
  return (part.parts ?? []).some(hasAttachment)
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

module.exports = {
  kind: 'gmail',
  label: 'Google (Gmail)',
  description: 'Sign in with Google. Uses your own Google Cloud OAuth client (Desktop app type).',
  setup: 'oauth',
  capabilities: { labels: true, folderTree: false, fullStoreSearch: false, queryHint: 'Search mail (from:, subject:, has:attachment …)', attachmentsHint: 'Open the message in Gmail to download attachments' },
  configFields: [
    { key: 'clientId', label: 'OAuth client ID', placeholder: '1234567890-abc.apps.googleusercontent.com', help: 'From Google Cloud Console > Google Auth Platform > Clients.' },
    { key: 'clientSecret', label: 'Client secret', secret: true, placeholder: 'GOCSPX-…', help: 'Shown next to the client ID. Stored encrypted on this PC.' },
  ],
  signIn,
  signOut,
  createSession,
  // For tests.
  _internal: { mapLimit, decodeEntities, SCOPES },
}
