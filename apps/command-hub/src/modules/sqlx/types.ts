/** A Dataform project folder the user picked (never its path). */
export interface SqlxProject {
  id: string
  name: string
  /** The folder has workflow_settings.yaml, dataform.json or definitions/. */
  dataform: boolean
  /** Dataform core 3 keeps BigQuery options at the top of a config, 2 under `bigquery`. */
  core: 2 | 3 | null
}

export interface SqlxFileEntry {
  /** Relative to the project folder, forward slashes. */
  path: string
  size: number
  mtimeMs: number
}

export interface SqlxFileList {
  files: SqlxFileEntry[]
  truncated: boolean
}

export interface SqlxFileContent {
  path: string
  text: string
  mtimeMs: number
}

export interface SqlxSaved {
  path: string
  mtimeMs: number
}
