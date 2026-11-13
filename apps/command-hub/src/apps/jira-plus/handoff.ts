import { navigate } from '@/lib/router'

import type { Source } from './types'

/** Open a task in Jira+ from another app (GitHub+'s linked tasks): the issue dialog over Your work. */
export function openInJiraPlus(source: Source, key: string) {
  navigate(`/apps/jira-plus/?selectedIssue=${encodeURIComponent(`${source}:${key}`)}`)
}
