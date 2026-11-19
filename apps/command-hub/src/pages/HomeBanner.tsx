import { useMemo, useRef, useState } from 'react'
import { Bot, CalendarDays, CircleCheck, FolderGit2, MessageSquarePlus } from 'lucide-react'

import { SETTINGS_PATH } from '@/components/layout/nav'
import { PageBanner } from '@/components/layout/PageBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { formatRelative } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { useSettingsAlerts, type AlertTone, type SettingsAlert } from '@/modules/settings/alerts'
import { scrollToAnchor } from '@/modules/settings/search'
import { usePageIndex, type PageHit } from '@/components/search/sources'

const toneDot: Record<AlertTone, string> = {
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
}

/** How many alerts the Today card lists before "and N more". */
const TODAY_MAX = 3
/** How many search results are shown at once. */
const RESULTS_MAX = 6

type Hit = PageHit

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Home's front door (header style C from monorail-ui): the date, a greeting,
 * one search over every page and Settings option, shortcuts, and a Today card
 * listing the Settings alerts. Nothing here starts a check; alerts come from
 * the shared store Settings uses.
 */
export function HomeBanner() {
  // Read once per visit: Home remounts whenever it is opened again.
  const [now] = useState(() => new Date())
  const { alerts, loaded } = useSettingsAlerts()
  const { search } = usePageIndex()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => search(query).slice(0, RESULTS_MAX), [search, query])

  function open(hit: Hit) {
    setQuery('')
    navigate(hit.path)
    if (hit.anchor) scrollToAnchor(hit.anchor)
  }

  const description = !loaded
    ? 'Here is what your agents have been up to.'
    : alerts.length === 0
      ? 'Nothing needs you right now. Everything is on track.'
      : `${alerts.length} ${alerts.length === 1 ? 'thing needs' : 'things need'} you. Everything else is on track.`

  return (
    <PageBanner
      kicker={
        <>
          <CalendarDays />
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </>
      }
      title={greeting(now.getHours())}
      description={description}
      aside={<TodayCard alerts={alerts} loaded={loaded} />}
    >
      <SearchField
        ref={input}
        size="lg"
        placeholder="Search pages and settings…"
        aria-label="Search pages and settings"
        aria-controls="home-search-results"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('')
          else if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, results.length - 1))
          else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
          else if (e.key === 'Enter' && results[active]) open(results[active])
          else return
          e.preventDefault()
        }}
      />
      {query.trim() ? (
        <div id="home-search-results" role="listbox" aria-label="Search results" className="rounded-lg bg-card p-1 ring-1 ring-foreground/10">
          {results.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nothing matches "{query.trim()}".</p>}
          {results.map((h, i) => (
            <button
              key={`${h.path}|${h.label}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => open(h)}
              className={cn('flex w-full flex-col rounded-md px-3 py-2 text-left', i === active && 'bg-muted')}
            >
              <span className="text-sm font-medium">{h.label}</span>
              {h.detail && <span className="line-clamp-1 text-xs text-muted-foreground">{h.detail}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/agents')}>
            <MessageSquarePlus />
            New chat
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/apps/github-plus')}>
            <FolderGit2 />
            Open repo
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/agents/catalog')}>
            <Bot />
            New agent
          </Button>
        </div>
      )}
    </PageBanner>
  )
}

function TodayCard({ alerts, loaded }: { alerts: SettingsAlert[]; loaded: boolean }) {
  const shown = alerts.slice(0, TODAY_MAX)
  const more = alerts.length - shown.length
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardDescription className="text-xs font-semibold tracking-wide uppercase">Today</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loaded && alerts.length === 0 ? (
          <div className="flex items-start gap-2.5">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Nothing needs you</div>
              <div className="text-xs text-muted-foreground">Connections, updates and backups are fine.</div>
            </div>
          </div>
        ) : !loaded ? (
          <div className="text-xs text-muted-foreground">Checking…</div>
        ) : (
          <ul className="divide-y">
            {shown.map((a) => (
              <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => navigate(a.path)}
                  className="-mx-1 flex w-[calc(100%+0.5rem)] items-start gap-2.5 rounded-md px-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneDot[a.tone])} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.where}
                      {a.at && ` · ${formatRelative(a.at)}`}
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {more > 0 && (
              <li className="pt-2.5">
                <button type="button" onClick={() => navigate(SETTINGS_PATH)} className="text-xs font-medium text-primary hover:underline">
                  and {more} more in Settings
                </button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
