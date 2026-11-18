import { useState } from 'react'
import { User } from 'lucide-react'

import { Segmented } from '@/components/ui/segmented'

import { IssueBrowser } from '../components/IssueBrowser'
import { PageTop } from '../components/PageTop'
import { useTracker } from '../TrackerContext'

/** Issues assigned to you, or made by you, across every team. */
export function MyIssues() {
  const { snap } = useTracker()
  const [tab, setTab] = useState<'assigned' | 'created'>('assigned')
  const issues = snap.issues.filter((i) => (tab === 'assigned' ? i.assigneeId === snap.meId : i.creatorId === snap.meId))
  return (
    <>
      <PageTop title="My issues" icon={<User className="size-4 text-muted-foreground" />}>
        <Segmented
          aria-label="Which issues"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'assigned', label: 'Assigned' },
            { value: 'created', label: 'Created' },
          ]}
        />
      </PageTop>
      <IssueBrowser key={tab} issues={issues} storageKey={`my-${tab}`} initialDisplay={{ groupBy: 'status', showCompleted: 'week' }} createDefaults={tab === 'assigned' ? { assigneeId: snap.meId } : {}} />
    </>
  )
}
