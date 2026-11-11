export type UpdateState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

/** Returned by every method of the settings backend (electron/modules/settings.cjs). */
export interface AppStatus {
  currentVersion: string
  electronVersion: string
  dataDir: string
  updatesSupported: boolean
  unsupportedReason?: string
  state: UpdateState
  latestVersion?: string
  releaseDate?: string
  releaseNotes?: string
  /** Every release between the installed and the latest version, newest first. */
  changes?: ReleaseChanges[]
  progress?: { percent: number; transferred: number; total: number; bytesPerSecond: number }
  error?: string
  lastChecked?: string
}

/** One release's "What's new" notes (electron/release-notes.cjs). Old releases have no items. */
export interface ReleaseChanges {
  version: string
  date?: string
  items: { title: string; text: string; pr?: number }[]
}

export type BackupUnit = 'hour' | 'day' | 'week'

/** The global backup folder (electron/backups/global.cjs). */
export interface GlobalBackupSettings {
  enabled: boolean
  folder: string
  times: number
  unit: BackupUnit
  keep: number
  /** Pages the global schedule backs up itself. */
  items: { 'jira-plus': boolean; flashcards: boolean }
}

export type BackupResult =
  | { ok: true; at: string; file?: string; size?: number; skipped?: boolean }
  | { ok: false; at: string; error: string }

export interface BackupPageStatus {
  id: 'github-plus' | 'jira-plus' | 'flashcards'
  title: string
  what: string
  /** <folder>/<id> while the global folder is on, else null. */
  folder: string | null
  /** GitHub+: repos whose schedule follows the global folder or frequency. */
  repos?: number
  included?: boolean
  lastResult?: BackupResult | null
  nextDueAt?: string | null
  running?: boolean
  files?: number
}

/** Returned by the backups backend (electron/modules/backups.cjs). */
export interface BackupStatus {
  settings: GlobalBackupSettings
  pages: BackupPageStatus[]
}
