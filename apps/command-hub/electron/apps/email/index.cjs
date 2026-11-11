// Email app backend. Reads and sends mail through pluggable inbox connectors
// (connectors/index.cjs); Gmail with Google sign-in is the first one.
//
// Private data rule: OAuth client settings and each account's refresh token
// live in %APPDATA%\MonoRail\apps\email (ctx.dataDir), encrypted with
// safeStorage. Tokens are never sent to the page. Mail is not cached on disk.
//
// Self-contained on purpose: everything the app needs is in this folder and
// src/apps/email, so it can move into an extension later.

const { safeStorage, shell, net } = require('electron')

const { describeConnectors, getConnector } = require('./connectors/index.cjs')
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
}

const storeFor = (ctx) => createStore(ctx.dataDir, safeStorageCipher(safeStorage))

async function configFor(store, connector) {
  const { values, secrets } = await store.getConfig(connector.kind)
  return { ...values, ...secrets }
}

async function sessionFor(ctx, accountId) {
  if (typeof accountId !== 'string') throw new Error('Pick an inbox first.')
  const live = sessions.get(accountId)
  if (live) return live
  const store = storeFor(ctx)
  const account = (await store.listAccounts()).find((a) => a.id === accountId)
  if (!account) throw new Error('That inbox is no longer connected.')
  const connector = getConnector(account.kind)
  const session = connector.createSession(env, {
    config: await configFor(store, connector),
    account,
    credentials: await store.getCredentials(accountId),
    onCredentials: (next) => store.updateCredentials(accountId, next),
  })
  sessions.set(accountId, session)
  return session
}

/** Run a session call; a sign-in that expired is reported as "[reauth] …" so the page can offer Reconnect. */
async function withSession(ctx, accountId, fn) {
  const session = await sessionFor(ctx, accountId)
  try {
    return await fn(session)
  } catch (e) {
    if (e?.code === 'reauth') {
      needsReauth.add(accountId)
      sessions.delete(accountId)
      throw new Error(`[reauth] ${e.message}`)
    }
    throw e
  }
}

const str = (v) => (typeof v === 'string' ? v : '')
const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

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

    listFolders: (ctx, { accountId } = {}) => withSession(ctx, accountId, (s) => s.listFolders()),
    listThreads: (ctx, { accountId, folderId, query, pageToken } = {}) =>
      withSession(ctx, accountId, (s) => s.listThreads({ folderId: str(folderId) || undefined, query: str(query) || undefined, pageToken: str(pageToken) || undefined })),
    getThread: (ctx, { accountId, threadId } = {}) => withSession(ctx, accountId, (s) => s.getThread(str(threadId))),
    modifyThread: (ctx, { accountId, threadId, add, remove } = {}) =>
      withSession(ctx, accountId, (s) => s.modifyThread(str(threadId), { add: strList(add), remove: strList(remove) })),
    archive: (ctx, { accountId, threadId } = {}) => withSession(ctx, accountId, (s) => s.archive(str(threadId))),
    markRead: (ctx, { accountId, threadId, read } = {}) => withSession(ctx, accountId, (s) => s.markRead(str(threadId), read !== false)),
    createFolder: (ctx, { accountId, name } = {}) => withSession(ctx, accountId, (s) => s.createFolder(str(name))),
    send: (ctx, { accountId, draft } = {}) =>
      withSession(ctx, accountId, (s) =>
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
