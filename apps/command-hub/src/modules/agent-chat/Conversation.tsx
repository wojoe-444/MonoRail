import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronRight,
  FolderGit2,
  GitBranch,
  Loader2,
  User,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AgentMochi } from '@/components/mochi'
import { cn } from '@/lib/utils'

import { ChatMarkdown } from './ChatMarkdown'
import { DeniedRow, NewChatEmpty, TurnFooter } from './Composer'
import { chatTotalView, costCalls, historyReplies, liveReplyCost } from './cost'
import { ReplyDetails, TotalChip } from './ReplyDetails'
import { turnToMessages } from './live'
import {
  SOURCE_LABEL,
  type ChatBlock,
  type ChatMessage,
  type ChatView,
  type LiveTurn,
  type SessionSource,
  type SessionSummary,
} from './types'
import { SourceAvatar } from './SourceAvatar'
import { useSessionHistory } from './useSessionHistory'

const PAGE = 150

function clock(ms?: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function Conversation({
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
  const { transcript, error } = useSessionHistory(session, skipHistory, onAttach)
  const [shown, setShown] = useState(PAGE)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

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
      <div className="min-w-0 flex-1 md:min-w-56">
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
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
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
  const subagent = subagentOf(block)
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background/60 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 px-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {subagent ? <AgentMochi name={subagent} size={20} className="-my-1" /> : <Wrench className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="shrink-0 font-mono text-xs font-medium">{subagent ?? block.name}</span>
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

/** The subagent an Agent (or older Task) tool call delegates to, if any. */
function subagentOf(block: ToolBlock): string | undefined {
  if ((block.name !== 'Agent' && block.name !== 'Task') || !block.input) return undefined
  const m = /"subagent_type"\s*:\s*"([^"]{1,80})"/.exec(block.input)
  return m?.[1]
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
