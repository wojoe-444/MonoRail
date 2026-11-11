import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Brain,
  CalendarClock,
  Check,
  ChevronRight,
  FlaskConical,
  Folder,
  FolderGit2,
  FolderPlus,
  GitBranch,
  GitCompare,
  Globe,
  Loader2,
  Mail,
  MailOpen,
  MessagesSquare,
  Network,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  User,
  Wrench,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'

import { ChatMarkdown } from './ChatMarkdown'
import { takeChatHandoff } from './handoff'
import { Composer, DeniedRow, NewChatEmpty, TurnFooter, useComposerPrefs } from './Composer'
import { chatTotalView, costCalls, historyReplies, liveReplyCost } from './cost'
import { SidePanel, type PanelKind } from './Panels'
import { ReplyDetails, TotalChip } from './ReplyDetails'
import { contextUse, formatUsd, turnToMessages } from './live'
import { FoldersDialog } from './FoldersDialog'
import { sampleComposer, sampleSessions, sampleTranscripts } from './sample'
import {
  SOURCE_LABEL,
  type ChatBlock,
  type ChatMessage,
  type ChatView,
  type ComposerInfo,
  type LiveTurn,
  type SessionList,
  type SessionSource,
  type SessionSummary,
  type SessionTranscript,
  type TurnPoll,
} from './types'

type Filter = 'all' | SessionSource
const PAGE = 150

// ---------------------------------------------------------------------------
// Time helpers

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

