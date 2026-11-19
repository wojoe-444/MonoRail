const q = (o: Record<string, string | undefined>): string =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString()

export const treeLink = (ref: string, path: string): string => `/repo/tree?${q({ ref, path })}`
/** line: highlight and scroll to it. working: the file as it is in the working folder now. */
export const blobLink = (ref: string, path: string, line?: number, working?: boolean): string =>
  `/repo/blob?${q({ ref, path, line: line ? String(line) : undefined, wt: working ? '1' : undefined })}`
export const commitsLink = (ref: string, path?: string): string => `/repo/commits?${q({ ref, path })}`
export const commitLink = (sha: string): string => `/repo/commit/${sha}`
export const compareLink = (base?: string, head?: string): string => `/repo/compare?${q({ base, head })}`
export const backupsLink = (): string => '/repo/backups'
export const issuesLink = (state?: 'closed'): string => `/repo/issues${state ? '?state=closed' : ''}`
export const issueLink = (n: number): string => `/repo/issues/${n}`
export const newIssueLink = (): string => '/repo/issues/new'
export const tasksLink = (): string => '/repo/tasks'
/** Search in the open repo; type is the result tab. */
export const searchLink = (query: string, type?: string): string => `/repo/search?${q({ q: query, type })}`
/** Search every repo GitHub+ Home lists. */
export const searchAllLink = (query: string, type?: string): string => `/search?${q({ q: query, type })}`
