// Email app backend. Reads and sends mail through pluggable inbox connectors
// (connectors/index.cjs): Gmail with Google sign-in, and Outlook through the
// classic Outlook already running on this PC (no sign-in).
//
// Private data rule: OAuth client settings and each account's refresh token
// live in %APPDATA%\MonoRail\apps\email (ctx.dataDir), encrypted with
// safeStorage. Tokens are never sent to the page. Mail is not cached on disk.
//
// Self-contained on purpose: everything the app needs is in this folder and
// src/apps/email, so it can move into an extension later.

const { safeStorage, shell, net } = require('electron')

const { assertWritable, describeConnectors, getConnector } = require('./connectors/index.cjs')
const { runPowerShell } = require('./helper.cjs')
const { mergeSearch } = require('./search.cjs')
const { createStore, safeStorageCipher } = require('./store.cjs')

/** accountId -> live connector session. */
const sessions = new Map()
/** accountIds whose sign-in expired this run. */
const needsReauth = new Set()
/** The sign-in in progress, so it can be cancelled from the page. */
let pendingSignIn = null

const env = {
  fetch: (...a) => (net?.fetch ? net.fetch(...a) : fetch(...a)),
  openExternal: (url) => shell.openExternal(url),
  log: (...a) => console.log('[email]', ...a),
  powershell: (script, args, opts = {}) => runPowerShell(script, args, { ...opts, log: (...a) => console.log('[email]', ...a) }),
}

/** Error codes the page acts on; sent as "[code] message" because IPC drops error fields. */
const PAGE_CODES = new Set(['reauth', 'not-running', 'unavailable', 'timeout', 'read-only', 'store-missing', 'not-found'])

const storeFor = (ctx) => createStore(ctx.dataDir, safeStorageCipher(safeStorage))

async function configFor(store, connector) {
  const { values, secrets } = await store.getConfig(connector.kind)
  return { ...values, ...secrets }
}

async function accountFor(store, accountId) {
  if (typeof accountId !== 'string') throw new Error('Pick an inbox first.')
  const account = (await store.listAccounts()).find((a) => a.id === accountId)
  if (!account) throw new Error('That inbox is no longer connected.')
  return account
}

async function sessionFor(ctx, account) {
  const live = sessions.get(account.id)
  if (live) return live
  const store = storeFor(ctx)
  const connector = getConnector(account.kind)
  const session = connector.createSession(env, {
    config: await configFor(store, connector),
    account,
    credentials: await store.getCredentials(account.id),
    onCredentials: (next) => store.updateCredentials(account.id, next),
  })
  sessions.set(account.id, session)
  return session
}

/**
 * Run a session call. Write methods are refused for read-only accounts. Error
 * codes the page acts on (sign-in expired, Outlook not running, timeout...)
 * are sent as "[code] message".
 */
async function withSession(ctx, accountId, method, fn) {
  const account = await accountFor(storeFor(ctx), accountId)
  try {
    assertWritable(account, method)
    const session = await sessionFor(ctx, account)
    return await fn(session, account)
  } catch (e) {
    if (e?.code === 'reauth') {
      needsReauth.add(accountId)
      sessions.delete(accountId)
    }
    if (PAGE_CODES.has(e?.code)) throw new Error(`[${e.code}] ${e.message}`)
    throw e
  }
}

const str = (v) => (typeof v === 'string' ? v : '')
const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
const daysOf = (v) => (Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 3650) : 0)
const listOpts = (a) => ({
  folderId: str(a.folderId) || undefined,
  query: str(a.query).slice(0, 500) || undefined,
  pageToken: str(a.pageToken) || undefined,
  daysBack: daysOf(a.daysBack),
  unreadOnly: a.unreadOnly === true,
  allFolders: a.allFolders === true,
})

