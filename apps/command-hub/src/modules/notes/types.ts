/** One note in the list: the file's id (its name without .md) and what the list shows. */
export interface NoteSummary {
  id: string
  title: string
  excerpt: string
  /** Last change, ms since epoch (the file's own time, so edits made outside MonoRail count). */
  updated: number
  words: number
}

export interface NoteList {
  notes: NoteSummary[]
  /** The repo's folder, as git names it, for "Open in GitHub+". Undefined until the first note. */
  repoPath?: string
  /** Changes written to disk but not committed yet (committed after a minute of quiet or on leaving a note). */
  pending: number
}

export interface Note extends NoteSummary {
  body: string
  created: number
  /** Whether the saved text is committed. */
  committed: boolean
}

export interface NoteVersion {
  oid: string
  message: string
  time: number
}
