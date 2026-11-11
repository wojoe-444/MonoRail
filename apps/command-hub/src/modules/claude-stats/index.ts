import { lazy } from 'react'
import { ChartNoAxesCombined } from 'lucide-react'

import type { ModuleDefinition } from '../types'

export const claudeStatsModule: ModuleDefinition = {
  id: 'claude-stats',
  title: 'Claude Stats',
  description: 'Claude Code output, models, projects and API-equivalent cost, read locally with ccusage.',
  icon: ChartNoAxesCombined,
  path: '/claude-stats',
  nav: { section: 'Insights' },
  component: lazy(() => import('./ClaudeStatsPage')),
  dataMethods: ['getUsage'],
}
