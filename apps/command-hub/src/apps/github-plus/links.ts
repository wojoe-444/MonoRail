const q = (o: Record<string, string | undefined>): string =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString()

export const treeLink = (ref: string, path: string): string => `/repo/tree?${q({ ref, path })}`
export const blobLink = (ref: string, path: string): string => `/repo/blob?${q({ ref, path })}`
export const commitsLink = (ref: string, path?: string): string => `/repo/commits?${q({ ref, path })}`
export const commitLink = (sha: string): string => `/repo/commit/${sha}`
export const compareLink = (base?: string, head?: string): string => `/repo/compare?${q({ base, head })}`
