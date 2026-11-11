/** Shapes returned by the Email app's backend (electron/apps/email). */

export interface ConfigField {
  key: string
  label: string
  secret: boolean
  optional: boolean
  placeholder?: string
  help?: string
}

/** What the page adapts to per connector. */
export interface ConnectorCapabilities {
  /** Gmail-style labels (several per thread). Otherwise folders only. */
  labels?: boolean
  /** Folders come as a tree (parentId), e.g. Outlook. */
  folderTree?: boolean
  /** Search can opt in to every folder of a store (slow, time-limited). */
  fullStoreSearch?: boolean
  queryHint?: string
  attachmentsHint?: string
}

export interface ConnectorInfo {
  kind: string
  label: string
  description: string
  /** oauth: sign in in the browser. discover: pick from what is on this PC (Outlook). */
  setup: 'oauth' | 'discover'
  capabilities: ConnectorCapabilities
  configFields: ConfigField[]
  /** Saved setup: non-secret values, and which secrets are set (never their values). */
  config: { values: Record<string, string>; secretsSet: Record<string, boolean> }
}

export interface Account {
  id: string
  kind: string
  /** Gmail: the address. Outlook: the store id. */
  key?: string
  /** May be empty (an Outlook store without an address). */
  address: string
  name: string
  /** e.g. "Shared mailbox". */
  detail?: string
  addedAt: string
  needsReauth?: boolean
  /** Write actions (send, archive, flag, mark read, new folder) are off. */
  readOnly?: boolean
  settings?: { skipFolders?: string[] }
}

/** A store Outlook has open, offered on the setup screen. */
export interface DiscoveredStore {
  key: string
  name: string
  address: string
  kindLabel: string
  shared: boolean
  /** Set when it is already added. */
  accountId: string | null
}

export interface DiscoverResult {
  status: 'ok' | 'not-running' | 'unavailable'
  message?: string
  stores: DiscoveredStore[]
}

export interface EmailState {
  connectors: ConnectorInfo[]
  accounts: Account[]
  encryptionAvailable: boolean
  signingIn: boolean
}

export type FolderRole = 'inbox' | 'starred' | 'important' | 'sent' | 'drafts' | 'spam' | 'trash'

export interface Folder {
  id: string
  name: string
  kind: 'system' | 'user'
  role?: FolderRole
  unread?: number
  color?: string
  /** Folder trees (Outlook): parent folder id, depth and full path. */
  parentId?: string | null
  depth?: number
  path?: string
}

export interface FolderList {
  folders: Folder[]
  /** The walk stopped early (slow mailbox); the list is incomplete. */
  timedOut: boolean
}

export interface ThreadSummary {
  id: string
  subject: string
  from: string
  participants: string[]
  snippet: string
  date: string | null
  messageCount: number
  unread: boolean
  starred: boolean
  labelIds: string[]
  hasAttachments: boolean
  /** Folder path, when a search spans folders (Outlook). */
  folder?: string
  /** Set on results of a search over several accounts. */
  accountId?: string
  /** Other searched accounts that hold the same mail. */
  alsoIn?: string[]
}

export interface ThreadPage {
  threads: ThreadSummary[]
  nextPageToken: string | null
  estimate: number
  timedOut?: boolean
  /** Why the list may be incomplete (e.g. a full-store search hit its time limit). */
  partial?: string
}

export interface SearchResult {
  threads: ThreadSummary[]
  truncated: boolean
  errors: { accountId: string; error: string }[]
  partial: { accountId: string; message: string }[]
}

export interface ListOptions {
  folderId?: string
  query?: string
  pageToken?: string
  daysBack?: number
  unreadOnly?: boolean
  allFolders?: boolean
}

export interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
}

export interface Message {
  id: string
  threadId: string
  from: string
  to: string
  cc: string
  replyTo: string
  subject: string
  date: string | null
  snippet: string
  text: string
  html: string
  attachments: Attachment[]
  labelIds: string[]
  unread: boolean
}

export interface Thread {
  id: string
  subject: string
  labelIds: string[]
  messages: Message[]
  /** The mail had moved and was found again; id is its new id. */
  moved?: boolean
}

export interface Draft {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  /** Set when replying: the message being answered. The backend adds the threading headers. */
  replyTo?: { messageId: string }
}
