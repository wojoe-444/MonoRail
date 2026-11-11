/** Mirrors electron/connections (the page never receives secrets). */

import type { ClaudeAccount } from './account'

export type ConnectionState = 'ok' | 'expired' | 'needs-setup' | 'error' | 'unavailable'

export interface ConnectorField {
  key: string
  label: string
  type: 'text' | 'secret' | 'select'
  options?: { value: string; label: string }[]
  defaultValue?: string
  placeholder?: string
  help?: string
  /** Show only when other fields have these values. */
  showIf?: Record<string, string>
  /** Offer a picker of Windows Credential Manager entries. */
  credentialPicker?: boolean
}

export interface ConnectorAction {
  id: string
  label: string
  description: string
  showWhen: ConnectionState[]
  steps?: number
}

export interface Connector {
  kind: string
  title: string
  description: string
  icon: string
  /** A subconnector: shown nested inside this connector's card (pi > Playwright browser). */
  parent?: string
  fields: ConnectorField[]
  actions: ConnectorAction[]
}

export interface ConnectionStatus {
  state: ConnectionState
  summary: string
  hint?: string
  details: { label: string; value?: string; ok?: boolean }[]
  /** When set, only these actions fit the current state. */
  actions?: string[]
  /** Claude only: how the login is billed. */
  account?: ClaudeAccount
  added: boolean
  checkedAt: string
}

export interface ConnectionJob {
  id: number
  kind: string
  action: string
  state: 'running' | 'done' | 'failed' | 'cancelled'
  step: number
  steps: number
  stepLabel?: string
  /** One line about what to do now, shown instead of the generic sign-in text. */
  note?: string
  url?: string
  output: string
  error?: string
  startedAt: string
  endedAt?: string
}

export interface Connection {
  kind: string
  values: Record<string, string>
  secretsSet: Record<string, boolean>
  addedAt: string
  updatedAt: string
  status?: ConnectionStatus
  job?: ConnectionJob
}

export interface ConnectionsList {
  connectors: Connector[]
  connections: Connection[]
  encryptionAvailable: boolean
  platform: string
}
