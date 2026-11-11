import { useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Ban, FolderGit2, GitBranch, Loader2, Lock, SendHorizontal, ShieldAlert, Square } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { formatDuration, formatTokens, formatUsd, turnCost } from './live'
import type { ChatBlock, ChatMode, ChatView, ComposerInfo, LiveTurn, SessionSource } from './types'

const EFFORT_LABEL: Record<string, string> = {
  default: 'Default effort',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

// ---------------------------------------------------------------------------
// Remembered choices (this machine only)

const MODEL_KEY: Record<SessionSource, string> = { claude: 'commandHub.agentChat.model', pi: 'commandHub.agentChat.model.pi' }
const EFFORT_KEY = 'commandHub.agentChat.effort'
const SDK_KEY = 'commandHub.agentChat.sdk'
const VIEW_KEY = 'commandHub.agentChat.view'

export function modelsFor(info: ComposerInfo | undefined, sdk: SessionSource) {
  return (sdk === 'pi' ? info?.piModels : info?.models) ?? [{ id: 'default', label: 'Default' }]
}

export function useComposerPrefs(info: ComposerInfo | undefined) {
  const [models, setModels] = useState<Record<SessionSource, string>>(() => ({
    claude: localStorage.getItem(MODEL_KEY.claude) ?? 'default',
    pi: localStorage.getItem(MODEL_KEY.pi) ?? 'default',
  }))
  const [effort, setEffortState] = useState(() => localStorage.getItem(EFFORT_KEY) ?? 'default')
  const [newSdk, setNewSdkState] = useState<SessionSource>(() => (localStorage.getItem(SDK_KEY) === 'pi' ? 'pi' : 'claude'))
  const [mode, setMode] = useState<ChatMode>('ask') // Ask is the default, every time
  const [view, setViewState] = useState<ChatView>(() => (localStorage.getItem(VIEW_KEY) === 'detailed' ? 'detailed' : 'plain'))
  const validEffort = info?.efforts.includes(effort) ? effort : 'default'
  return {
    /** The SDK a new chat starts with (remembered). */
    newSdk,
    setNewSdk: (v: SessionSource) => {
      localStorage.setItem(SDK_KEY, v)
      setNewSdkState(v)
    },
    modelFor: (sdk: SessionSource) => (modelsFor(info, sdk).some((m) => m.id === models[sdk]) ? models[sdk] : 'default'),
    setModel: (sdk: SessionSource, v: string) => {
      localStorage.setItem(MODEL_KEY[sdk], v)
      setModels((m) => ({ ...m, [sdk]: v }))
    },
    effort: validEffort,
    setEffort: (v: string) => {
      localStorage.setItem(EFFORT_KEY, v)
      setEffortState(v)
    },
    mode,
    setMode,
    /** Plain (default) or Detailed; remembered. */
    view,
    setView: (v: ChatView) => {
      localStorage.setItem(VIEW_KEY, v)
      setViewState(v)
    },
  }
}

export type ComposerPrefs = ReturnType<typeof useComposerPrefs>

// ---------------------------------------------------------------------------
// Composer + status bar

export function Composer({
  info,
  prefs,
  source,
  isNew,
  repo,
  onRepo,
  branch,
  running,
  lastTurn,
  error,
  initialText,
  onSend,
  onStop,
  context,
}: {
  info?: ComposerInfo
  prefs: ComposerPrefs
  /** The chat's SDK; a chat that has started keeps it. */
  source: SessionSource
  isNew: boolean
  repo?: string
  onRepo?: (path: string) => void
  branch?: string
  running?: LiveTurn
  /** The chat's newest turn sent from this page; its cost shows in the status bar. */
  lastTurn?: LiveTurn
  error?: string
  /** Text the composer starts with (a prompt handed over from the Agents page). Never sent by itself. */
  initialText?: string
  onSend: (prompt: string) => Promise<boolean>
  onStop: () => void
  context?: { used: number; window?: number }
}) {
  const [text, setText] = useState(initialText ?? '')
  const [sending, setSending] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const sdk = info?.sdks.find((s) => s.id === source)
  const ready = !!sdk?.ready
  const canSend = ready && !sending && text.trim().length > 0 && (!isNew || !!repo)

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const ok = await onSend(text)
    setSending(false)
    if (ok) setText('')
    area.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  const placeholder = !info
    ? 'Loading…'
    : !ready
      ? (sdk?.reason ?? 'Sending is not available.')
      : isNew && !repo
        ? 'Pick a project for this chat first.'
        : prefs.mode === 'ask'
          ? 'Ask about this repo. Ask mode only reads files.'
          : source === 'pi'
            ? 'Tell pi what to do. It can read, edit and write files inside this repo.'
            : 'Tell the agent what to do. Anything that needs approval is denied.'

  return (
    <div className="shrink-0 border-t px-4 pt-3 pb-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-2 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring">
          <textarea
            ref={area}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={!ready}
            placeholder={placeholder}
            aria-label="Message"
            className="max-h-48 min-h-12 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Model"
              value={prefs.modelFor(source)}
              onChange={(e) => prefs.setModel(source, e.target.value)}
              className="w-36 [&_select]:h-8 [&_select]:text-xs"
              disabled={!info}
            >
              {modelsFor(info, source).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === 'default' ? 'Default model' : m.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Effort"
              value={prefs.effort}
              onChange={(e) => prefs.setEffort(e.target.value)}
              className="w-36 [&_select]:h-8 [&_select]:text-xs"
              disabled={!info}
            >
              {(info?.efforts ?? ['default']).map((e) => (
                <option key={e} value={e}>
                  {EFFORT_LABEL[e] ?? e}
                </option>
              ))}
            </NativeSelect>
            <span className="flex-1" />
            {running ? (
              <Button size="sm" variant="outline" onClick={onStop} aria-label="Stop">
                <Square className="fill-current" /> Stop
              </Button>
            ) : (
              <Button size="icon" className="size-8" disabled={!canSend} onClick={() => void send()} aria-label="Send">
                {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
              </Button>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          {isNew ? (
            <NativeSelect
              aria-label="Project"
              value={repo ?? ''}
              onChange={(e) => onRepo?.(e.target.value)}
              className="w-48 [&_select]:h-7 [&_select]:text-xs"
            >
              <option value="" disabled>
                Choose a project…
              </option>
              {(info?.repos ?? []).map((r) => (
                <option key={r.path} value={r.path} title={r.path}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          ) : (
            branch && (
              <span className="inline-flex items-center gap-1">
                <GitBranch className="size-3.5" /> {branch}
              </span>
            )
          )}
          <SdkToggle info={info} source={source} locked={!isNew} onChange={prefs.setNewSdk} />
          <Segmented<ChatMode>
            aria-label="Mode"
            value={prefs.mode}
            onChange={prefs.setMode}
            className="h-7 [&>button]:h-5 [&>button]:px-2 [&>button]:text-xs"
            options={[
              { value: 'ask', label: 'Ask' },
              { value: 'agent', label: 'Agent' },
            ]}
          />
          <Segmented<ChatView>
            aria-label="View"
            value={prefs.view}
            onChange={prefs.setView}
            className="h-7 [&>button]:h-5 [&>button]:px-2 [&>button]:text-xs"
            options={[
              { value: 'plain', label: 'Plain' },
              { value: 'detailed', label: 'Detailed' },
            ]}
          />
          <span className="flex-1" />
          {running ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Working… <RunningCost turn={running} />
            </span>
          ) : (
            lastTurn && <LastTurnCost turn={lastTurn} />
          )}
          {context && <ContextRing used={context.used} window={context.window} />}
        </div>
      </div>
    </div>
  )
}

/** Spend so far in a running turn: the calls with a logged cost (pi), or the result once it lands. */
function RunningCost({ turn }: { turn: LiveTurn }) {
  const result = [...turn.events].reverse().find((e) => e.t === 'result')
  if (result?.t === 'result' && result.costUsd !== undefined) return <span className="tabular-nums">{formatUsd(result.costUsd)}</span>
  const logged = turn.events.reduce((n, e) => n + (e.t === 'usage' ? (e.costUsd ?? 0) : 0), 0)
  return logged > 0 ? <span className="tabular-nums">{formatUsd(logged)} so far</span> : null
}

function LastTurnCost({ turn }: { turn: LiveTurn }) {
  const c = turnCost(turn)
  if (!c || c.turnUsd === undefined) return null
  return <span className="tabular-nums">Last turn {formatUsd(c.turnUsd)}</span>
}

/** Claude or pi for a new chat. A chat that has started keeps its SDK, shown locked. */
function SdkToggle({
  info,
  source,
  locked,
  onChange,
}: {
  info?: ComposerInfo
  source: SessionSource
  locked: boolean
  onChange: (sdk: SessionSource) => void
}) {
  const sdks = info?.sdks ?? []
  return (
    <div role="radiogroup" aria-label="SDK" className="inline-flex h-7 items-center gap-1 rounded-lg border bg-muted p-1">
      {sdks.map((s) => {
        const active = s.id === source
        const disabled = locked ? !active : !s.ready
        const button = (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={disabled}
            onClick={() => !disabled && !active && onChange(s.id)}
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded-md px-2 text-xs font-medium',
              active ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {locked && active && <Lock className="size-3" />}
            {s.label}
          </button>
        )
        const tip = locked ? (active ? 'This chat keeps the SDK it started with.' : undefined) : s.ready ? undefined : s.reason
        if (!tip) return button
        return (
          <Tooltip key={s.id}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent className="max-w-xs">{tip}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

/** How much of the model's context window the last request used (input + cache tokens). */
export function ContextRing({ used, window }: { used: number; window?: number }) {
  const pct = window ? Math.min(1, used / window) : undefined
  const r = 7
  const c = 2 * Math.PI * r
  const label = window
    ? `Context: ${used.toLocaleString()} of ${window.toLocaleString()} tokens (${Math.round((pct ?? 0) * 100)}%) used by the last request, counting input and cache tokens.`
    : `Context: ${used.toLocaleString()} tokens used by the last request, counting input and cache tokens. The window size arrives when the turn ends.`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 tabular-nums" aria-label={label}>
          <svg viewBox="0 0 18 18" className="size-4 -rotate-90" aria-hidden>
            <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
            {pct !== undefined && (
              <circle
                cx="9"
                cy="9"
                r={r}
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${pct * c} ${c}`}
                className={pct > 0.8 ? 'stroke-warning' : 'stroke-primary'}
              />
            )}
          </svg>
          {formatTokens(used)}
          {window ? ` / ${formatTokens(window)}` : ''}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{label}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Thread pieces for live turns

export function DeniedRow({ block }: { block: Extract<ChatBlock, { type: 'denied' }> }) {
  const Icon = block.kind === 'Denied' ? ShieldAlert : Ban
  return (
    <div className="flex w-full items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{block.kind}</span>
          <span className="font-mono text-xs">{block.tool}</span>
          {block.summary && <span className="truncate font-mono text-xs opacity-80">{block.summary}</span>}
        </div>
        <div className="text-xs opacity-90">{block.reason}</div>
      </div>
    </div>
  )
}

const END_LABEL: Record<string, string> = {
  stopped: 'Stopped',
  timed_out: 'Timed out after 30 minutes',
  failed: 'Failed',
}

/** Ends each turn: its duration and a cost badge. */
export function TurnFooter({ turn }: { turn: LiveTurn }) {
  if (turn.status === 'running') return null
  const cost = turnCost(turn)
  const duration = turn.endedAt ? formatDuration(turn.endedAt - turn.startedAt) : undefined
  return (
    <div className="flex items-center gap-2 pl-11 text-xs text-muted-foreground">
      {END_LABEL[turn.status] && <Badge variant={turn.status === 'stopped' ? 'secondary' : 'warning'}>{END_LABEL[turn.status]}</Badge>}
      {duration && <span className="tabular-nums">{duration}</span>}
      {cost?.exact && cost.turnUsd !== undefined && (
        <Badge variant="outline" className="tabular-nums" title="Estimated cost of this turn, as Claude Code reports it">
          {formatUsd(cost.turnUsd)}
        </Badge>
      )}
      {cost && !cost.exact && cost.sessionUsd !== undefined && (
        <Badge variant="outline" className="tabular-nums" title="Claude Code reported the session's running total; this turn's own share is not known">
          Session so far {formatUsd(cost.sessionUsd)} (this turn unknown)
        </Badge>
      )}
    </div>
  )
}

export function NewChatEmpty({ repoName, sdk }: { repoName?: string; sdk: SessionSource }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <FolderGit2 className="size-6" />
      </div>
      <div className="font-medium">{repoName ? `New chat in ${repoName}` : 'New chat'}</div>
      <p className="max-w-sm text-sm text-muted-foreground">
        {sdk === 'pi'
          ? "Each message runs one turn of pi in the project's folder. Ask mode only reads files; Agent mode can also edit and write files inside the repo. pi never gets shell commands here."
          : "Each message runs one turn of Claude in the project's folder. Ask mode only reads files; Agent mode follows the repo's own permission rules, and anything that needs approval is denied."}
      </p>
    </div>
  )
}