function clock(ms?: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Page

export default function AgentChatPage() {
  const desktop = isDesktop()
  const list = useModuleQuery<SessionList>('agent-chat', 'listSessions')
  const data = desktop ? list.data : sampleSessions
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  // Opened from the Agents overview: a session to show, or a new chat to start.
  const [handoff] = useState(takeChatHandoff)
  const [selectedId, setSelectedId] = useState<string | undefined>(() => (handoff && 'open' in handoff ? handoff.open : undefined))
  const [foldersOpen, setFoldersOpen] = useState(false)
  const [panel, setPanel] = useState<PanelKind>()
  const composerQuery = useModuleQuery<ComposerInfo>('agent-chat', 'getComposer')
  const composerInfo = desktop ? composerQuery.data : sampleComposer
  const prefs = useComposerPrefs(composerInfo)
  /** A new chat being composed: its key and the project it will run in. */
  const [draft, setDraft] = useState<{ key: string; repo?: string; coordinator?: boolean } | undefined>(() =>
    handoff && 'newChat' in handoff ? { key: `draft:${crypto.randomUUID()}`, repo: handoff.newChat.repo } : undefined,
  )
  useEffect(() => {
    if (handoff && 'newChat' in handoff && handoff.newChat.sdk) prefs.setNewSdk(handoff.newChat.sdk)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [turns, setTurns] = useState<LiveTurn[]>([])
  const turnsRef = useRef(turns)
  useLayoutEffect(() => {
    turnsRef.current = turns
  })
  /** Chats created on this page keep their view (and live turns) when they get a session id. */
  const [viewKeys, setViewKeys] = useState<Record<string, string>>({})
  const [pendingSessions, setPendingSessions] = useState<Record<string, SessionSummary>>({})
  const [sendError, setSendError] = useState<{ key: string; message: string }>()

  /** Flag changes made here, shown at once until the list is read again. */
  const [localFlags, setLocalFlags] = useState<Record<string, { unread?: boolean; archived?: boolean }>>({})
  const [showScheduled, setShowScheduled] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const sessions = useMemo(
    () => (data?.sessions ?? []).map((s) => (localFlags[s.id] ? { ...s, ...localFlags[s.id] } : s)),
    [data, localFlags],
  )
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions.filter(
      (s) =>
        (filter === 'all' || s.source === filter) &&
        (!q || `${s.title} ${s.preview} ${s.project} ${s.repo.name} ${s.model ?? ''} ${s.branch ?? ''}`.toLowerCase().includes(q)),
    )
  }, [sessions, filter, query])
  const hiddenCounts = {
    scheduled: matching.filter((s) => s.scheduled && !s.archived).length,
    archived: matching.filter((s) => s.archived).length,
  }
  // Scheduled and archived chats are hidden until asked for; the open chat always stays listed.
  const visible = matching.filter((s) => s.id === selectedId || (s.archived ? showArchived : showScheduled || !s.scheduled))

  async function setFlag(id: string, flag: 'unread' | 'archived', value: boolean) {
    setLocalFlags((f) => ({ ...f, [id]: { ...f[id], [flag]: value } }))
    if (flag === 'unread' && !value) stickyUnread.current.delete(id)
    if (!desktop) return
    await invokeModule('agent-chat', flag === 'unread' ? 'setUnread' : 'setArchived', { id, [flag]: value })
    await list.refresh()
    setLocalFlags((f) => {
      const { [id]: _drop, ...rest } = f
      return rest
    })
  }

  const selected = draft
    ? undefined
    : (sessions.find((s) => s.id === selectedId) ?? (selectedId ? pendingSessions[selectedId] : undefined) ?? visible[0])
  const chatKey = draft?.key ?? selected?.id

  // Unread (F3): a chat that was unread when opened stays unread while it is
  // viewed, and is marked read on leaving it.
  const stickyUnread = useRef(new Set<string>())
  const openId = useRef<string | undefined>(undefined)
  const openedId = selected?.id
  const openedUnread = !!selected?.unread
  useEffect(() => {
    openId.current = openedId
    if (!openedId) return
    const sticky = stickyUnread.current
    if (openedUnread) sticky.add(openedId)
    return () => {
      sticky.delete(openedId)
      if (openId.current === openedId) openId.current = undefined
      setLocalFlags((f) => ({ ...f, [openedId]: { ...f[openedId], unread: false } }))
      if (desktop) void invokeModule('agent-chat', 'markSeen', { id: openedId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId, desktop])
  const isCoordinator = draft ? !!draft.coordinator : !!selected?.coordinator
  const chatSdk = draft ? (draft.coordinator ? 'claude' : prefs.newSdk) : (selected?.source ?? 'claude')
  // The pinned coordinator entry opens the latest coordinator chat, or starts one.
  const latestCoordinator = sessions.find((s) => s.coordinator)
  function openCoordinator() {
    setSendError(undefined)
    if (latestCoordinator) {
      setDraft(undefined)
      setSelectedId(latestCoordinator.id)
    } else setDraft({ key: `draft:${crypto.randomUUID()}`, coordinator: true })
  }
  const chatTurns = turns.filter((t) => t.chatKey === chatKey || (t.sessionId && `${t.sdk}:${t.sessionId}` === chatKey))
  const runningTurn = chatTurns.find((t) => t.status === 'running')
  const lastWithUsage = [...chatTurns].reverse().find((t) => contextUse(t))

  // Poll running turns for new events (the renderer bridge has no push channel for them).
  const runningIds = turns
    .filter((t) => t.status === 'running')
    .map((t) => t.turnId)
    .join(',')
  useEffect(() => {
    if (!runningIds || !desktop) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      for (const id of runningIds.split(',')) {
        const t = turnsRef.current.find((x) => x.turnId === id)
        if (!t) continue
        let p: TurnPoll
        try {
          p = await invokeModule<TurnPoll>('agent-chat', 'pollTurn', { turnId: id, after: t.next })
        } catch (e) {
          p = { status: 'failed', startedAt: t.startedAt, endedAt: Date.now(), next: t.next + 1, events: [{ t: 'error', message: e instanceof Error ? e.message : String(e) }] }
        }
        if (stopped) return
        setTurns((prev) =>
          prev.map((x) =>
            x.turnId === id
              ? { ...x, events: [...x.events, ...p.events], next: p.next, status: p.status, sessionId: p.sessionId ?? x.sessionId, endedAt: p.endedAt }
              : x,
          ),
        )
        // A new chat got its session id: it becomes a normal chat, keeping its view.
        if (p.sessionId && !t.sessionId && t.chatKey.startsWith('draft:')) {
          const id2 = `${t.sdk}:${p.sessionId}`
          setViewKeys((v) => ({ ...v, [id2]: t.chatKey }))
          setPendingSessions((v) => ({
            ...v,
            [id2]: {
              id: id2,
              source: t.sdk,
              sessionId: p.sessionId!,
              title: t.prompt.slice(0, 100),
              preview: t.prompt.slice(0, 160),
              project: t.repo?.name ?? '',
              cwd: t.repo?.path,
              startedAt: t.startedAt,
              updatedAt: Date.now(),
              sizeBytes: 0,
              repo: t.repo ?? { name: '', path: '' },
            },
          }))
          setDraft((d) => {
            if (d?.key === t.chatKey) {
              setSelectedId(id2)
              return undefined
            }
            return d
          })
        }
        if (p.status !== 'running') {
          // A reply that finishes while its chat is open counts as seen.
          const doneId = p.sessionId ? `${t.sdk}:${p.sessionId}` : t.chatKey
          const watching = openId.current === doneId || openId.current === t.chatKey || t.chatKey.startsWith('draft:')
          if (watching && p.sessionId) await invokeModule('agent-chat', 'markSeen', { id: doneId }).catch(() => undefined)
          void list.refresh()
        }
      }
      if (!stopped) timer = setTimeout(tick, 300)
    }
    timer = setTimeout(tick, 150)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningIds, desktop])

  async function send(prompt: string): Promise<boolean> {
    if (!chatKey) return false
    setSendError(undefined)
    const repo = draft ? composerInfo?.repos.find((r) => r.path === draft.repo) : undefined
    try {
      const { turnId } = await invokeModule<{ turnId: string }>('agent-chat', 'startTurn', {
        ...(draft ? (draft.coordinator ? { coordinator: true } : { repo: draft.repo, sdk: chatSdk }) : { chatId: selected?.id }),
        prompt,
        mode: prefs.mode,
        model: prefs.modelFor(chatSdk),
        // Reasoning is only requested for the Detailed view.
        reasoning: prefs.view === 'detailed',
        effort: prefs.effort,
      })
      setTurns((prev) => [...prev, { turnId, chatKey, sdk: chatSdk, prompt, startedAt: Date.now(), status: 'running', events: [], next: 0, repo }])
      return true
    } catch (e) {
      setSendError({ key: chatKey, message: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  function stop() {
    if (runningTurn) void invokeModule('agent-chat', 'stopTurn', { turnId: runningTurn.turnId })
  }

  /** A turn already running in the backend (e.g. the page was left and reopened): follow it. */
  function attach(turnId: string, key: string, sdk: SessionSource) {
    if (turnsRef.current.some((t) => t.turnId === turnId)) return
    setTurns((prev) => [...prev, { turnId, chatKey: key, sdk, prompt: '', startedAt: Date.now(), status: 'running', events: [], next: 0 }])
  }

  const composer = (
    <Composer
      info={composerInfo}
      prefs={prefs}
      source={chatSdk}
      isNew={!!draft}
      coordinator={isCoordinator}
      repo={draft?.coordinator ? 'coordinator' : draft?.repo}
      onRepo={(path) => setDraft((d) => (d ? { ...d, repo: path } : d))}
      branch={selected?.branch}
      running={runningTurn}
      lastTurn={chatTurns[chatTurns.length - 1]}
      error={sendError && sendError.key === chatKey ? sendError.message : undefined}
      initialText={handoff && 'newChat' in handoff ? handoff.newChat.prompt : undefined}
      onSend={send}
      onStop={stop}
      context={contextUse(lastWithUsage)}
    />
  )
  const counts = useMemo(() => {
    const c = { all: sessions.length, claude: 0, pi: 0 }
    for (const s of sessions) c[s.source]++
    return c
  }, [sessions])

  return (
    // Fills the window below the 64px top bar and the main padding, so only the panes scroll.
    <div className="flex h-[calc(100dvh-7rem)] min-h-[32rem] flex-col gap-6 lg:h-[calc(100dvh-8rem)]">
      <PageHeader
        eyebrow="Agents"
        title="Chat"
        description="Claude Code and pi sessions in your allowed repos, read from their local logs."
        actions={
          <>
            {!desktop && (
              <Badge variant="info">
                <FlaskConical /> Sample data
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setFoldersOpen(true)}>
              <Settings2 /> Folders
            </Button>
            <Button
              variant={panel === 'changes' ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={panel === 'changes'}
              onClick={() => setPanel((p) => (p === 'changes' ? undefined : 'changes'))}
            >
              <GitCompare /> Changes
            </Button>
            <Button
              variant={panel === 'browser' ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={panel === 'browser'}
              onClick={() => setPanel((p) => (p === 'browser' ? undefined : 'browser'))}
            >
              <Globe /> Browser
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDraft({ key: `draft:${crypto.randomUUID()}`, repo: selected?.repo.path ?? composerInfo?.repos[0]?.path })
                setSendError(undefined)
              }}
            >
              <Plus /> New chat
            </Button>
            {desktop && (
              <Button variant="outline" size="sm" onClick={() => void list.refresh()} disabled={list.fetching}>
                {list.fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Refresh
              </Button>
            )}
          </>
        }
      />

      <FoldersDialog
        open={foldersOpen}
        onOpenChange={setFoldersOpen}
        onChanged={() => {
          if (desktop) void list.refresh()
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
        {/* Session list */}
        <aside className="flex w-80 shrink-0 flex-col border-r">
          <div className="flex flex-col gap-3 border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions"
                aria-label="Search sessions"
                className="pr-8 pl-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Segmented<Filter>
              aria-label="Agent"
              value={filter}
              onChange={setFilter}
              className="w-full [&>button]:flex-1 [&>button]:px-2"
              options={[
                { value: 'all', label: `All ${counts.all}` },
                { value: 'claude', label: `Claude ${counts.claude}` },
                { value: 'pi', label: `pi ${counts.pi}` },
              ]}
            />
            {(hiddenCounts.scheduled > 0 || hiddenCounts.archived > 0 || showScheduled || showArchived) && (
              <div className="flex gap-2">
                <Button
                  variant={showScheduled ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  aria-pressed={showScheduled}
                  onClick={() => setShowScheduled((v) => !v)}
                  title={`${showScheduled ? 'Hide' : 'Show'} chats run by a script, a scheduled task or another app`}
                >
                  <CalendarClock /> Scheduled ({hiddenCounts.scheduled})
                </Button>
                <Button
                  variant={showArchived ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  aria-pressed={showArchived}
                  title={`${showArchived ? 'Hide' : 'Show'} archived chats`}
                  onClick={() => setShowArchived((v) => !v)}
                >
                  <Archive /> Archived ({hiddenCounts.archived})
                </Button>
              </div>
            )}
          </div>
          <CoordinatorEntry
            status={composerInfo?.coordinator}
            latest={latestCoordinator}
            active={isCoordinator}
            onOpen={openCoordinator}
            onNew={() => {
              setSendError(undefined)
              setDraft({ key: `draft:${crypto.randomUUID()}`, coordinator: true })
            }}
          />
          <SessionListView
            sessions={visible}
            loading={desktop && list.loading}
            error={desktop ? list.error : undefined}
            selectedId={selected?.id}
            onSelect={(id) => {
              setDraft(undefined)
              setSelectedId(id)
            }}
            sources={data?.sources}
            filtered={sessions.length > 0}
            limits={data?.limits}
            folders={data?.folders}
            onOpenFolders={() => setFoldersOpen(true)}
            isUnread={(c) => !!c.unread || (c.id === selected?.id && stickyUnread.current.has(c.id))}
            onFlag={(id, flag, value) => void setFlag(id, flag, value)}
          />
        </aside>

        {/* Conversation */}
        <section className="flex min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {draft ? (
              <Conversation
                key={draft.key}
                draftRepoName={composerInfo?.repos.find((r) => r.path === draft.repo)?.name}
              coordinator={draft.coordinator}
                sdk={chatSdk}
                turns={chatTurns}
                composer={composer}
                view={prefs.view}
              />
            ) : selected ? (
              <Conversation
                key={viewKeys[selected.id] ?? selected.id}
                session={selected}
                skipHistory={!!viewKeys[selected.id]}
                turns={chatTurns}
                composer={composer}
                view={prefs.view}
                onAttach={(turnId) => attach(turnId, selected.id, selected.source)}
              />
            ) : (
              <EmptyState
                icon={MessagesSquare}
                title={desktop && list.loading ? 'Reading session logs…' : 'No session selected'}
                text="Pick a session on the left to read it here."
              />
            )}
          </div>
          {panel && (
            <SidePanel
              kind={panel}
              target={draft ? { repo: draft.repo } : selected && !selected.id.startsWith('draft:') ? { chatId: selected.id } : undefined}
              onClose={() => setPanel(undefined)}
            />
          )}
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Coordinator entry (F5)

function CoordinatorEntry({
  status,
  latest,
  active,
  onOpen,
  onNew,
}: {
  status?: { ready: boolean; reason?: string; note?: string }
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
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Network className="size-4" />
        </span>
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
  const tip = ready ? status?.note : status?.reason
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

function SessionListView({
  sessions,
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
  loading: boolean
  error?: Error
  selectedId?: string
  onSelect: (id: string) => void
  sources?: SessionList['sources']
  filtered: boolean
}) {
  // Grouped by repo. Sessions arrive newest first, so each group and the
  // group order (by its newest chat) come out newest first too.
  const groups = useMemo(() => {
    const byRepo = new Map<string, { label: string; title: string; items: SessionSummary[] }>()
    for (const s of sessions) {
      let g = byRepo.get(s.repo.path)
      if (!g) byRepo.set(s.repo.path, (g = { label: s.repo.name, title: s.repo.path, items: [] }))
      g.items.push(s)
    }
    // Coordinator chats are listed apart, first.
    return [...byRepo.entries()]
      .map(([key, g]) => ({ key, ...g, coordinator: g.items.some((s) => s.coordinator) }))
      .sort((a, b) => Number(b.coordinator) - Number(a.coordinator))
  }, [sessions])

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {groups.map((g) => (
        <div key={g.key} className="mb-2">
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase" title={g.title}>
            <FolderGit2 className="size-3.5" />
            <span className="truncate">{g.label}</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((s) => {
              const active = s.id === selectedId
              const unread = isUnread(s)
              return (
                <li key={s.id}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelect(s.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted',
                        )}
                      >
                        <SourceAvatar source={s.source} className="mt-0.5 size-7" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            {unread && <span className="size-2 shrink-0 self-center rounded-full bg-primary" aria-label="Unread" />}
                            <span className={cn('flex-1 truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{s.title}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{relative(s.updatedAt)}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="truncate font-mono">{s.model ?? 'Model unknown'}</span>
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
            })}
          </ul>
        </div>
      ))}
      <ListLimits limits={limits} onOpenFolders={onOpenFolders} />
    </div>
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

function SourceAvatar({ source, className }: { source: SessionSource; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md text-xs font-semibold',
        source === 'claude' ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-highlight-soft text-highlight-soft-foreground',
        className,
      )}
    >
      {source === 'claude' ? <Sparkles className="size-3.5" /> : <span className="font-mono text-sm leading-none">π</span>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Conversation

function Conversation({
  session,
  draftRepoName,
  coordinator,
  sdk = 'claude',
  skipHistory,
  turns,
  composer,
  view,
  onAttach,
}: {
  /** Missing for a new chat that has not started yet. */
  session?: SessionSummary
  draftRepoName?: string
  /** A new coordinator chat. */
  coordinator?: boolean
  /** The SDK of a new chat. */
  sdk?: SessionSource
  /** Chats started on this page show their live turns instead of re-reading the log. */
  skipHistory?: boolean
  turns: LiveTurn[]
  composer: ReactNode
  view: ChatView
  onAttach?: (turnId: string) => void
}) {
  const desktop = isDesktop()
  const noHistory = !session || skipHistory
  // The browser dev server has no backend: start from the fictional transcript.
  const [transcript, setTranscript] = useState<SessionTranscript | undefined>(() =>
    noHistory ? { id: session?.id ?? '', messages: [] } : desktop ? undefined : (sampleTranscripts[session.id] ?? { id: session.id, messages: [] }),
  )
  const [error, setError] = useState<Error>()
  const [shown, setShown] = useState(PAGE)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // History is read once when the chat opens; turns sent from here are shown live after it.
  const sessionId = session?.id
  useEffect(() => {
    if (!desktop || noHistory || !sessionId) return
    let live = true
    invokeModule<SessionTranscript>('agent-chat', 'getSession', { id: sessionId }).then(
      (t) => live && setTranscript(t),
      (e: unknown) => live && setError(e instanceof Error ? e : new Error(String(e))),
    )
    invokeModule<string | null>('agent-chat', 'runningTurn', { chatId: sessionId }).then(
      (turnId) => live && turnId && onAttach?.(turnId),
      () => undefined,
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, noHistory, sessionId])

  const messages = useMemo(() => transcript?.messages ?? [], [transcript])
  const detailed = view === 'detailed'
  // Detailed view: the model calls of each past reply, keyed by the index of its last message.
  const replyAt = useMemo(() => {
    const map = new Map<number, ReturnType<typeof costCalls>>()
    if (!detailed) return map
    for (const r of historyReplies(messages, transcript?.subagentCalls)) map.set(r.endIndex, costCalls(r.calls))
    return map
  }, [detailed, messages, transcript?.subagentCalls])
  const totals = chatTotalView(transcript?.total ?? session?.total, turns)
  const hidden = Math.max(0, messages.length - shown)
  const visible = hidden ? messages.slice(hidden) : messages

  // Open at the latest message, like a chat app, and follow a live turn while
  // the reader is at the bottom.
  const liveSize = turns.reduce((n, t) => n + t.events.length, 0)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [transcript, liveSize])

  function onScroll() {
    const el = scroller.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  const source = session?.source ?? 'claude'

  function showEarlier() {
    const el = scroller.current
    const before = el ? el.scrollHeight - el.scrollTop : 0
    stickToBottom.current = false
    setShown((n) => n + PAGE)
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before
    })
  }

  if (!session && turns.length === 0) {
    return (
      <>
        <NewChatEmpty repoName={draftRepoName} sdk={sdk} coordinator={coordinator} />
        {composer}
      </>
    )
  }

  return (
    <>
      {session && <ConversationHeader session={session} totals={totals} />}
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
              <AlertTriangle className="size-4" /> {error.message}
            </div>
          )}
          {!transcript && !error && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading conversation…
            </div>
          )}
          {transcript && messages.length === 0 && turns.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">This session has no messages to show.</div>
          )}
          {transcript?.truncated && hidden === 0 && (
            <div className="self-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              Earlier history was cut: only the last {transcript.truncated.bytes ? '4 MB of this log' : '300 messages'} {transcript.truncated.bytes ? 'is' : 'are'} shown.
            </div>
          )}
          {hidden > 0 && (
            <Button variant="outline" size="sm" className="self-center" onClick={showEarlier}>
              Show {Math.min(hidden, PAGE)} earlier messages
            </Button>
          )}
          {visible.map((m, i) => {
            const details = replyAt.get(hidden + i)
            return (
              <div key={hidden + i} className="contents">
                <MessageView message={m} source={source} view={view} />
                {details && <ReplyDetails cost={details} />}
              </div>
            )
          })}
          {turns.map((t) => (
            <div key={t.turnId} className="flex flex-col gap-6">
              {turnToMessages(t)
                .filter((m) => m.role !== 'user' || t.prompt)
                .map((m, i) => (
                  <MessageView key={i} message={m} source={source} view={view} />
                ))}
              {detailed && t.events.some((e) => e.t === 'usage') && <ReplyDetails cost={liveReplyCost(t)} />}
              <TurnFooter turn={t} />
            </div>
          ))}
        </div>
      </div>
      {composer}
    </>
  )
}

function ConversationHeader({ session, totals }: { session: SessionSummary; totals: ReturnType<typeof chatTotalView> }) {
  return (
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b px-6 py-3">
      <SourceAvatar source={session.source} className="size-9" />
      <div className="min-w-56 flex-1">
        <div className="truncate font-semibold">{session.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title={session.cwd}>
            <FolderGit2 className="size-3.5" /> {session.repo.name}
          </span>
          {session.branch && (
            <span className="inline-flex items-center gap-1">
              <GitBranch className="size-3.5" /> {session.branch}
            </span>
          )}
          <span>Started {clock(session.startedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <TotalChip total={totals.total} sinceOpened={totals.sinceOpened} />
        <Badge variant={session.source === 'claude' ? 'primary' : 'info'}>{SOURCE_LABEL[session.source]}</Badge>
        {session.model && (
          <Badge variant="outline" className="font-mono">
            {session.model}
          </Badge>
        )}
      </div>
    </div>
  )
}

function MessageView({ message, source, view }: { message: ChatMessage; source: SessionSource; view: ChatView }) {
  if (message.role === 'system') {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {message.blocks.map((b) => (b.type === 'text' ? b.text : '')).join(' ')}
        <span className="h-px flex-1 bg-border" />
      </div>
    )
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="flex max-w-[85%] min-w-0 flex-col items-end gap-1">
          {message.blocks.map((b, i) =>
            b.type === 'tool' ? (
              <ToolCall key={i} block={b} />
            ) : b.type === 'denied' ? (
              <DeniedRow key={i} block={b} />
            ) : (
              <div
                key={i}
                className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground [overflow-wrap:anywhere]"
              >
                {b.text}
              </div>
            ),
          )}
          {message.ts && <span className="text-[11px] text-muted-foreground">{clock(message.ts)}</span>}
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
          <User className="size-4" />
        </span>
      </div>
    )
  }

  if (orderBlocks(message.blocks, view).length === 0) return null

  return (
    <div className="flex gap-3">
      <SourceAvatar source={source} className="size-8 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-semibold text-foreground">{source === 'claude' ? 'Claude' : 'pi'}</span>
          {message.model && <span className="font-mono text-muted-foreground">{message.model}</span>}
          {message.ts && <span className="text-muted-foreground">{clock(message.ts)}</span>}
        </div>
        {groupTools(orderBlocks(message.blocks, view)).map((g, i) =>
          Array.isArray(g) ? (
            <div key={i} className="flex flex-col gap-1">
              {g.map((b, j) => (
                <ToolCall key={j} block={b} />
              ))}
            </div>
          ) : g.type === 'thinking' ? (
            <Thinking key={i} text={g.text} />
          ) : g.type === 'text' ? (
            <ChatMarkdown key={i} text={g.text} />
          ) : g.type === 'denied' ? (
            <DeniedRow key={i} block={g} />
          ) : null,
        )}
      </div>
    </div>
  )
}

type ToolBlock = Extract<ChatBlock, { type: 'tool' }>

/** Reasoning shows only in Detailed view, as a block above the rest of the message (T3). */
function orderBlocks(blocks: ChatBlock[], view: ChatView): ChatBlock[] {
  if (view !== 'detailed') return blocks.filter((b) => b.type !== 'thinking')
  return [...blocks.filter((b) => b.type === 'thinking'), ...blocks.filter((b) => b.type !== 'thinking')]
}

/** Runs of consecutive tool calls render as one tight stack. */
function groupTools(blocks: ChatBlock[]): (ChatBlock | ToolBlock[])[] {
  const out: (ChatBlock | ToolBlock[])[] = []
  for (const b of blocks) {
    const last = out[out.length - 1]
    if (b.type === 'tool') {
      if (Array.isArray(last)) last.push(b)
      else out.push([b])
    } else out.push(b)
  }
  return out
}

function Thinking({ text }: { text: string }) {
  const [open, setOpen] = useState(true) // open until closed
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Brain className="size-3.5" /> Reasoning
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="mt-2 border-l-2 pl-3 text-sm whitespace-pre-wrap text-muted-foreground italic [overflow-wrap:anywhere]">{text}</div>
      )}
    </div>
  )
}

function ToolCall({ block }: { block: ToolBlock }) {
  const [open, setOpen] = useState(false)
  const status = block.result === undefined ? undefined : block.isError ? 'error' : 'ok'
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background/60 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 px-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-mono text-xs font-medium">{block.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{block.summary}</span>
        {status === 'ok' && <Check className="size-3.5 shrink-0 text-success" aria-label="Succeeded" />}
        {status === 'error' && <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-label="Failed" />}
        <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t px-3 py-3">
          {block.input && <ToolPane label="Input" text={block.input} />}
          {block.result !== undefined && <ToolPane label={block.isError ? 'Error' : 'Output'} text={block.result || '(empty)'} />}
        </div>
      )}
    </div>
  )
}

function ToolPane({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</div>
      <pre className="max-h-72 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {text}
      </pre>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof MessagesSquare; title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-6" />
      </div>
      <div className="font-medium">{title}</div>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
