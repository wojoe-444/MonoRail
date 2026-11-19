/** What the Semantic backend's malloyModels returns (electron/modules/semantic.cjs). */
export interface MalloyFile {
  /** Relative to the MetricFlow connection's project folder, with forward slashes. */
  path: string
  size: number
  modifiedAt?: string
  /** Missing when the file is over the size limit. */
  text?: string
  tooLarge?: boolean
}

export interface MalloyListing {
  block?: 'not-set-up' | 'no-project'
  /** The project folder's own name, never its full path. */
  folderName?: string
  files: MalloyFile[]
  /** More files than the listing keeps (200), or too many folders to walk. */
  truncated?: boolean
  readAt: string
}
