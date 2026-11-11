import { useEffect, useState } from 'react'

import { errorText, jiraApi } from './api'
import { useJira } from './JiraContext'
import type { Issue, Source } from './types'

/** Tickets for one project (or every source with 'all'); refetches after any change. */
export function useIssues(source: Source | 'all', projectKey?: string) {
  const { version } = useJira()
  const [issues, setIssues] = useState<Issue[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let live = true
    jiraApi()
      .listIssues({ source, projectKey })
      .then(
        (list) => {
          if (!live) return
          setIssues(list)
          setError(undefined)
        },
        (e) => live && setError(errorText(e)),
      )
    return () => {
      live = false
    }
  }, [source, projectKey, version])

  return { issues, setIssues, error }
}
