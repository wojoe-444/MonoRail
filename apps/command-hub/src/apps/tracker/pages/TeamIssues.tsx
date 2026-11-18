import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Inbox, Plus, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'

import { Empty, EntityIcon } from '../components/bits'
import { IssueBrowser } from '../components/IssueBrowser'
import { PageTop } from '../components/PageTop'
import { stateType } from '../lib'
import { useTracker } from '../TrackerContext'
import type { StateType } from '../types'

type Tab = 'all' | 'active' | 'backlog'
const TAB_TYPES: Record<Tab, StateType[] | undefined> = { all: undefined, active: ['unstarted', 'started'], backlog: ['backlog'] }

/** A team's issues: All, Active (todo and in progress) or Backlog. Triage issues stay on the Triage page. */
export function TeamIssues() {
  const { snap, idx, startCreate } = useTracker()
  const { key } = useParams()
  const [params, setParams] = useSearchParams()
  const team = key ? idx.teamByKey.get(key) : undefined
  if (!team) return <Navigate to="/" replace />
  const tab = (['all', 'active', 'backlog'].includes(params.get('tab') ?? '') ? params.get('tab') : 'all') as Tab
  const types = TAB_TYPES[tab]
  const issues = snap.issues.filter((i) => i.teamId === team.id && stateType(idx, i) !== 'triage' && (!types || types.includes(stateType(idx, i))))
  return (
    <>
      <PageTop
        title={team.name}
        icon={<EntityIcon icon={team.icon} color={team.color} />}
        actions={
          <>
            <Button size="sm" variant="ghost" asChild>
              <Link to={`/team/${team.key}/settings`} aria-label="Team settings">
                <Settings />
              </Link>
            </Button>
            <Button size="sm" onClick={() => startCreate({ teamId: team.id })}>
              <Plus /> New issue
            </Button>
          </>
        }
      >
        <Segmented
          aria-label="Which issues"
          value={tab}
          onChange={(v) =>
            setParams((p) => {
              const n = new URLSearchParams(p)
              n.set('tab', v)
              return n
            })
          }
          options={[
            { value: 'all', label: 'All issues' },
            { value: 'active', label: 'Active' },
            { value: 'backlog', label: 'Backlog' },
          ]}
        />
      </PageTop>
      <IssueBrowser key={`${team.id}-${tab}`} issues={issues} storageKey={`team-${team.id}-${tab}`} teamId={team.id} createDefaults={{ teamId: team.id, stateId: tab === 'backlog' ? snap.states.find((s) => s.teamId === team.id && s.type === 'backlog')?.id : undefined }} initialDisplay={{ showCompleted: tab === 'all' ? 'month' : 'all' }} />
    </>
  )
}

/** New issues waiting for someone to accept, decline or mark as duplicate (open one for the triage buttons). */
export function TriagePage() {
  const { snap, idx, startCreate } = useTracker()
  const { key } = useParams()
  const team = key ? idx.teamByKey.get(key) : undefined
  if (!team) return <Navigate to="/" replace />
  if (!team.triageEnabled) return <Navigate to={`/team/${team.key}/issues`} replace />
  const issues = snap.issues.filter((i) => i.teamId === team.id && stateType(idx, i) === 'triage')
  return (
    <>
      <PageTop
        title={`${team.name} · Triage`}
        icon={<Inbox className="size-4 text-muted-foreground" />}
        actions={
          <Button size="sm" variant="outline" onClick={() => startCreate({ teamId: team.id, triage: true })}>
            <Plus /> New triage issue
          </Button>
        }
      />
      <IssueBrowser
        issues={issues}
        storageKey={`triage-${team.id}`}
        teamId={team.id}
        initialDisplay={{ groupBy: 'none', orderBy: 'created' }}
        createDefaults={{ teamId: team.id, triage: true }}
        empty={<Empty title="Triage is clear">New issues that land here wait for someone to accept, decline or mark them as a duplicate. Open an issue to see those buttons.</Empty>}
      />
    </>
  )
}
