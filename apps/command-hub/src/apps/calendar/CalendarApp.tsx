import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { isDesktop } from '@/modules/client'
import { jiraApi, errorText } from '../jira-plus/api'
import { openInJiraPlus } from '../jira-plus/handoff'
import type { CalendarIssues, Issue } from '../jira-plus/types'
import { dayKey, monthDays } from './dates'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const button = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50'

export default function CalendarApp() {
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => dayKey(today))
  const [data, setData] = useState<CalendarIssues>()
  const [error, setError] = useState<string>()
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const days = useMemo(() => monthDays(month.getFullYear(), month.getMonth()), [month])
  const start = dayKey(days[0]), last = days[days.length - 1]
  const end = dayKey(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))
  useEffect(() => {
    let live = true
    setLoading(true); setError(undefined); setData(undefined)
    jiraApi().calendarIssues({ start, end }).then((result) => { if (live) setData(result) }, (err) => { if (live) setError(errorText(err)) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [start, end, revision])
  const byDay = useMemo(() => {
    const groups = new Map<string, Issue[]>()
    for (const item of data?.issues ?? []) if (item.dueDate) groups.set(item.dueDate, [...(groups.get(item.dueDate) ?? []), item])
    for (const items of groups.values()) items.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
    return groups
  }, [data])
  const selectedItems = byDay.get(selected) ?? []
  const [year, monthNumber, day] = selected.split('-').map(Number)
  const selectedDate = new Date(year, monthNumber - 1, day)
  function changeMonth(delta: number) { const next = new Date(month.getFullYear(), month.getMonth() + delta, 1); setMonth(next); setSelected(dayKey(next)) }
  function chooseDay(date: Date) { setSelected(dayKey(date)); if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1)) }
  function goToday() { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(dayKey(now)); setRevision((n) => n + 1) }
  return <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-8">
    <header className="mb-6 flex flex-wrap items-start gap-4"><div className="mr-auto"><div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" /> Workspace</div><h1 className="text-2xl font-semibold tracking-tight">Calendar</h1><p className="mt-1 text-sm text-muted-foreground">Jira+ tasks by expected end date</p></div><button type="button" className={button} onClick={goToday}>Today</button><button type="button" className={button} aria-label="Refresh calendar" onClick={() => setRevision((n) => n + 1)}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /></button></header>
    {!isDesktop() && <div className="mb-4 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">Browser preview with fictional Jira+ tasks. Open the desktop app to see your own tasks.</div>}
    {data?.warning && <div role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Team Jira could not be fully loaded: {data.warning}</div>}
    {error && <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">Couldn’t load Jira+ tasks: {error} <button type="button" className="ml-2 underline" onClick={() => setRevision((n) => n + 1)}>Retry</button></div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card" aria-label="Monthly calendar">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4 sm:px-5"><h2 className="mr-auto text-lg font-semibold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><button type="button" className={button} aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft className="size-4" /></button><button type="button" className={button} aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight className="size-4" /></button></div>
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">{weekdays.map((d) => <div key={d} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((date) => {
          const key = dayKey(date), items = byDay.get(key) ?? [], active = key === selected, outside = date.getMonth() !== month.getMonth()
          return <button key={key} type="button" aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${items.length} ${items.length === 1 ? 'task' : 'tasks'}`} aria-pressed={active} onClick={() => chooseDay(date)} className={`min-h-20 min-w-0 border-r border-b border-border p-1.5 text-left align-top transition-colors hover:bg-accent/60 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary sm:min-h-28 sm:p-2 ${outside ? 'bg-muted/25 text-muted-foreground' : ''} ${active ? 'bg-primary/10' : ''}`}>
            <span className={`flex size-7 items-center justify-center rounded-full text-sm ${key === dayKey(today) ? 'bg-primary font-semibold text-primary-foreground' : ''}`}>{date.getDate()}</span>
            <span className="mt-1 hidden space-y-1 sm:block">{items.slice(0, 2).map((item) => <span key={`${item.source}:${item.key}`} className={`block truncate rounded px-1.5 py-0.5 text-xs ${item.statusCategory === 'done' ? 'bg-muted text-muted-foreground line-through' : 'bg-primary/10 text-foreground'}`}>{item.summary}</span>)}{items.length > 2 && <span className="block px-1 text-xs text-muted-foreground">+{items.length - 2} more</span>}</span>
            {items.length > 0 && <span className="mt-1 block text-xs text-muted-foreground sm:hidden">{items.length} due</span>}
          </button>
        })}</div>
      </section>
      <aside className="rounded-xl border border-border bg-card p-5" aria-live="polite"><h2 className="font-semibold">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2><p className="mt-1 text-xs text-muted-foreground">Expected end date · {selectedItems.length} {selectedItems.length === 1 ? 'task' : 'tasks'}</p>
        <div className="mt-5 space-y-3">{loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading tasks…</div> : error ? <p className="text-sm text-muted-foreground">Tasks couldn’t be loaded.</p> : selectedItems.length === 0 ? <p className="text-sm text-muted-foreground">No tasks due on this day.</p> : selectedItems.map((issue) => <button key={`${issue.source}:${issue.key}`} type="button" onClick={() => openInJiraPlus(issue.source, issue.key)} className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><span className="block text-xs font-medium text-muted-foreground">{issue.key} · {issue.projectName ?? issue.projectKey}</span><span className={`mt-1 block text-sm font-medium ${issue.statusCategory === 'done' ? 'line-through' : ''}`}>{issue.summary}</span><span className="mt-2 block text-xs text-muted-foreground">{issue.type} · {issue.status}{issue.source === 'local' ? ' · Private' : ' · Team Jira'}</span></button>)}</div>
        <p className="mt-7 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Add or change an expected end date in Jira+. {data?.teamConnected ? 'Team issues follow your Jira+ filter.' : 'Connect team Jira in Jira+ to include its tasks.'}</p>
      </aside>
    </div>
  </div>
}
