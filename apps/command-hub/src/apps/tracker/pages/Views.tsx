import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CircleDot, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { trackerApi } from '../api'
import { Empty, EntityIcon } from '../components/bits'
import { IssueBrowser } from '../components/IssueBrowser'
import { PageTop } from '../components/PageTop'
import { applyFilters, filterCount, GROUP_LABEL } from '../lib'
import { useTracker } from '../TrackerContext'

/** Saved views: a set of filters and display options, for everyone (workspace) or one team. */
export function ViewsPage() {
  const { snap, idx, run } = useTracker()
  const navigate = useNavigate()
  const views = [...snap.views].sort((a, b) => (a.teamId ?? '').localeCompare(b.teamId ?? '') || a.name.localeCompare(b.name))
  const create = () => void run(() => trackerApi.save('customView', { name: `New view ${snap.views.length + 1}`, filters: {} })).then((v) => v && navigate(`/views/${v.id}`))
  return (
    <>
      <PageTop
        title="Views"
        icon={<CircleDot className="size-4 text-muted-foreground" />}
        actions={
          <Button size="sm" onClick={create}>
            <Plus /> New view
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {views.length === 0 ? (
          <Empty title="No views yet" action={<Button size="sm" onClick={create}>New view</Button>}>
            A view keeps a set of filters and display options, like “Open bugs, by priority”. Make one here, or use the save button next to Display on any issue list.
          </Empty>
        ) : (
          views.map((v) => {
            const base = v.teamId ? snap.issues.filter((i) => i.teamId === v.teamId) : snap.issues
            const n = applyFilters(idx, base, v.filters).length
            return (
              <Link key={v.id} to={`/views/${v.id}`} className="flex items-center gap-3 border-b px-4 py-3 text-sm hover:bg-accent/50">
                <EntityIcon icon={v.icon} color={v.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{v.description || `${filterCount(v.filters)} filters · grouped by ${GROUP_LABEL[v.display.groupBy].toLowerCase()} · ${v.display.layout}`}</span>
                </span>
                <span className="rounded-full bg-muted px-2 text-xs">{v.teamId ? idx.team.get(v.teamId)?.name : 'Workspace'}</span>
                <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{n} issues</span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}

export function ViewDetail() {
  const { snap, idx, run } = useTracker()
  const { id } = useParams()
  const navigate = useNavigate()
  const view = snap.views.find((v) => v.id === id)
  const [name, setName] = useState(view?.name ?? '')
  useEffect(() => setName(view?.name ?? ''), [view?.name])
  if (!view) return <Navigate to="/views" replace />
  const team = view.teamId ? idx.team.get(view.teamId) : undefined
  const issues = team ? snap.issues.filter((i) => i.teamId === team.id) : snap.issues
  return (
    <>
      <PageTop
        title={
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== view.name && void run(() => trackerApi.save('customView', { id: view.id, name: name.trim() }))} className="w-64 bg-transparent font-semibold outline-none" aria-label="View name" />
        }
        icon={<input value={view.icon} onChange={(e) => void run(() => trackerApi.save('customView', { id: view.id, name: view.name, icon: e.target.value }))} placeholder="◻" maxLength={8} className="w-6 bg-transparent text-center outline-none" aria-label="Icon (an emoji)" />}
        actions={
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (!confirm(`Delete the view “${view.name}”? No issues are changed.`)) return
              void run(() => trackerApi.remove('customView', view.id), 'View deleted.').then(() => navigate('/views'))
            }}
          >
            <Trash2 />
          </Button>
        }
      >
        <span className="rounded-full bg-muted px-2 text-xs">{team ? team.name : 'Workspace'}</span>
      </PageTop>
      <IssueBrowser key={view.id} issues={issues} storageKey="" view={view} teamId={team?.id} createDefaults={{ teamId: team?.id }} />
    </>
  )
}
