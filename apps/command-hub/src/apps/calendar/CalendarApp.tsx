import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { isDesktop } from '@/modules/client'

import { openInJiraPlus } from '../jira-plus/handoff'
import { TaskCalendar } from './TaskCalendar'

/** Workspace > Calendar: every task by expected end date. Tasks has the same calendar as one of its views. */
export default function CalendarApp() {
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Workspace"
        title="Calendar"
        description="Your tasks by expected end date."
        actions={
          <>
            <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Refresh calendar" onClick={() => setRevision((n) => n + 1)}>
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
            </Button>
          </>
        }
      />
      {!isDesktop() && <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">Browser preview with fictional tasks. Open the desktop app to see your own tasks.</div>}
      <TaskCalendar revision={revision} onLoading={setLoading} onOpen={(issue) => openInJiraPlus(issue.source, issue.key)} />
    </div>
  )
}
