// Outlook connector: the classic Outlook for Windows that is already running
// and signed in on this PC, driven over COM by a hidden PowerShell helper
// (outlook.ps1, run through env.powershell = helper.cjs). No OAuth, no app
// registration, no admin consent: if Outlook can open a mailbox, so can this.
//
// - Setup lists the stores Outlook has open (discover) and the user picks.
//   An account is one store, keyed by its StoreID; the display name is
//   required, the address optional (a shared store may have none).
// - Shared stores (another person's or a team mailbox) start read-only:
//   the backend refuses every write call for a read-only account.
// - Folders are a tree with path ids ("Inbox\Reports"); the five standard
//   folders get fixed ids (INBOX, DRAFT, SENT, SPAM, TRASH) so they work in
//   any Outlook language. A per-account skip list (by path) hides subtrees
//   and keeps slow mailboxes from being walked.
// - A message id carries its long EntryID and internet message ID. EntryIDs
//   change when mail moves (e.g. to Archive); the helper then looks the mail
//   up again by internet message ID and the new id is handed back.
// - Lists are deduplicated by internet message ID.
// - Search looks in the open folder; searching every folder of a store is
//   an opt-in with a time limit, because online-only shared mailboxes can
//   take minutes. Hitting the limit returns what was found so far, marked.
// - Outlook not running is its own error code ('not-running'), so the page
//   can say so instead of failing.
// New Outlook (the web-based one) has no COM, so it cannot be used.

const fs = require('node:fs')
const path = require('node:path')

let script = null
const helperScript = () => (script ??= fs.readFileSync(path.join(__dirname, 'outlook.ps1'), 'utf8'))

const TIMEOUTS = {
  discover: 20_000,
  folders: 60_000,
  list: 45_000,
  get: 45_000,
  modify: 45_000,
  createFolder: 20_000,
  send: 45_000,
}
/** How long a full-store search may run before it stops and reports what it found. */
const FULL_STORE_MS = 60_000
/** Looking a moved message up again by internet message ID. */
const LOOKUP_MS = 20_000
const PAGE_SIZE = 25
const MAX_QUERY = 200

// ExchangeStoreType: 0 primary mailbox, 1 delegate/shared mailbox,
// 2 public folders, 3 not Exchange (PST, IMAP...), 4 additional mailbox.
const SHARED_TYPES = new Set([1, 2, 4])
const STORE_KINDS = { 0: 'Mailbox', 1: 'Shared mailbox', 2: 'Public folders', 3: 'Data file', 4: 'Shared mailbox' }

class OutlookError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/** Mail ids: base64url JSON { e: EntryID, m: internet message ID }. */
function encodeId({ entryId, messageId }) {
  return Buffer.from(JSON.stringify({ e: String(entryId ?? ''), m: String(messageId ?? '') }), 'utf8').toString('base64url')
}
function decodeId(id) {
  try {
    const v = JSON.parse(Buffer.from(String(id), 'base64url').toString('utf8'))
    const entryId = typeof v?.e === 'string' && /^[0-9A-Fa-f]{0,1024}$/.test(v.e) ? v.e : ''
    const messageId = typeof v?.m === 'string' && v.m.length <= 1000 ? v.m : ''
    if (!entryId && !messageId) throw new Error('empty')
    return { entryId, messageId }
  } catch {
    throw new OutlookError('bad-request', 'That message id is not valid.')
  }
}

