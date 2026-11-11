// Inbox connectors: the pluggable half of the Email app.
//
// The Email app's backend (../index.cjs) knows nothing about any mail
// provider. Each provider is a connector module with this shape:
//
//   {
//     kind: 'gmail',                  // stable id, stored with each account
//     label: 'Google (Gmail)',        // shown on the "Add an inbox" screen
//     description: '...',
//     setup: 'oauth' | 'discover',    // how accounts are added (see below)
//     // What the page may adapt to: labels (Gmail) or a folder tree
//     // (Outlook), opt-in search of every folder, hints for the search box
//     // and for attachments.
//     capabilities: { labels, folderTree, fullStoreSearch, queryHint, attachmentsHint },
//     // What the setup screen asks for before sign-in (e.g. an OAuth client).
//     // Fields marked secret are encrypted with safeStorage and never sent
//     // back to the page; the page only learns whether they are set.
//     configFields: [{ key, label, secret?, optional?, placeholder?, help? }],
//     // setup 'oauth': interactive sign-in. Returns the account and the
//     // credentials to keep (encrypted on disk by the backend, opaque to it).
//     // account.key identifies the account (Gmail: the lowercased address).
//     signIn(env, config, { signal }) -> { account: { key, address, name }, credentials, accessToken? },
//     // setup 'discover': no sign-in. List what can be added (Outlook: the
//     // stores the running Outlook has open), then turn picked ones into
//     // accounts. Accounts added this way have no credentials.
//     discover(env, config) -> { status: 'ok' | 'not-running' | 'unavailable', message?, stores: [{ key, name, address, kindLabel, shared }] },
//     accountFromStore(store, { readOnly }) -> { key, name, address, readOnly, detail },
//     // signal aborts when the user cancels; stop waiting and reject.
//     // Best effort: revoke credentials on disconnect.
//     signOut?(env, { config, credentials }),
//     // A live session for one account. onCredentials(next) persists rotated
//     // credentials (e.g. a new refresh token).
//     createSession(env, { config, account, credentials, onCredentials }) -> Session,
//   }
//
//   Session {
//     capabilities: { labels: boolean, multipleLabels: boolean, search: boolean },
//     listFolders() -> [{ id, name, kind: 'system' | 'user', unread?, role?, parentId?, depth? }]
//                   or { folders: [...], timedOut }
//         role is one of inbox | starred | important | sent | drafts | spam | trash
//         for system folders, so the UI can order and icon them. parentId
//         makes a tree (Outlook); the five standard folders use the ids
//         INBOX, DRAFT, SENT, SPAM, TRASH whatever the provider.
//     listThreads({ folderId?, query?, pageToken?, pageSize?, daysBack?, unreadOnly?, allFolders? })
//         -> { threads: ThreadSummary[], nextPageToken?, estimate?, timedOut?, partial? }
//         allFolders is the opt-in full-store search; a connector that has
//         to stop early returns what it found with timedOut and a message.
//     getThread(id) -> { id, subject, labelIds, messages: Message[], moved? }
//         The returned id may differ from the one asked for when the mail
//         moved and was found again (Outlook); use it from then on.
//     modifyThread(id, { add: [], remove: [] }) -> { id, labelIds }
//     archive(id), markRead(id, read) -> { id }
//     createFolder(name) -> folder
//     send(draft) -> { id, threadId }
//         draft: { to, cc, bcc, subject, body, replyTo?: { threadId, messageId } }
//   }
//
// Read-only accounts (shared Outlook stores start that way): the backend
// refuses every write method (WRITE_METHODS) before it reaches the session.
//
// env is { fetch, openExternal, log, powershell }. powershell(script, args,
// { timeoutMs }) runs a hidden Windows PowerShell helper (../helper.cjs).
// Connectors must not write files themselves (reading their own bundled
// helper script is fine); everything persistent goes through the backend,
// which keeps it in %APPDATA%\MonoRail\apps\email.
//
// Gmail (OAuth) and Outlook (the running classic Outlook over COM) so far.

const connectors = [require('./gmail.cjs'), require('./outlook.cjs')]

/** Session methods that change mail; refused for read-only accounts. */
const WRITE_METHODS = new Set(['modifyThread', 'archive', 'markRead', 'createFolder', 'send'])

function assertWritable(account, method) {
  if (WRITE_METHODS.has(method) && account?.readOnly) {
    const e = new Error(`${account.name || account.address || 'This inbox'} is read-only in MonoRail. Turn that off under Manage inboxes to change mail here.`)
    e.code = 'read-only'
    throw e
  }
}

const byKind = new Map(connectors.map((c) => [c.kind, c]))

function getConnector(kind) {
  const c = byKind.get(kind)
  if (!c) throw new Error(`Unknown inbox connector: ${kind}`)
  return c
}

/** What the page may know about each connector (no functions). */
function describeConnectors() {
  return connectors.map((c) => ({
    kind: c.kind,
    label: c.label,
    description: c.description,
    setup: c.setup ?? 'oauth',
    capabilities: c.capabilities ?? {},
    configFields: c.configFields.map(({ key, label, secret, optional, placeholder, help }) => ({ key, label, secret: !!secret, optional: !!optional, placeholder, help })),
  }))
}

module.exports = { connectors, getConnector, describeConnectors, assertWritable, WRITE_METHODS }
