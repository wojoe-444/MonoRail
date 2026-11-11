import { claudeStatsModule } from './claude-stats'
import { jiraModule } from './jira'
import { extensionsModule } from './extensions'
import { settingsModule } from './settings'
import { extensionModules } from '@/extensions/contributions'
import { getExtensionList } from '@/extensions/store'
import type { ExtensionList } from '@/extensions/types'

import type { ModuleDefinition } from './types'

/** Every module in the app, in nav order. Add new modules here. */
export const modules: ModuleDefinition[] = [jiraModule, claudeStatsModule, extensionsModule, settingsModule]

const ids = new Set<string>()
const paths = new Set<string>()
for (const m of modules) {
  if (ids.has(m.id)) throw new Error(`Duplicate module id: ${m.id}`)
  if (paths.has(m.path)) throw new Error(`Duplicate module path: ${m.path}`)
  ids.add(m.id)
  paths.add(m.path)
}

/** Built-in modules plus the modules of active extensions (src/extensions). */
export function allModules(list: ExtensionList = getExtensionList()): ModuleDefinition[] {
  return [...modules, ...extensionModules(list)]
}

export function findModuleByPath(path: string, list?: ExtensionList): ModuleDefinition | undefined {
  return allModules(list).find((m) => m.path === path)
}