/** DASL filter for a text query (each word must match somewhere) and unread-only. */
function daslFilter({ query, unreadOnly } = {}) {
  const parts = []
  const words = String(query ?? '')
    .slice(0, MAX_QUERY)
    .replace(/[\u0000-\u001f%]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
  const props = ['urn:schemas:httpmail:subject', 'urn:schemas:httpmail:fromname', 'urn:schemas:httpmail:fromemail', 'urn:schemas:httpmail:displayto', 'urn:schemas:httpmail:textdescription']
  for (const w of words) {
    const q = w.replace(/'/g, "''")
    parts.push(`(${props.map((p) => `"${p}" like '%${q}%'`).join(' OR ')})`)
  }
  if (unreadOnly) parts.push('"urn:schemas:httpmail:read" = 0')
  return parts.length ? `@SQL=${parts.join(' AND ')}` : ''
}

/** Keep the first of each internet message ID (falls back to EntryID). */
function dedupe(items) {
  const seen = new Set()
  return items.filter((x) => {
    const key = (x.messageId || x.entryId || '').toLowerCase()
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const nameOf = (from) => {
  const m = /^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/.exec(from ?? '')
  return (m?.[1] || from || '').trim()
}

function labelIdsOf(x) {
  const ids = []
  if (x.folderId) ids.push(x.folderId)
  if (x.unread) ids.push('UNREAD')
  if (x.flagged) ids.push('STARRED')
  return ids
}

function toSummary(x) {
  return {
    id: encodeId(x),
    subject: x.subject || '(no subject)',
    from: x.from ?? '',
    participants: [nameOf(x.from)].filter(Boolean),
    snippet: x.snippet ?? '',
    date: x.date ?? null,
    messageCount: 1,
    unread: !!x.unread,
    starred: !!x.flagged,
    labelIds: labelIdsOf(x),
    hasAttachments: (x.attachments ?? 0) > 0,
    folder: x.folderPath || undefined,
    dedupeKey: x.messageId || undefined,
  }
}

function toThread(x) {
  const id = encodeId(x)
  const labelIds = labelIdsOf(x)
  return {
    id,
    subject: x.subject || '(no subject)',
    labelIds,
    moved: !!x.moved,
    messages: [
      {
        id,
        threadId: id,
        from: x.from ?? '',
        to: x.to ?? '',
        cc: x.cc ?? '',
        replyTo: '',
        subject: x.subject ?? '',
        date: x.date ?? null,
        snippet: x.snippet ?? '',
        text: x.text ?? '',
        html: x.html ?? '',
        attachments: (x.attachmentList ?? []).map((a) => ({ id: String(a.id), filename: a.filename ?? '', mimeType: '', size: a.size ?? 0 })),
        labelIds,
        unread: !!x.unread,
      },
    ],
  }
}

/** Shapes discovered stores for the setup screen. */
function describeStores(stores) {
  return (stores ?? [])
    .filter((s) => s.storeId)
    .map((s) => ({
      key: s.storeId,
      name: s.name || s.address || 'Outlook store',
      address: s.address || '',
      kindLabel: STORE_KINDS[s.exchangeType] ?? (s.isDataFile ? 'Data file' : 'Store'),
      shared: SHARED_TYPES.has(s.exchangeType),
    }))
}

function createRunner(env) {
  return (op, args, timeoutMs = TIMEOUTS[op]) => {
    if (!env.powershell) return Promise.reject(new OutlookError('unavailable', 'Outlook needs Windows.'))
    return env.powershell(helperScript(), { op, ...args }, { timeoutMs, label: `outlook.${op}` }).catch((e) => {
      if (e.code === 'timeout') throw new OutlookError('timeout', `Outlook did not answer in time (${Math.round(timeoutMs / 1000)} s). Online-only shared mailboxes can be slow: try again, or narrow it down.`)
      if (e.code === 'unavailable') throw new OutlookError('unavailable', 'Outlook needs Windows with classic Outlook installed.')
      throw new OutlookError(e.code || 'outlook', e.message)
    })
  }
}

async function discover(env) {
  try {
    const r = await createRunner(env)('discover', {})
    return { status: 'ok', stores: describeStores(r.stores) }
  } catch (e) {
    if (e.code === 'not-running' || e.code === 'unavailable') return { status: e.code, message: e.message, stores: [] }
    throw e
  }
}

/** Account record for a discovered store. */
function accountFromStore(store, { readOnly } = {}) {
  return {
    key: store.key,
    name: store.name,
    address: store.address || '',
    readOnly: readOnly ?? store.shared,
    detail: store.kindLabel,
  }
}

function createSession(env, { account }) {
  const run = createRunner(env)
  const storeId = account.key
  const skip = () => (Array.isArray(account.settings?.skipFolders) ? account.settings.skipFolders : [])
  const base = () => ({ storeId, skip: skip(), lookupMs: LOOKUP_MS })

  return {
    capabilities: { labels: false, multipleLabels: false, search: true, folderTree: true, fullStoreSearch: true, daysBack: true, unreadFilter: true },

    async listFolders() {
      const r = await run('folders', { ...base(), deadlineMs: TIMEOUTS.folders - 10_000 })
      return {
        folders: (r.folders ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          path: f.path,
          parentId: f.parentId ?? null,
          depth: f.depth ?? 0,
          kind: f.role ? 'system' : 'user',
          role: f.role ?? undefined,
          unread: typeof f.unread === 'number' ? f.unread : undefined,
        })),
        timedOut: !!r.timedOut,
      }
    },

    async listThreads({ folderId, query, pageToken, pageSize = PAGE_SIZE, daysBack, unreadOnly, allFolders } = {}) {
      const offset = Math.max(0, Number.parseInt(pageToken ?? '0', 10) || 0)
      const limit = Math.min(Math.max(pageSize, 1), 50)
      const filter = daslFilter({ query, unreadOnly })
      const full = !!allFolders && !!query
      const timeoutMs = full ? FULL_STORE_MS + 15_000 : TIMEOUTS.list
      const r = await run(
        'list',
        { ...base(), folderId: folderId || 'INBOX', filter, daysBack: daysBack || 0, offset: full ? 0 : offset, limit, allFolders: full, deadlineMs: full ? FULL_STORE_MS : TIMEOUTS.list - 10_000 },
        timeoutMs,
      )
      let items = dedupe(r.items ?? [])
      if (full) items = items.sort((a, b) => Date.parse(b.date ?? 0) - Date.parse(a.date ?? 0)).slice(0, limit)
      return {
        threads: items.map(toSummary),
        nextPageToken: r.more ? String(offset + limit) : null,
        estimate: items.length,
        timedOut: !!r.timedOut,
        partial: r.timedOut ? (full ? `Stopped after ${FULL_STORE_MS / 1000} s, ${r.foldersSearched ?? 0} of ${r.foldersTotal ?? '?'} folders searched. Showing what was found.` : 'Outlook was slow, so this list stopped early.') : undefined,
      }
    },

    async getThread(id) {
      return toThread(await run('get', { ...base(), ...decodeId(id) }))
    },

    async modifyThread(id, { add = [], remove = [] } = {}) {
      let cur = id
      let last = null
      const change = async (action, value, to) => {
        last = await run('modify', { ...base(), ...decodeId(cur), action, value, to })
        cur = encodeId(last)
      }
      if (add.includes('STARRED')) await change('flag', true)
      if (remove.includes('STARRED')) await change('flag', false)
      if (add.includes('INBOX')) await change('move', null, 'INBOX')
      return { id: cur, labelIds: last ? labelIdsOf(last) : [] }
    },

    async archive(id) {
      const r = await run('modify', { ...base(), ...decodeId(id), action: 'move', to: 'ARCHIVE' })
      return { id: encodeId(r) }
    },

    async markRead(id, read = true) {
      const r = await run('modify', { ...base(), ...decodeId(id), action: 'read', value: !!read })
      return { id: encodeId(r) }
    },

    async createFolder(name) {
      const n = String(name ?? '').trim()
      if (!n) throw new OutlookError('bad-request', 'Give the folder a name.')
      if (/[\\/]/.test(n) || n.length > 200) throw new OutlookError('bad-request', 'Folder names cannot contain \\ or /.')
      const r = await run('createFolder', { ...base(), name: n })
      return { id: r.id, name: r.name, kind: 'user', parentId: null, depth: 0 }
    },

    async send(draft) {
      const reply = draft.replyTo?.messageId ? decodeId(draft.replyTo.messageId) : null
      await run('send', {
        ...base(),
        address: account.address || '',
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject,
        body: draft.body,
        reply,
      })
      return { id: '', threadId: '' }
    },
  }
}

module.exports = {
  kind: 'outlook',
  label: 'Outlook on this PC',
  description: 'Uses the classic Outlook that is open and signed in here. No sign-in, no app registration.',
  setup: 'discover',
  configFields: [],
  capabilities: { labels: false, folderTree: true, fullStoreSearch: true, queryHint: 'Search subject, sender, recipients and text', attachmentsHint: 'Open the message in Outlook to save attachments' },
  discover,
  accountFromStore,
  createSession,
  _internal: { encodeId, decodeId, daslFilter, dedupe, describeStores, toSummary, toThread, FULL_STORE_MS },
}
