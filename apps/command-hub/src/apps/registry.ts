import { calendarApp } from './calendar'
import { emailApp } from './email'
import { gitHubPlusApp } from './github-plus'
import { jiraPlusApp } from './jira-plus'
import { extensionApps } from '@/extensions/contributions'
import { getExtensionList } from '@/extensions/store'
import type { ExtensionList } from '@/extensions/types'

import type { AppDefinition } from './types'

/** Every built-in app, in nav order. Add new apps here. */
export const apps: AppDefinition[] = [gitHubPlusApp, jiraPlusApp, calendarApp, emailApp]

const ids = new Set<string>()
for (const a of apps) {
  if (ids.has(a.id)) throw new Error(`Duplicate app id: ${a.id}`)
  if (a.path !== `/apps/${a.id}`) throw new Error(`App ${a.id} must use the path /apps/${a.id}`)
  ids.add(a.id)
}

/** Built-in apps plus the apps of active extensions (src/extensions). */
export function allApps(list: ExtensionList = getExtensionList()): AppDefinition[] {
  // Extension apps always run full screen, whatever their definition says.
  return [...apps, ...extensionApps(list).map((a) => ({ ...a, placement: 'fullscreen' as const }))]
}

/** Apps shown as Workspace pages, under the hub's drawer and top bar. */
export function isWorkspaceApp(app: AppDefinition): boolean {
  return app.placement === 'workspace'
}

/** Apps that take over the whole window (the cards on the Apps page). */
export function fullscreenApps(list?: ExtensionList): AppDefinition[] {
  return allApps(list).filter((a) => !isWorkspaceApp(a))
}

/** The app that owns a route path (the app's prefix or anything under it). */
export function findAppByPath(path: string, list?: ExtensionList): AppDefinition | undefined {
  return allApps(list).find((a) => path === a.path || path.startsWith(`${a.path}/`) || path.startsWith(`${a.path}?`))
}
