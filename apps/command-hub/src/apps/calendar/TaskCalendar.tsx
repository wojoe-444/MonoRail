import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { jiraApi, errorText } from '../jira-plus/api'
import type { CalendarIssues, Issue, Source } from '../jira-plus/types'
import { dayKey, monthDays } from './dates'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface TaskCalendarProps {
  /** Only this project's tasks. */
  project?: { source: Source; key: string }
  onOpen: (issue: Issue) => void
  /** Bump to load again (the Today / Refresh buttons, or after a change). */
  revision?: number
  onLoading?: (loading: boolean) => void
}

/** A month of tasks by expected end date, with the chosen day's tasks beside it. Used by Tasks and the Calendar page. */
export function TaskCalendar({ project, onOpen, revision = 0, onLoading }: TaskCalendarProps) {
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => dayKey(today))
  const [data, setData] = useState<CalendarIssues>()
  const [error, setError] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const days = useMemo(() => monthDays(month.getFullYear(), month.getMonth()), [month])
  const start = dayKey(days[0])
  const last = days[days.length - 1]
  const end = dayKey(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))

  useEffect(() => {
    let live = true
    setLoading(true)
    onLoading?.(true)
    setError(undefined)
    setData(undefined)
    jiraApi()
      .calendarIssues({ start, end })
      .then(
        (result) => live && setData(result),
        (err) => live && setError(errorText(err)),
      )
      .finally(() => {
        if (!live) return
        setLoading(false)
        onLoading?.(false)
      })
    return () => {
      live = false
    }
    // onLoading is a setter from the parent; leaving it out keeps the effect from rerunning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, revision, retry])

  // "Today" from the parent jumps back to the current month.
  useEffect(() => {
    if (!revision) return
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelected(dayKey(now))
  }, [revision])

  const byDay = useMemo(() => {
    const groups = new Map<string, Issue[]>()
    for (const item of data?.issues ?? []) {
      if (!item.dueDate) continue
      if (project && (item.source !== project.source || item.projectKey !== project.key)) continue
      groups.set(item.dueDate, [...(groups.get(item.dueDate) ?? []), item])
    }
    for (const items of groups.values()) items.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
    return groups
  }, [data, project])

  const selectedItems = byDay.get(selected) ?? []
  const [year, monthNumber, day] = selected.split('-').map(Number)
  const selectedDate = new Date(year, monthNumber - 1, day)

  function changeMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1)
    setMonth(next)
    setSelected(dayKey(next))
  }
  function chooseDay(date: Date) {
    setSelected(dayKey(date))
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  return (
    <div className="flex flex-col gap-4">
      {data?.warning && (
        <div role="alert" className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
          Team Jira could not be fully loaded: {data.warning}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          Couldn’t load tasks: {error}{' '}
          <button type="button" className="ml-2 underline" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0 gap-0 overflow-hidden py-0" aria-label="Monthly calendar">
          <div className="flex items-center gap-2 border-b px-6 py-4">
            <h2 className="mr-auto text-base font-semibold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            <Button variant="outline" size="icon" className="size-8" aria-label="Previous month" onClick={() => changeMonth(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" className="size-8" aria-label="Next month" onClick={() => changeMonth(1)}>
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {weekdays.map((d) => (
              <div key={d} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((date) => {
              const key = dayKey(date)
              const items = byDay.get(key) ?? []
              const active = key === selected
              const outside = date.getMonth() !== month.getMonth()
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${items.length} ${items.length === 1 ? 'task' : 'tasks'}`}
                  aria-pressed={active}
                  onClick={() => chooseDay(date)}
                  className={cn(
                    'min-h-20 min-w-0 border-r border-b p-1.5 text-left align-top transition-colors outline-none hover:bg-accent/60 focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-28 sm:p-2',
                    outside && 'bg-muted/25 text-muted-foreground',
                    active && 'bg-primary-soft/60',
                  )}
                >
                  <span className={cn('flex size-7 items-center justify-center rounded-full text-sm', key === dayKey(today) && 'bg-primary font-semibold text-primary-foreground')}>{date.getDate()}</span>
                  <span className="mt-1 hidden space-y-1 sm:block">
                    {items.slice(0, 2).map((item) => (
                      <span
                        key={`${item.source}:${item.key}`}
                        className={cn('block truncate rounded-md px-1.5 py-0.5 text-xs', item.statusCategory === 'done' ? 'bg-muted text-muted-foreground line-through' : 'bg-primary-soft text-primary-soft-foreground')}
                      >
                        {item.summary}
                      </span>
                    ))}
                    {items.length > 2 && <span className="block px-1 text-xs text-muted-foreground">+{items.length - 2} more</span>}
                  </span>
                  {items.length > 0 && <span className="mt-1 block text-xs text-muted-foreground sm:hidden">{items.length} due</span>}
                </button>
              )
            })}
          </div>
        </Card>
        <Card className="gap-0 self-start py-0" aria-live="polite">
          <div className="border-b px-6 py-4">
            <h2 className="text-base font-semibold">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Expected end · {selectedItems.length} {selectedItems.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading tasks…
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">Tasks couldn’t be loaded.</p>
            ) : selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks due on this day.</p>
            ) : (
              selectedItems.map((issue) => (
                <button
                  key={`${issue.source}:${issue.key}`}
                  type="button"
                  onClick={() => onOpen(issue)}
                  className="w-full rounded-lg p-3 text-left ring-1 ring-foreground/10 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block font-mono text-xs text-muted-foreground">
                    {issue.key} · {issue.projectName ?? issue.projectKey}
                  </span>
                  <span className={cn('mt-1 block text-sm font-medium', issue.statusCategory === 'done' && 'line-through')}>{issue.summary}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {issue.type} · {issue.status}
                    {issue.source === 'local' ? ' · Private' : ' · Team Jira'}
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="border-t px-6 py-4 text-xs leading-5 text-muted-foreground">
            Set an expected end date on a task to see it here. {data?.teamConnected ? 'Team tasks follow your Team Jira filter.' : 'Connect Team Jira in Tasks to include team tasks.'}
          </p>
        </Card>
      </div>
    </div>
  )
}
