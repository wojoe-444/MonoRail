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
  progress?: { percent: number; transferred: number; total: number; bytesPerSecond: number }
  error?: string
  lastChecked?: string
}
