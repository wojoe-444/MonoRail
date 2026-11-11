import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronRight,
  Copy,
  FlaskConical,
  FolderGit2,
  GitBranch,
  Loader2,
  MessagesSquare,
  RefreshCw,
  Search,
  SendHorizontal,
  Sparkles,
  User,
  Wrench,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'

import { ChatMarkdown } from './ChatMarkdown'
import { sampleSessions, sampleTranscripts } from './sample'
import {
  SOURCE_LABEL,
  type ChatBlock,
  type ChatMessage,
  type SessionList,
  type SessionSource,
  type SessionSummary,
  type SessionTranscript,
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

function dayGroup(ms: number): string {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const day = 86_400_000
  if (ms >= start.getTime()) return 'Today'
  if (ms >= start.getTime() - day) return 'Yesterday'
  if (ms >= start.getTime() - 6 * day) return 'Previous 7 days'
  if (ms >= start.getTime() - 29 * day) return 'Previous 30 days'
  return 'Older'
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
  const [selectedId, setSelectedId] = useState<string>()

  const sessions = useMemo(() => data?.sessions ?? [], [data])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions.filter(
      (s) =>
        (filter === 'all' || s.source === filter) &&
        (!q || `${s.title} ${s.preview} ${s.project} ${s.model ?? ''} ${s.branch ?? ''}`.toLowerCase().includes(q)),
    )
  }, [sessions, filter, query])

  const selected = sessions.find((s) => s.id === selectedId) ?? visible[0]
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
        description="Every Claude Code and pi session on this machine, read from their local logs."
        actions={
          <>
            {!desktop && (
              <Badge variant="info">
                <FlaskConical /> Sample data
              </Badge>
            )}
            {desktop && (
              <Button variant="outline" size="sm" onClick={() => void list.refresh()} disabled={list.fetching}>
                {list.fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Refresh
              </Button>
            )}
          </>
        }
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
          </div>
          <SessionListView
            sessions={visible}
            loading={desktop && list.loading}
            error={desktop ? list.error : undefined}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            sources={data?.sources}
            filtered={sessions.length > 0}
          />
        </aside>

        {/* Conversation */}
        <section className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <Conversation key={selected.id} session={selected} />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title={desktop && list.loading ? 'Reading session logs…' : 'No session selected'}
              text="Pick a session on the left to read it here."
            />
          )}
        </section>
      </div>
    </div>
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
}: {
  sessions: SessionSummary[]
  loading: boolean
  error?: Error
  selectedId?: string
  onSelect: (id: string) => void
  sources?: SessionList['sources']
  filtered: boolean
}) {
  const groups = useMemo(() => {
    const out: { label: string; items: SessionSummary[] }[] = []
    for (const s of sessions) {
      const label = dayGroup(s.updatedAt)
      const g = out[out.length - 1]
      if (g?.label === label) g.items.push(s)
      else out.push({ label, items: [s] })
    }
    return out
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
  if (sessions.length === 0) {
    const missing = sources?.filter((s) => !s.found).map((s) => s.label)
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {filtered ? 'No sessions match.' : 'No sessions found yet.'}
        {!filtered && missing && missing.length > 0 && (
          <p className="mt-2 text-xs">No logs found for {missing.join(' or ')} on this machine.</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {groups.map((g) => (
        <div key={g.label} className="mb-2">
          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.label}</div>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((s) => {
              const active = s.id === selectedId
              return (
                <li key={s.id}>
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
                        <span className="flex-1 truncate text-sm font-medium">{s.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{relative(s.updatedAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <span className="truncate">{s.project}</span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0">{SOURCE_LABEL[s.source]}</span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
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

function Conversation({ session }: { session: SessionSummary }) {
  const desktop = isDesktop()
  // The browser dev server has no backend: start from the fictional transcript.
  const [transcript, setTranscript] = useState<SessionTranscript | undefined>(() =>
    desktop ? undefined : (sampleTranscripts[session.id] ?? { id: session.id, messages: [] }),
  )
  const [error, setError] = useState<Error>()
  const [shown, setShown] = useState(PAGE)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    if (!desktop) return
    let live = true
    invokeModule<SessionTranscript>('agent-chat', 'getSession', { id: session.id }).then(
      (t) => live && setTranscript(t),
      (e: unknown) => live && setError(e instanceof Error ? e : new Error(String(e))),
    )
    return () => {
      live = false
    }
  }, [desktop, session.id, session.updatedAt])

  const messages = transcript?.messages ?? []
  const hidden = Math.max(0, messages.length - shown)
  const visible = hidden ? messages.slice(hidden) : messages

  // Open at the latest message, like a chat app.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [transcript])

  function showEarlier() {
    const el = scroller.current
    const before = el ? el.scrollHeight - el.scrollTop : 0
    stickToBottom.current = false
    setShown((n) => n + PAGE)
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before
    })
  }

  return (
    <>
      <ConversationHeader session={session} />
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
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
          {transcript && messages.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">This session has no messages to show.</div>
          )}
          {hidden > 0 && (
            <Button variant="outline" size="sm" className="self-center" onClick={showEarlier}>
              Show {Math.min(hidden, PAGE)} earlier messages
            </Button>
          )}
          {visible.map((m, i) => (
            <MessageView key={hidden + i} message={m} source={session.source} />
          ))}
        </div>
      </div>
      <Composer session={session} />
    </>
  )
}

function ConversationHeader({ session }: { session: SessionSummary }) {
  return (
    <div className="flex min-h-16 shrink-0 items-center gap-3 border-b px-6 py-3">
      <SourceAvatar source={session.source} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{session.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title={session.cwd}>
            <FolderGit2 className="size-3.5" /> {session.project}
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

function MessageView({ message, source }: { message: ChatMessage; source: SessionSource }) {
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

  return (
    <div className="flex gap-3">
      <SourceAvatar source={source} className="size-8 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-semibold text-foreground">{source === 'claude' ? 'Claude' : 'pi'}</span>
          {message.model && <span className="font-mono text-muted-foreground">{message.model}</span>}
          {message.ts && <span className="text-muted-foreground">{clock(message.ts)}</span>}
        </div>
        {groupTools(message.blocks).map((g, i) =>
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
          ) : null,
        )}
      </div>
    </div>
  )
}

type ToolBlock = Extract<ChatBlock, { type: 'tool' }>

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
  const [open, setOpen] = useState(false)
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Brain className="size-3.5" /> Thinking
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

/** The usual chat composer, read-only for now: transcripts come from the logs. */
function Composer({ session }: { session: SessionSummary }) {
  const [copied, setCopied] = useState(false)
  const command =
    session.source === 'claude'
      ? `${session.cwd ? `cd "${session.cwd}" && ` : ''}claude --resume ${session.sessionId}`
      : undefined

  async function copy() {
    if (!command) return
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="shrink-0 border-t p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border bg-muted/50 py-2 pr-2 pl-4">
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          Read-only. {command ? 'Continue this session in Claude Code.' : 'Continue this session in pi.'}
        </span>
        {command && (
          <Button variant="outline" size="sm" onClick={() => void copy()} title={command}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy resume command'}
          </Button>
        )}
        <Button size="icon" className="size-8" disabled aria-label="Send (not available)">
          <SendHorizontal />
        </Button>
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
