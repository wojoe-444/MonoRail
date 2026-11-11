import { gitHubPlusApp } from './github-plus'
import type { AppDefinition } from './types'

/** Every app, in nav order. Add new apps here. */
export const apps: AppDefinition[] = [gitHubPlusApp]

const ids = new Set<string>()
for (const a of apps) {
  if (ids.has(a.id)) throw new Error(`Duplicate app id: ${a.id}`)
  if (a.path !== `/apps/${a.id}`) throw new Error(`App ${a.id} must use the path /apps/${a.id}`)
  ids.add(a.id)
}

/** The app that owns a route path (the app's prefix or anything under it). */
export function findAppByPath(path: string): AppDefinition | undefined {
  return apps.find((a) => path === a.path || path.startsWith(`${a.path}/`) || path.startsWith(`${a.path}?`))
}
