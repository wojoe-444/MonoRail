import type { AppDefinition } from './types'

/**
 * Where to go when an app is left or reopened. Kept in memory for the
 * session: leaving an app returns to the hub page you came from, and
 * reopening an app resumes where you left it.
 */
let hubPath = '/'
const appPaths = new Map<string, string>()

export function rememberHubPath(path: string) {
  hubPath = path
}

export function hubReturnPath(): string {
  return hubPath
}

export function rememberAppPath(app: AppDefinition, path: string) {
  if (path === app.path || path.startsWith(`${app.path}/`) || path.startsWith(`${app.path}?`)) appPaths.set(app.id, path)
}

/** The path to open an app at: where it was left, or its start page. */
export function appEntryPath(app: AppDefinition): string {
  return appPaths.get(app.id) ?? app.path
}
