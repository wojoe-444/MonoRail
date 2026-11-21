import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hasLocalScreen, invokeModule, isDesktop, useModuleQuery } from '@/modules/client'
import { navigate } from '@/lib/router'
import { prefs } from '@/lib/prefs'
import { SAMPLE_REPORT, type InAppJob } from './inAppSample'

const date = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const HIDDEN = 'commandHub.scheduled.inAppHidden'
function initialHidden(): string[] {
  try {
    const v = JSON.parse(prefs.getItem(HIDDEN) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Last run column: when, and how it ended. */
function LastRun({ job }: { job: InAppJob }) {
  if (!job.lastRun) return <>{'—'}</>
  return (
    <>
      {date(job.lastRun)}
      <div className={`mt-1 text-xs ${job.result === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
        {job.state === 'Running' ? 'Running now' : job.result === 'failed' ? `Failed${job.note ? `: ${job.note}` : ''}` : job.result === 'ok' ? 'Succeeded' : ''}
      </div>
    </>
  )
}

export default function InAppPage() {
  const desktop = isDesktop()
  const query = useModuleQuery('scheduled', 'inApp')
  const [filter, setFilter] = useState('')
  const [hidden, setHidden] = useState<string[]>(initialHidden)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const local = hasLocalScreen()
  const report = desktop ? query.data : SAMPLE_REPORT
  const anyRunning = !!report?.jobs.some((j) => j.state === 'Running')
  const { reload } = query

  // Jobs run in the background: while one is running, look again every few seconds.
  useEffect(() => {
    if (!desktop || !anyRunning) return
    const timer = setInterval(() => void reload(), 3000)
    return () => clearInterval(timer)
  }, [desktop, anyRunning, reload])

  const jobs = (report?.jobs ?? []).filter((j) => `${j.title} ${j.description} ${j.group} ${j.schedule}`.toLowerCase().includes(filter.toLowerCase()))
  const visible = jobs.filter((j) => !hidden.includes(j.id))
  const hiddenJobs = jobs.filter((j) => hidden.includes(j.id))
  const groups = [...new Set(visible.map((j) => j.group))].sort((a, b) => a.localeCompare(b))

  function hide(j: InAppJob, value: boolean) {
    const next = value ? [...hidden, j.id] : hidden.filter((k) => k !== j.id)
    setHidden(next)
    prefs.setItem(HIDDEN, JSON.stringify(next))
  }
  async function runNow(j: InAppJob) {
    setBusy(j.id)
    setError('')
    try {
      await invokeModule('scheduled', 'runInApp', { id: j.id })
      await query.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const table = (items: InAppJob[], isHidden = false) => (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {['Job', 'Schedule', 'Next run', 'Last run', 'State', 'Actions'].map((h) => (
              <th className="px-4 py-3 font-medium" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr className="border-t align-top" key={j.id}>
              <td className="min-w-56 px-4 py-4">
                <div className="font-medium">{j.title}</div>
                {j.description && <p className="mt-1 text-xs text-muted-foreground">{j.description}</p>}
                {j.state === 'Disabled' && j.note && <p className="mt-1 text-xs text-muted-foreground">{j.note}</p>}
              </td>
              <td className="min-w-36 px-4 py-4">{j.schedule || 'No schedule'}</td>
              <td className="min-w-36 px-4 py-4">{date(j.nextRun)}</td>
              <td className="min-w-36 px-4 py-4">
                <LastRun job={j} />
              </td>
              <td className="px-4 py-4">
                <Badge variant={j.state === 'Running' ? 'success' : 'secondary'}>{j.state}</Badge>
              </td>
              <td className="min-w-48 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {!isHidden && j.runnable && local && (
                    <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => void runNow(j)}>
                      Run now
                    </Button>
                  )}
                  {!isHidden && j.where && (
                    <Button size="sm" variant="outline" onClick={() => navigate(j.where!.path)}>
                      Open {j.where.label}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => hide(j, !isHidden)}>
                    {isHidden ? 'Unhide' : 'Hide'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No jobs to show.</p>}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Scheduled"
        title="In-App"
        description="Review the jobs MonoRail runs on a schedule while it is open."
        actions={
          <Button disabled={!desktop || query.fetching} onClick={() => void query.refresh()}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        {desktop && report ? `Read ${date(report.readAt)}. ` : ''}These jobs only run while MonoRail is open; one that came due while it was closed runs when it opens again. Change a job's schedule or turn it off on the page that owns it. Run now starts one right away.
      </p>
      {!desktop && <p className="text-sm text-muted-foreground">Sample jobs, shown because the real ones only exist in the desktop app.</p>}
      <Input aria-label="Filter jobs" placeholder="Filter jobs" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
      {(error || query.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || query.error?.message}
        </p>
      )}
      {report?.problems.map((p) => (
        <p role="alert" className="text-sm text-destructive" key={p.source}>
          Could not read {p.source}: {p.error}
        </p>
      ))}
      {desktop && query.loading ? (
        <p className="text-sm text-muted-foreground">Reading scheduled jobs…</p>
      ) : (
        report && (
          <>
            {groups.map((g) => {
              const items = visible.filter((j) => j.group === g)
              return (
                <section className="flex flex-col gap-3" key={g}>
                  <h2 className="font-semibold">
                    {g} ({items.length})
                  </h2>
                  {table(items)}
                </section>
              )
            })}
            {groups.length === 0 && table([])}
            <details>
              <summary className="cursor-pointer text-sm font-medium">Hidden ({hiddenJobs.length})</summary>
              <div className="mt-4">{table(hiddenJobs, true)}</div>
            </details>
          </>
        )
      )}
    </div>
  )
}