module.exports = {
  id: 'email',
  methods: {
    /** Connectors (with setup status) and connected accounts. Never includes secrets. */
    async getState(ctx) {
      const store = storeFor(ctx)
      const connectors = await Promise.all(describeConnectors().map(async (c) => ({ ...c, config: await store.describeConfig(c.kind) })))
      const accounts = (await store.listAccounts()).map((a) => ({ ...a, needsReauth: needsReauth.has(a.id) }))
      return { connectors, accounts, encryptionAvailable: safeStorage.isEncryptionAvailable(), signingIn: !!pendingSignIn }
    },

    async saveConnectorConfig(ctx, { kind, values, clearSecrets } = {}) {
      const connector = getConnector(kind)
      await storeFor(ctx).saveConfig(connector.kind, connector.configFields, { values: values ?? {}, clearSecrets: strList(clearSecrets) })
      // Sessions hold the old client settings.
      sessions.clear()
      return module.exports.methods.getState(ctx)
    },

    /** Opens the provider's sign-in page in the browser and waits for it to come back. */
    async signIn(ctx, { kind } = {}) {
      if (pendingSignIn) throw new Error('A sign-in is already open in your browser. Finish or cancel it first.')
      const connector = getConnector(kind)
      const store = storeFor(ctx)
      const controller = new AbortController()
      pendingSignIn = controller
      try {
        const result = await connector.signIn(env, await configFor(store, connector), { signal: controller.signal })
        const account = await store.upsertAccount({ kind: connector.kind, ...result.account }, result.credentials)
        needsReauth.delete(account.id)
        sessions.set(
          account.id,
          connector.createSession(env, {
            config: await configFor(store, connector),
            account,
            credentials: result.credentials,
            accessToken: result.accessToken,
            onCredentials: (next) => store.updateCredentials(account.id, next),
          }),
        )
        return account
      } finally {
        pendingSignIn = null
      }
    },

    /** Stop waiting for the browser (the loopback listener closes). */
    async cancelSignIn() {
      pendingSignIn?.abort()
      return true
    },

    async removeAccount(ctx, { accountId } = {}) {
      const store = storeFor(ctx)
      const account = (await store.listAccounts()).find((a) => a.id === accountId)
      if (!account) return module.exports.methods.getState(ctx)
      const connector = getConnector(account.kind)
      try {
        await connector.signOut?.(env, { config: await configFor(store, connector), credentials: await store.getCredentials(accountId) })
      } catch {
        /* revoking is best effort */
      }
      sessions.delete(accountId)
      needsReauth.delete(accountId)
      await store.removeAccount(accountId)
      return module.exports.methods.getState(ctx)
    },

    /**
     * setup 'discover' connectors (Outlook): what can be added right now.
     * Stores already added are marked.
     */
    async discover(ctx, { kind } = {}) {
      const connector = getConnector(kind)
      if (connector.setup !== 'discover') throw new Error('This connector signs in instead.')
      const store = storeFor(ctx)
      const r = await connector.discover(env, await configFor(store, connector))
      const added = new Map((await store.listAccounts()).filter((a) => a.kind === kind).map((a) => [a.key, a.id]))
      return { ...r, stores: r.stores.map((s) => ({ ...s, accountId: added.get(s.key) ?? null })) }
    },

    /**
     * Add picked stores. The list is discovered again here and only keys it
     * contains are added, so names and kinds come from Outlook, not the page.
     */
    async addStores(ctx, { kind, picks } = {}) {
      const connector = getConnector(kind)
      if (connector.setup !== 'discover') throw new Error('This connector signs in instead.')
      const store = storeFor(ctx)
      const r = await connector.discover(env, await configFor(store, connector))
      if (r.status !== 'ok') throw new Error(r.message || 'Outlook is not available.')
      const byKey = new Map(r.stores.map((s) => [s.key, s]))
      const added = []
      for (const p of Array.isArray(picks) ? picks.slice(0, 50) : []) {
        const s = byKey.get(str(p?.key))
        if (!s) continue
        const fields = connector.accountFromStore(s, { readOnly: typeof p.readOnly === 'boolean' ? p.readOnly : undefined })
        added.push(await store.upsertAccount({ kind, ...fields }, null))
      }
      for (const a of added) sessions.delete(a.id)
      return { added, state: await module.exports.methods.getState(ctx) }
    },

    /** Read-only and the folder skip list, per account. */
    async updateAccount(ctx, { accountId, readOnly, skipFolders } = {}) {
      await storeFor(ctx).updateAccount(str(accountId), {
        readOnly: typeof readOnly === 'boolean' ? readOnly : undefined,
        skipFolders: Array.isArray(skipFolders) ? strList(skipFolders) : undefined,
      })
      // Sessions hold the account as it was.
      sessions.delete(accountId)
      return module.exports.methods.getState(ctx)
    },

    listFolders: (ctx, { accountId } = {}) =>
      withSession(ctx, accountId, 'listFolders', async (s) => {
        const r = await s.listFolders()
        return Array.isArray(r) ? { folders: r, timedOut: false } : r
      }),
    listThreads: (ctx, args = {}) => withSession(ctx, args.accountId, 'listThreads', (s) => s.listThreads(listOpts(args))),

    /**
     * One search across several accounts: each account is searched in
     * parallel, results are merged newest first and deduplicated by
     * internet message ID. An account that fails or times out does not
     * stop the others; it is reported in `errors`.
     */
    async searchAccounts(ctx, args = {}) {
      const ids = [...new Set(strList(args.accountIds))].slice(0, 20)
      if (!ids.length) throw new Error('Pick at least one inbox to search.')
      const opts = listOpts(args)
      const results = await Promise.all(
        ids.map((accountId) =>
          withSession(ctx, accountId, 'listThreads', (s) => s.listThreads({ ...opts, pageToken: undefined, folderId: opts.allFolders ? undefined : 'INBOX' })).then(
            (page) => ({ accountId, page }),
            (e) => ({ accountId, error: String(e?.message ?? e) }),
          ),
        ),
      )
      return mergeSearch(results)
    },

    getThread: (ctx, { accountId, threadId } = {}) => withSession(ctx, accountId, 'getThread', (s) => s.getThread(str(threadId))),
    modifyThread: (ctx, { accountId, threadId, add, remove } = {}) =>
      withSession(ctx, accountId, 'modifyThread', (s) => s.modifyThread(str(threadId), { add: strList(add), remove: strList(remove) })),
    archive: (ctx, { accountId, threadId } = {}) => withSession(ctx, accountId, 'archive', (s) => s.archive(str(threadId))),
    markRead: (ctx, { accountId, threadId, read } = {}) => withSession(ctx, accountId, 'markRead', (s) => s.markRead(str(threadId), read !== false)),
    createFolder: (ctx, { accountId, name } = {}) => withSession(ctx, accountId, 'createFolder', (s) => s.createFolder(str(name))),
    send: (ctx, { accountId, draft } = {}) =>
      withSession(ctx, accountId, 'send', (s) =>
        s.send({
          to: str(draft?.to),
          cc: str(draft?.cc),
          bcc: str(draft?.bcc),
          subject: str(draft?.subject),
          body: str(draft?.body),
          replyTo: draft?.replyTo?.messageId ? { messageId: str(draft.replyTo.messageId) } : undefined,
        }),
      ),
  },
}
