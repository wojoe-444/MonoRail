import { lazy } from 'react'
import { ListTodo } from 'lucide-react'

import type { AppDefinition } from '../types'

export const jiraPlusApp: AppDefinition = {
  id: 'jira-plus',
  title: 'Tasks',
  description: "Your private tasks and your team's Jira on one page. Private tasks never leave this computer.",
  icon: ListTodo,
  path: '/apps/jira-plus',
  placement: 'workspace',
  component: lazy(() => import('./TasksApp')),
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
