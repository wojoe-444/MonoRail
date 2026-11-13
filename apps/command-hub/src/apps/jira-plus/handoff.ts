import { navigate } from '@/lib/router'

import type { Source } from './types'

/** Open a task in Tasks from another page (GitHub+'s linked tasks, Calendar): the task panel over the Overview. */
export function openInJiraPlus(source: Source, key: string) {
  navigate(`/apps/jira-plus/?selectedIssue=${encodeURIComponent(`${source}:${key}`)}`)
}
