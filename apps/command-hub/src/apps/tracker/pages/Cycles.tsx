import { Link, Navigate, useParams } from 'react-router-dom'
import { Repeat, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { Bar, Empty, ProgressRing } from '../components/bits'
import { IssueBrowser } from '../components/IssueBrowser'
import { PageTop } from '../components/PageTop'
import { addDays, cycleLabel, daysLeft, progressOf, shortDate, todayIso } from '../lib'
import { useTracker } from '../TrackerContext'
import type { Cycle } from '../types'

function phase(c: Cycle): 'current' | 'upcoming' | 'past' {
  const t = todayIso()
  return c.startsAt <= t && t < c.endsAt ? 'current' : c.startsAt > t ? 'upcoming' : 'past'
}
const range = (c: Cycle) => `${shortDate(c.startsAt)} – ${shortDate(addDays(c.endsAt, -1))}`

/** A team's cycles: current, upcoming and past, each with its progress. */
export function CyclesPage() {
  const { snap, idx } = useTracker()
  const { key } = useParams()
  const team = key ? idx.teamByKey.get(key) : undefined
  if (!team) return <Navigate to="/" replace />
  const cycles = snap.cycles.filter((c) => c.teamId === team.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  const groups = (['current', 'upcoming', 'past'] as const).map((p) => ({ p, list: cycles.filter((c) => phase(c) === p) })).filter((g) => g.list.length)
  return (
    <>
      <PageTop
        title={`${team.name} · Cycles`}
        icon={<Repeat className="size-4 text-muted-foreground" />}
        actions={
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/team/${team.key}/settings`}>
              <Settings /> Cycle settings
            </Link>
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {!team.cyclesEnabled ? (
          <Empty title="Cycles are off for this team" action={<Button size="sm" asChild><Link to={`/team/${team.key}/settings`}>Turn on cycles</Link></Button>}>
            Cycles are back-to-back periods of work (one to eight weeks). Tracker makes them for you, and unfinished issues roll over to the next one.
          </Empty>
        ) : (
          groups.map((g) => (
            <section key={g.p} className="mb-8">
              <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{{ current: 'Current', upcoming: 'Upcoming', past: 'Past' }[g.p]}</h2>
              <div className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
                {g.list.map((c) => {
                  const prog = progressOf(idx, snap.issues.filter((i) => i.cycleId === c.id))
                  return (
                    <Link key={c.id} to={`/team/${team.key}/cycles/${c.number}`} className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-accent/50">
                      <ProgressRing percent={prog.percent} size={20} />
                      <span className="w-32 font-medium">{cycleLabel(c)}</span>
                      <span className="text-muted-foreground">{range(c)}</span>
                      <span className="flex-1" />
                      {g.p === 'current' && <span className="text-xs text-muted-foreground">{daysLeft(c)} days left</span>}
                      <span className="w-32 text-right text-xs text-muted-foreground tabular-nums">
                        {prog.done}/{prog.total} done · {prog.percent}%
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}

/** One cycle: its numbers and its issues. */
export function CycleDetail() {
  const { snap, idx } = useTracker()
  const { key, number } = useParams()
  const team = key ? idx.teamByKey.get(key) : undefined
  const cycle = team && snap.cycles.find((c) => c.teamId === team.id && String(c.number) === number)
  if (!team) return <Navigate to="/" replace />
  if (!cycle) return <Navigate to={`/team/${team.key}/cycles`} replace />
  const issues = snap.issues.filter((i) => i.cycleId === cycle.id)
  const prog = progressOf(idx, issues)
  const p = phase(cycle)
  return (
    <>
      <PageTop title={`${team.name} · ${cycleLabel(cycle)}`} icon={<Repeat className="size-4 text-muted-foreground" />}>
        <span className="text-sm text-muted-foreground">{range(cycle)}</span>
        <span className="rounded-full bg-muted px-2 text-xs">{p === 'current' ? `${daysLeft(cycle)} days left` : p === 'upcoming' ? 'Upcoming' : 'Ended'}</span>
      </PageTop>
      <div className="grid shrink-0 grid-cols-2 gap-6 border-b px-6 py-4 md:grid-cols-4">
        <Num label="Scope" value={prog.total} hint={`${prog.points} points`} />
        <Num label="Started" value={prog.started} />
        <Num label="Completed" value={prog.done} hint={`${prog.donePoints} points`} />
        <div>
          <div className="text-xs tracking-wide text-muted-foreground uppercase">Progress</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{prog.percent}%</div>
          <div className="mt-2">
            <Bar percent={prog.percent} />
          </div>
        </div>
      </div>
      <IssueBrowser issues={issues} storageKey={`cycle-${team.id}`} teamId={team.id} createDefaults={{ teamId: team.id, cycleId: cycle.id }} initialDisplay={{ groupBy: 'status' }} />
    </>
  )
}

function Num({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
