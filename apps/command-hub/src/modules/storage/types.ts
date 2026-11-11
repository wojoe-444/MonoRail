export interface Drive {
  id: string
  path: string
  total: number
  free: number
  used: number
  /** The Windows system drive (or "/"). */
  system: boolean
  /** Holds MonoRail's data folder. */
  holdsData: boolean
}

export interface DrivesResult {
  platform: string
  drives: Drive[]
}

export type LocationGroup = 'monorail' | 'agents' | 'dev' | 'system'
/** safe: a cache its tool rebuilds; review: may hold things you want; keep: in use. */
export type Advice = 'safe' | 'review' | 'keep'

export interface StorageLocation {
  id: string
  group: LocationGroup
  label: string
  path: string
  kind?: 'dir' | 'file'
  advice: Advice
  note?: string
  /** A command that clears it with the tool's own cleanup. */
  tip?: string
  exists: boolean
  /** Missing for a system file Windows holds open. */
  bytes?: number
  files?: number
  dirs?: number
  skipped?: number
  /** Stopped at the time limit: the size is a lower bound. */
  truncated?: boolean
  children?: { name: string; bytes: number; kind: 'dir' | 'file' }[]
  childCount?: number
}

export interface ScanState {
  state: 'idle' | 'running' | 'done' | 'error'
  startedAt?: string
  finishedAt?: string
  tookMs?: number
  done?: number
  total?: number
  current?: string[]
  error?: string
  locations?: StorageLocation[]
  /** Read back from history after a restart (not scanned in this session). */
  saved?: boolean
  /** The scan finished but could not be written to history. */
  notSaved?: boolean
  /** Sizes from the scan before this one, for the change column. */
  previous?: { takenAt: string; sizes: Record<string, number> }
}

export interface HistorySnapshot {
  takenAt: string
  /** 'scan': after a folder scan; 'drives': a drive sample taken in the background. */
  kind: 'scan' | 'drives'
  drives: { id: string; total: number; free: number }[]
  locations?: { id: string; label: string; group: LocationGroup; bytes?: number; truncated: boolean }[]
}

export interface StorageHistory {
  sampleEveryMs: number
  snapshots: HistorySnapshot[]
}
