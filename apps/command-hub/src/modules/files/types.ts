/** Shapes returned by electron/modules/files.cjs. */

export type EntryKind = 'dir' | 'file' | 'other'

export interface FileEntry {
  name: string
  path: string
  ext: string
  kind: EntryKind
  size: number
  modified: number
  created: number
  hidden: boolean
  link?: boolean
  locked?: boolean
}

export interface GitInfo {
  root: string
  branch: string
  detached: boolean
}

export interface Listing {
  path: string
  name: string
  parent: string | null
  entries: FileEntry[]
  hiddenCount: number
  truncated: boolean
  git: GitInfo | null
}

export interface Place {
  id: string
  label: string
  path: string
}

export interface Drive {
  path: string
  label: string
  total: number
  free: number
}

export interface Places {
  home: string
  sep: string
  places: Place[]
  drives: Drive[]
}

interface PreviewBase {
  path: string
  name: string
  size: number
  modified: number
  created: number
  accessed: number
}

export type Preview =
  | (PreviewBase & { kind: 'dir'; items: number | null; folders: number; git: GitInfo | null })
  | (PreviewBase & { kind: 'image'; ext: string; dataUrl?: string; tooBig?: boolean })
  | (PreviewBase & { kind: 'text'; ext: string; text: string; truncated: boolean; lines: number })
  | (PreviewBase & { kind: 'binary'; ext: string })

export interface SearchResult {
  results: FileEntry[]
  truncated: boolean
  visited: number
  ms: number
}

export interface FolderSize {
  path: string
  bytes: number
  files: number
  dirs: number
  truncated: boolean
  ms: number
}

export interface BatchResult {
  done: string[]
  failed: { name: string; error: string }[]
}

export type ViewMode = 'details' | 'grid' | 'columns'
export type SortKey = 'name' | 'modified' | 'size' | 'type'
export interface Sort {
  key: SortKey
  dir: 'asc' | 'desc'
}

export type TagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'
