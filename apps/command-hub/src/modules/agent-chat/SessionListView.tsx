import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronRight,
  Folder,
  FolderGit2,
  FolderPlus,
  GitBranch,
  Loader2,
  Mail,
  MailOpen,
  Plus,
  Settings2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MochiAvatar } from '@/components/mochi'
import { prefs } from '@/lib/prefs'
import { cn } from '@/lib/utils'

import { formatUsd } from './live'
import { SOURCE_LABEL, type SessionList, type SessionSummary } from './types'
import { SourceAvatar } from './SourceAvatar'

/** Which of the list's bottom sections are open (per person; both closed by default). */
const SECTIONS_KEY = 'commandHub.chat.listSections'
type ListSection = 'working' | 'settled'

function readOpenSections(): ListSection[] {
  try {
    const v: unknown = JSON.parse(prefs.getItem(SECTIONS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is ListSection => x === 'working' || x === 'settled') : []
  } catch {
    return []
  }
}

function relative(ms: number, now = Date.now()): string {
  const s = Math.round((now - ms) / 1000)
  if (s < 60) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function CoordinatorEntry({
  status,
  latest,
  active,
  onOpen,
  onNew,
}: {
  status?: { ready: boolean; reason?: string; note?: string; builtin?: boolean }
  latest?: SessionSummary
  active: boolean
  onOpen: () => void
  onNew: () => void
}) {
  const ready = !!status?.ready
  const entry = (
    <div className={cn('mx-2 mt-2 flex items-center gap-1 rounded-lg border', active && 'border-primary bg-primary-soft', !ready && 'opacity-60')}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!ready && !latest}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
      >
        <MochiAvatar role="coordinator" size={32} className="-my-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Coordinator</span>
          <span className={cn('block truncate text-xs text-muted-foreground', ready && status?.note && 'text-warning')}>
            {ready && status?.note ? 'Cannot reach your chats' : latest ? `Last used ${relative(latest.updatedAt)}` : ready ? 'Start a coordinator chat' : 'Not available'}
          </span>
        </span>
      </button>
      {ready && latest && (
        <Button variant="ghost" size="icon" className="mr-1 size-7" onClick={onNew} aria-label="New coordinator chat" title="New coordinator chat">
          <Plus />
        </Button>
      )}
    </div>
  )
  const tip = ready
    ? (status?.note ?? (status?.builtin ? "MonoRail's built-in coordinator. To use your own, add ~/.claude/agents/coordinator.md." : undefined))
    : status?.reason
  if (!tip) return entry
  return (
    <Tooltip>
      <TooltipTrigger asChild>{entry}</TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Session list

export function SessionListView({
  sessions,
  sections,
  loading,
  error,
  selectedId,
  onSelect,
  sources,
  filtered,
  limits,
  folders,
  onOpenFolders,
  isUnread,
  onFlag,
}: {
  isUnread: (s: SessionSummary) => boolean
  onFlag: (id: string, flag: 'unread' | 'archived', value: boolean) => void
  limits?: SessionList['limits']
  folders?: SessionList['folders']
  onOpenFolders: () => void
  sessions: SessionSummary[]
  sections: { recent: SessionSummary[]; working: SessionSummary[]; settled: SessionSummary[] }
  loading: boolean
  error?: Error
  selectedId?: string
  onSelect: (id: string) => void
  sources?: SessionList['sources']
  filtered: boolean
}) {
  const [open, setOpen] = useState<ListSection[]>(readOpenSections)
  function toggle(section: ListSection) {
    setOpen((prev) => {
      const next = prev.includes(section) ? prev.filter((x) => x !== section) : [...prev, section]
      prefs.setItem(SECTIONS_KEY, JSON.stringify(next))
      return next
    })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <AlertTriangle className="size-5 text-warning" />
        Could not read the session logs.
        <span className="text-xs">{error.message}</span>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Reading session logs…
      </div>
    )
  }
  if (folders && folders.repoCount === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <FolderGit2 className="size-5" />
        <p>
          Chats are only shown for git repos in your Repos folder or repos you add.{' '}
          {folders.reposRootFound ? 'No repos were found there yet.' : 'The Repos folder was not found.'}
        </p>
        <Button variant="outline" size="sm" onClick={onOpenFolders}>
          <Settings2 /> Choose folders
        </Button>
      </div>
    )
  }
  if (sessions.length === 0) {
    const missing = sources?.filter((s) => !s.found).map((s) => s.label)
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {filtered ? 'No sessions match.' : 'No sessions found in your allowed repos yet.'}
        {!filtered && missing && missing.length > 0 && (
          <p className="mt-2 text-xs">No logs found for {missing.join(' or ')} on this machine.</p>
        )}
        {!filtered && <ListLimits limits={limits} onOpenFolders={onOpenFolders} />}
      </div>
    )
  }

  const rows = (items: SessionSummary[], working = false) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          active={s.id === selectedId}
          unread={isUnread(s)}
          working={working}
          onSelect={onSelect}
          onFlag={onFlag}
        />
      ))}
    </ul>
  )

  return (
    <>
      {/* Recent chats, newest first, in one flat list with the repo on each row. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sections.recent.length > 0 ? (
          rows(sections.recent)
        ) : (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No recent chats.{sections.settled.length > 0 && ' Older ones are under Settled.'}
          </p>
        )}
        <ListLimits limits={limits} onOpenFolders={onOpenFolders} />
      </div>
      {/* Working and Settled sit at the bottom, closed until opened. */}
      <div className="shrink-0 border-t p-2">
        <ListSectionView
          title="Working"
          count={sections.working.length}
          open={open.includes('working')}
          onToggle={() => toggle('working')}
          hint="Chats with a reply running in MonoRail"
        >
          {rows(sections.working, true)}
        </ListSectionView>
        <ListSectionView
          title="Settled"
          count={sections.settled.length}
          open={open.includes('settled')}
          onToggle={() => toggle('settled')}
          hint="Read chats with no activity for two days"
        >
          {rows(sections.settled)}
        </ListSectionView>
      </div>
    </>
  )
}

