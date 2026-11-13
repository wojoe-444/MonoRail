import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'

import { Board } from '../components/Board'
import { ErrorNote } from '../components/Modal'
import { useJira } from '../JiraContext'
import { matches, useQuery, useScope, useScopedIssues } from '../scope'

/** The board for one project, or for every project at once. Drag a card to change its status. */
export function BoardView() {
  const { openIssue, openDialog } = useJira()
  const { project, projectRef } = useScope()
  const [q] = useQuery()
  const { issues, error, busyKey, move } = useScopedIssues(projectRef)
  const shown = useMemo(() => (issues ?? []).filter((i) => i.type !== 'Recurring' && matches(i, q)), [issues, q])

  return (
    <>
      <ErrorNote error={error} />
      {!issues && !error ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Board issues={shown} busyKey={busyKey} showProject={!projectRef} onOpen={(i) => openIssue(i.source, i.key)} onMove={move} onAdd={() => openDialog('create', project)} />
      )}
    </>
  )
}
