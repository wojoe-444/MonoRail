// Inbox connectors: the pluggable half of the Email app.
//
// The Email app's backend (../index.cjs) knows nothing about any mail
// provider. Each provider is a connector module with this shape:
//
//   {
//     kind: 'gmail',                  // stable id, stored with each account
//     label: 'Google (Gmail)',        // shown on the "Add an inbox" screen
//     description: '...',
//     // What the setup screen asks for before sign-in (e.g. an OAuth client).
//     // Fields marked secret are encrypted with safeStorage and never sent
//     // back to the page; the page only learns whether they are set.
//     configFields: [{ key, label, secret?, optional?, placeholder?, help? }],
//     // Interactive sign-in. Returns the account and the credentials to keep
//     // (encrypted on disk by the backend, opaque to it).
//     signIn(env, config, { signal }) -> { account: { address, name }, credentials, accessToken? },
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
//     listFolders() -> [{ id, name, kind: 'system' | 'user', unread?, role? }]
//         role is one of inbox | starred | important | sent | drafts | spam | trash
//         for system folders, so the UI can order and icon them.
//     listThreads({ folderId?, query?, pageToken?, pageSize? })
//         -> { threads: ThreadSummary[], nextPageToken?, estimate? }
//     getThread(id) -> { id, subject, labelIds, messages: Message[] }
//     modifyThread(id, { add: [], remove: [] }) -> { id, labelIds }
//     archive(id), markRead(id, read)
//     createFolder(name) -> folder
//     send(draft) -> { id, threadId }
//         draft: { to, cc, bcc, subject, body, replyTo?: { threadId, messageId } }
//   }
//
// env is { fetch, openExternal, log }. Connectors must not read or write
// files themselves; everything persistent goes through the backend, which
// keeps it in %APPDATA%\MonoRail\apps\email.
//
// Gmail is the first connector. IMAP (folders instead of labels,
// capabilities.multipleLabels = false) fits the same shape later.

const connectors = [require('./gmail.cjs')]

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
    configFields: c.configFields.map(({ key, label, secret, optional, placeholder, help }) => ({ key, label, secret: !!secret, optional: !!optional, placeholder, help })),
  }))
}

module.exports = { connectors, getConnector, describeConnectors }
