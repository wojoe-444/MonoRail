import { gitHubPlusApp } from './github-plus'
import { extensionApps } from '@/extensions/contributions'
import { getExtensionList } from '@/extensions/store'
import type { ExtensionList } from '@/extensions/types'

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
/** Built-in apps plus the apps of active extensions (src/extensions). */
export function allApps(list: ExtensionList = getExtensionList()): AppDefinition[] {
  return [...apps, ...extensionApps(list)]
}

export function findAppByPath(path: string, list?: ExtensionList): AppDefinition | undefined {
  return allApps(list).find((a) => path === a.path || path.startsWith(`${a.path}/`) || path.startsWith(`${a.path}?`))
}
