import { lazy } from 'react'
import { SquareKanban } from 'lucide-react'

import type { AppDefinition } from '../types'

export const jiraPlusApp: AppDefinition = {
  id: 'jira-plus',
  title: 'Jira+',
  description: 'Every task as a Jira ticket: your private local projects next to your team Jira. Local tickets never leave this machine.',
  icon: SquareKanban,
  path: '/apps/jira-plus',
  placement: 'workspace',
  component: lazy(() => import('./JiraPlusApp')),
  dataMethods: [
    'listTriggerTemplates',
    'saveTriggerTemplate',
    'deleteTriggerTemplate',
    'calendarIssues',
    'getOverview',
    'listIssues',
    'getIssue',
    'getIssueTypes',
    'createIssue',
    'updateIssue',
    'transitionIssue',
    'addComment',
    'updateComment',
    'deleteComment',
    'deleteIssue',
    'createLocalProject',
    'updateLocalProject',
    'saveSettings',
    'forgetLegacyConnection',
  ],
}
