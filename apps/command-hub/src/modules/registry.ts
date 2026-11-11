import { claudeStatsModule } from './claude-stats'
import type { ModuleDefinition } from './types'

/** Every module in the app, in nav order. Add new modules here. */
export const modules: ModuleDefinition[] = [claudeStatsModule]

const ids = new Set<string>()
const paths = new Set<string>()
for (const m of modules) {
  if (ids.has(m.id)) throw new Error(`Duplicate module id: ${m.id}`)
  if (paths.has(m.path)) throw new Error(`Duplicate module path: ${m.path}`)
  ids.add(m.id)
  paths.add(m.path)
}

export function findModuleByPath(path: string): ModuleDefinition | undefined {
  return modules.find((m) => m.path === path)
}
