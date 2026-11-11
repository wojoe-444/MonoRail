/**
 * Shapes returned by the "extensions" backend (electron/extensions). Kept in
 * one place so the Extensions page, the nav and the frame host agree.
 */

export type ExtensionStatus = 'active' | 'disabled' | 'needs-approval' | 'incompatible' | 'broken'

export interface PermissionLine {
  key: string
  kind: 'network' | 'process' | 'filesystem'
  risk: 'low' | 'medium' | 'high'
  label: string
}

export interface ModuleContribution {
  id: string
  title: string
  description: string
  entry: string
  icon?: string
  nav: { section: string; order: number }
}

export interface AppContribution {
  id: string
  title: string
  description: string
  entry: string
  icon?: string
}

export type ExtensionSource =
  | { type: 'github'; repo: string; tag?: string }
  | { type: 'zip'; path: string }
  | { type: 'folder'; path: string }
  | { type: 'dev'; path: string }

export interface ExtensionSummary {
  id: string
  name: string
  version: string
  description: string
  publisher: string
  repository?: string
  apiRange?: string
  hasIcon: boolean
  source: ExtensionSource
  enabled: boolean
  status: ExtensionStatus
  error?: string
  installedAt?: string
  updatedAt?: string
  /** Bumped on reload/update so open frames reload. */
  revision: number
  permissions: PermissionLine[]
  newPermissions: PermissionLine[]
  canPickFolders: boolean
  folders: { path: string; write: boolean }[]
  contributes: { modules: ModuleContribution[]; apps: AppContribution[]; mcpTools?: McpToolContribution[] }
  backend?: { activation: 'onDemand' | 'startup'; state: 'running' | 'starting' | 'stopped' | 'crashed'; error?: string }
  update?: { version: string; notes?: string; publishedAt?: string }
  /** Fields declared under "settings" in monorail.json. */
  settings: SettingField[]
  /** Titles of required settings that have no value yet. */
  settingsMissing: string[]
  dataDir: string
  extensionDir: string
}

export interface ExtensionList {
  apiVersion: string
  extensions: ExtensionSummary[]
}

/** What an install would do, shown in the consent dialog before anything is installed. */
export interface InstallPreview {
  token: string
  id: string
  name: string
  version: string
  description: string
  publisher: string
  repository?: string
  source: ExtensionSource
  compatible: boolean
  apiRange: string
  apiVersion: string
  installedVersion?: string
  downgrade: boolean
  permissions: PermissionLine[]
  newPermissions: PermissionLine[]
  contributes: { modules: ModuleContribution[]; apps: AppContribution[]; mcpTools?: McpToolContribution[] }
  hasBackend: boolean
}

export interface LogLine {
  at: string
  level: 'info' | 'warn' | 'error'
  line: string
}

/** One field of an extension's settings form (electron/extensions/manifest.cjs normalizeSettings). */
export interface SettingField {
  key: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'secret'
  title: string
  description: string
  required?: boolean
  placeholder?: string
  maxLength?: number
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string }[]
  default?: string | number | boolean
}

export interface SettingsSnapshot {
  fields: SettingField[]
  values: Record<string, string | number | boolean | null>
  /** Per secret field: whether one is saved. */
  secrets: Record<string, boolean>
}

/** A tool the extension offers to agents through MonoRail's MCP server (API 1.2). */
export interface McpToolContribution {
  name: string
  title: string
  description: string
  method: string
  write: boolean
}