function ListSectionView({
  title,
  count,
  open,
  onToggle,
  hint,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  hint: string
  children: ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={hint}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex-1">{title}</span>
        <span className="tabular-nums">{count}</span>
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="max-h-[35vh] overflow-y-auto pb-1">
          {count > 0 ? children : <p className="px-3 py-2 text-xs text-muted-foreground">Nothing here.</p>}
        </div>
      )}
    </div>
  )
}

function SessionRow({
  session: s,
  active,
  unread,
  working,
  onSelect,
  onFlag,
}: {
  session: SessionSummary
  active: boolean
  unread: boolean
  working: boolean
  onSelect: (id: string) => void
  onFlag: (id: string, flag: 'unread' | 'archived', value: boolean) => void
}) {
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted',
            )}
          >
            {/* Repo and status on top, then the title, then branch and cost. */}
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <SourceAvatar source={s.source} className="size-4 rounded-[4px] [&_svg]:size-2.5 [&>span]:text-[10px]" />
              <span className="min-w-0 flex-1 truncate" title={s.repo.path}>
                {s.repo.name}
              </span>
              {working ? (
                <span className="flex shrink-0 items-center gap-1 text-info">
                  <Loader2 className="size-3 animate-spin" /> Working
                </span>
              ) : (
                <span className="shrink-0 tabular-nums">{relative(s.updatedAt)}</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              <span className={cn('flex-1 truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{s.title}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {s.branch ? (
                <span className="flex min-w-0 items-center gap-1 font-mono" title={s.model}>
                  <GitBranch className="size-3 shrink-0" />
                  <span className="truncate">{s.branch}</span>
                </span>
              ) : (
                <span className="truncate font-mono">{s.model ?? 'Model unknown'}</span>
              )}
              {s.total?.usd !== undefined && (
                <span className="shrink-0 font-mono tabular-nums" title={s.total.complete ? 'Total cost' : 'At least this much'}>
                  {s.total.complete ? '' : '≥'}
                  {formatUsd(s.total.usd)}
                </span>
              )}
              {s.scheduled && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  Scheduled
                </Badge>
              )}
              {s.archived && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  Archived
                </Badge>
              )}
              {s.source !== 'claude' && (
                <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                  {SOURCE_LABEL[s.source]}
                </Badge>
              )}
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onFlag(s.id, 'unread', !unread)}>
            {unread ? <MailOpen /> : <Mail />} Mark as {unread ? 'read' : 'unread'}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onFlag(s.id, 'archived', !s.archived)}>
            {s.archived ? <ArchiveRestore /> : <Archive />} {s.archived ? 'Unarchive' : 'Archive'}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  )
}

/** Says what the list leaves out, so it never looks complete when it is not. */
function ListLimits({ limits, onOpenFolders }: { limits?: SessionList['limits']; onOpenFolders?: () => void }) {
  if (!limits) return null
  const notes: string[] = []
  if (limits.dropped > 0) notes.push(`Showing the ${limits.kept} most recent chats.`)
  if (limits.totalLogs > limits.scanned) notes.push(`Only the ${limits.scanned} newest of ${limits.totalLogs} session logs were read.`)
  const hidden = limits.outsideAllowed
  if (!notes.length && !hidden) return null
  return (
    <div className="space-y-3 px-3 py-3 text-xs text-muted-foreground">
      {notes.length > 0 && <p>{notes.join(' ')}</p>}
      {hidden > 0 && (
        <div className="space-y-2 rounded-lg border p-3">
          <p>
            {hidden} {hidden === 1 ? 'chat is' : 'chats are'} hidden because {hidden === 1 ? 'it ran' : 'they ran'} outside your allowed repos. Chat
            only lists, opens and runs chats in repos you allow, so an agent started here can never reach other folders.
          </p>
          {!!limits.hiddenFolders?.length && (
            <ul className="space-y-1">
              {limits.hiddenFolders.map((f) => (
                <li key={f.path} className="flex items-center gap-2" title={f.path}>
                  <Folder className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>
                  {f.gitRepo === false && <span className="shrink-0 rounded bg-muted px-1">not a repo</span>}
                  <span className="shrink-0 tabular-nums">{f.count}</span>
                </li>
              ))}
            </ul>
          )}
          {limits.hiddenFolders?.some((f) => f.gitRepo === false) && (
            <p>Folders that are not a git repo (your home folder, for example) cannot be allowed. Start those chats inside a repo instead.</p>
          )}
          {onOpenFolders && (
            <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={onOpenFolders}>
              <FolderPlus /> Allow folders…
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
