import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  FlaskConical,
  GitCompare,
  Globe,
  Loader2,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  ScrollText,
  Settings2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RevealableHeader } from '@/components/layout/HeaderReveal'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'
import { takeChatHandoff } from './handoff'
import { Composer, useComposerPrefs } from './Composer'
import { SidePanel, type PanelKind } from './Panels'
import { contextUse } from './live'
import { FoldersDialog } from './FoldersDialog'
import { SystemPromptsDialog } from './SystemPromptsDialog'
import { sampleComposer, sampleSessions } from './sample'
import {
  type ComposerInfo,
  type LiveTurn,
  type SessionList,
  type SessionSource,
  type SessionSummary,
  type TurnPoll,
} from './types'
import { Conversation } from './Conversation'
import { CoordinatorEntry, SessionListView } from './SessionListView'
import { useRunningChats } from './useRunningChats'

type Filter = 'all' | SessionSource
/** A read chat untouched this long moves to Settled. */
const SETTLED_AFTER_MS = 2 * 24 * 60 * 60 * 1000
export default function AgentChatPage() {
  const desktop = isDesktop()
  const list = useModuleQuery<SessionList>('agent-chat', 'listSessions')
  const data = desktop ? list.data : sampleSessions
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  // Opened from the Agents overview: a session to show, or a new chat to start.
  const [handoff] = useState(takeChatHandoff)
  const [showSessions, setShowSessions] = useState(!handoff)
  const [selectedId, setSelectedId] = useState<string | undefined>(() => (handoff && 'open' in handoff ? handoff.open : undefined))
  const [foldersOpen, setFoldersOpen] = useState(false)
  const [promptsOpen, setPromptsOpen] = useState(false)
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

  const backendRunning = useRunningChats(desktop)
  const workingIds = useMemo(() => {
    const ids = new Set(backendRunning)
    for (const t of turns) {
      if (t.status !== 'running') continue
      ids.add(t.chatKey)
      if (t.sessionId) ids.add(`${t.sdk}:${t.sessionId}`)
    }
    return ids
  }, [backendRunning, turns])
  // The list is split the way T3 Code splits its threads: recent chats on top,
  // then Working and Settled (read, untouched for a while) at the bottom.
  const sections = useMemo(() => {
    const now = Date.now()
    const recent: SessionSummary[] = []
    const working: SessionSummary[] = []
    const settled: SessionSummary[] = []
    for (const s of visible) {
      if (workingIds.has(s.id)) working.push(s)
      else if (!s.unread && now - s.updatedAt > SETTLED_AFTER_MS) settled.push(s)
      else recent.push(s)
    }
    return { recent, working, settled }
  }, [visible, workingIds])

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
    : (sessions.find((s) => s.id === selectedId) ??
      (selectedId ? pendingSessions[selectedId] : undefined) ??
      sections.recent[0] ??
      visible[0])
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
    setShowSessions(false)
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
    <div className="flex h-full min-h-0 flex-col bg-card">
      <RevealableHeader><div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="mr-auto min-w-0 pr-3"><h1 className="text-sm font-semibold">Sessions</h1><p className="text-xs text-muted-foreground">Claude Code and pi chats in your allowed repos</p></div>
            {!desktop && (
              <Badge variant="info">
                <FlaskConical /> Sample data
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setFoldersOpen(true)}>
              <Settings2 /> Folders
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPromptsOpen(true)}>
              <ScrollText /> Prompts
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
                setShowSessions(false)
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
      </div></RevealableHeader>

      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-2 md:hidden">
        <Button variant="ghost" size="sm" onClick={() => setShowSessions((v) => !v)} aria-label={showSessions ? 'Show conversation' : 'Show sessions'}>
          {showSessions ? <MessagesSquare /> : <ArrowLeft />} {showSessions ? 'Conversation' : 'Sessions'}
        </Button>
        <Button size="sm" onClick={() => {
          setDraft({ key: `draft:${crypto.randomUUID()}`, repo: selected?.repo.path ?? composerInfo?.repos[0]?.path })
          setSendError(undefined)
          setShowSessions(false)
        }}><Plus /> New chat</Button>
      </div>

      <SystemPromptsDialog open={promptsOpen} onOpenChange={setPromptsOpen} />

      <FoldersDialog
        open={foldersOpen}
        onOpenChange={setFoldersOpen}
        onChanged={() => {
          if (desktop) void list.refresh()
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden bg-card text-card-foreground">
        {/* Session list */}
        <aside aria-label="Chat sessions" className={cn('min-h-0 w-full shrink-0 flex-col border-r md:flex md:w-80', showSessions ? 'flex' : 'hidden')}>
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
              setShowSessions(false)
              setSendError(undefined)
              setDraft({ key: `draft:${crypto.randomUUID()}`, coordinator: true })
            }}
          />
          <SessionListView
            sessions={visible}
            sections={sections}
            loading={desktop && list.loading}
            error={desktop ? list.error : undefined}
            selectedId={selected?.id}
            onSelect={(id) => {
              setDraft(undefined)
              setSelectedId(id)
              setShowSessions(false)
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
        <section aria-label="Conversation" className={cn('relative min-h-0 min-w-0 flex-1 md:flex', showSessions ? 'hidden' : 'flex')}>
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
