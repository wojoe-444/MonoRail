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
  contributes: { modules: ModuleContribution[]; apps: AppContribution[] }
  backend?: { activation: 'onDemand' | 'startup'; state: 'running' | 'starting' | 'stopped' | 'crashed'; error?: string }
  update?: { version: string; notes?: string; publishedAt?: string }
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
  contributes: { modules: ModuleContribution[]; apps: AppContribution[] }
  hasBackend: boolean
}

export interface LogLine {
  at: string
  level: 'info' | 'warn' | 'error'
  line: string
}
