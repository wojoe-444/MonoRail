import { lazy } from 'react'
import { SquareKanban } from 'lucide-react'

import type { AppDefinition } from '../types'

export const trackerApp: AppDefinition = {
  id: 'tracker',
  title: 'Tracker',
  description: 'Issues, cycles, projects and initiatives for your teams, kept on this computer.',
  icon: SquareKanban,
  path: '/apps/tracker',
  placement: 'workspace',
  component: lazy(() => import('./TrackerApp')),
  dataMethods: ['snapshot', 'createTeam', 'updateTeam', 'createIssue', 'updateIssues', 'deleteIssues', 'restoreIssues', 'issueDetail', 'addProjectUpdate', 'scheduleCycles', 'addExample', 'save', 'remove'],
}
