/** Shapes returned by the Email app's backend (electron/apps/email). */

export interface ConfigField {
  key: string
  label: string
  secret: boolean
  optional: boolean
  placeholder?: string
  help?: string
}

export interface ConnectorInfo {
  kind: string
  label: string
  description: string
  configFields: ConfigField[]
  /** Saved setup: non-secret values, and which secrets are set (never their values). */
  config: { values: Record<string, string>; secretsSet: Record<string, boolean> }
}

export interface Account {
  id: string
  kind: string
  address: string
  name: string
  addedAt: string
  needsReauth?: boolean
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
}

export interface ThreadPage {
  threads: ThreadSummary[]
  nextPageToken: string | null
  estimate: number
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
