export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'backing-up'
  | 'backup-failed'
  | 'error'

/** Whether an update backs up first: 'no-folder' when the global backup folder is off. */
export type BackupBeforeUpdateMode = 'on' | 'off' | 'no-folder'

/** The "back up before updating" result (runBeforeUpdate in electron/backups/service.cjs). */
export interface BeforeUpdateResult {
  ok: boolean
  skipped?: 'no-folder' | 'off'
  at: string
  folder?: string
  error?: string
  items: { id: GlobalItem; title: string; ok: boolean; file?: string; size?: number; skipped?: boolean; error?: string }[]
}

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
  /** Whether installing backs up first (Settings > Backups). Missing on older backends. */
  backupBeforeUpdate?: BackupBeforeUpdateMode
  /** The last before-update backup of this run. */
  backup?: BeforeUpdateResult
}

/** One release's "What's new" notes (electron/release-notes.cjs). Old releases have no items. */
export interface ReleaseChanges {
  version: string
  date?: string
  items: { title: string; text: string; pr?: number }[]
}

export type BackupUnit = 'hour' | 'day' | 'week'

/** Pages the global schedule backs up itself (GLOBAL_ITEMS in electron/backups/global.cjs). */
export type GlobalItem = 'jira-plus' | 'flashcards' | 'notes' | 'flows'

/** The global backup folder (electron/backups/global.cjs). */
export interface GlobalBackupSettings {
  enabled: boolean
  folder: string
  times: number
  unit: BackupUnit
  keep: number
  /** Pages the global schedule backs up itself. */
  items: Record<GlobalItem, boolean>
  /** Back up everything into <folder>/before-update before an update installs. On by default. */
  beforeUpdate: boolean
}

export type BackupResult =
  | { ok: true; at: string; file?: string; size?: number; skipped?: boolean }
  | { ok: false; at: string; error: string }

export interface BackupPageStatus {
  id: 'github-plus' | GlobalItem
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
  /** The last backup made before an update, if any. */
  lastBeforeUpdate?: BeforeUpdateResult | null
}

export interface ProfileInfo {
  id: string
  name: string
  createdAt: string | null
  active: boolean
  isDefault: boolean
  /** Not listed outside Developer Mode (the New User test profile). */
  hidden?: boolean
  /** Wiped to a blank slate each time it is switched to. */
  blank?: boolean
  /** The profile's data root. The default profile's is the data folder itself. */
  dataDir: string
}

export interface ProfilesView {
  activeId: string
  /** The profile the next start opens, when a switch waits for a restart. */
  nextId?: string | null
  /** Where Developer Mode's New User profile switches back to. */
  previousId?: string | null
  /** profiles.json exists but cannot be read; MonoRail will not overwrite it. */
  damaged: boolean
  profiles: ProfileInfo[]
  machineDir: string
  scopes: { profile: string[]; machine: string[] }
}
