import { lazy } from 'react'
import { SquareKanban } from 'lucide-react'

import type { ModuleDefinition } from '../types'

export const jiraModule: ModuleDefinition = {
  id: 'jira',
  title: 'Jira',
  description: 'Your team Jira tickets and your personal projects, side by side. Personal projects live in a local git repo.',
  icon: SquareKanban,
  path: '/jira',
  nav: { section: 'Workspace', order: 50 },
  component: lazy(() => import('./JiraPage')),
  dataMethods: [
    'getOverview',
    'listIssues',
    'getIssue',
    'getIssueTypes',
    'createIssue',
    'updateIssue',
    'transitionIssue',
    'addComment',
    'deleteIssue',
    'createLocalProject',
    'updateLocalProject',
    'saveConnection',
    'disconnect',
  ],
}
