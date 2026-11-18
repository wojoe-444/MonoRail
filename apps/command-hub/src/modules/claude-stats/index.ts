import { lazy } from 'react'
import { ChartNoAxesCombined } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/** Claude Stats lives as a tab of Bots > Dashboard. */
export const CLAUDE_STATS_PATH = '/agents/dashboard/claude-stats'

export const claudeStatsModule: ModuleDefinition = {
  id: 'claude-stats',
  title: 'Claude Stats',
  description: 'Claude Code output, models, projects and API-equivalent cost, read locally with ccusage.',
  icon: ChartNoAxesCombined,
  // A tab of Bots > Dashboard (src/pages/agents/DashboardLayout.tsx), not a drawer item.
  path: CLAUDE_STATS_PATH,
  nav: { section: 'Bots', hidden: true },
  component: lazy(() => import('./ClaudeStatsPage')),
  dataMethods: ['getUsage'],
}
