import {
  AlertTriangle,
  Aperture,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Container,
  Database,
  ExternalLink,
  GitBranch,
  Globe,
  KeyRound,
  Loader2,
  LogIn,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  SquareTerminal,
  Trash2,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isDesktop } from '@/modules/client'

import { ClaudeAccountBadge } from './ClaudeAccountBadge'
import type { ClaudeAccount } from './account'
import type { Connection, ConnectionJob, ConnectionState, ConnectionStatus, Connector } from './types'

const ICONS = { aperture: Aperture, cloud: Cloud, key: KeyRound, sparkles: Sparkles, terminal: SquareTerminal, git: GitBranch, globe: Globe, container: Container, database: Database } as const

const STATE_LOOK: Record<ConnectionState, { label: string; badge: 'success' | 'warning' | 'info' | 'destructive' | 'secondary'; tile: string }> = {
  ok: { label: 'Connected', badge: 'success', tile: 'bg-success-soft text-success-soft-foreground' },
  expired: { label: 'Expired', badge: 'warning', tile: 'bg-warning-soft text-warning-soft-foreground' },
  'needs-setup': { label: 'Not signed in', badge: 'info', tile: 'bg-info-soft text-info-soft-foreground' },
  error: { label: 'Error', badge: 'destructive', tile: 'bg-destructive-soft text-destructive-soft-foreground' },
  unavailable: { label: 'Not installed', badge: 'secondary', tile: 'bg-muted text-muted-foreground' },
}

export function Notice({ tone, children }: { tone: 'info' | 'warning' | 'destructive'; children: React.ReactNode }) {
  const look = {
    info: 'bg-info-soft text-info-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    destructive: 'bg-destructive-soft text-destructive-soft-foreground',
  }[tone]
  const Icon = tone === 'info' ? ShieldAlert : AlertTriangle
  return (
    <div className={cn('flex items-start gap-2 rounded-lg px-4 py-3 text-sm', look)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">{children}</span>
    </div>
  )
}

function ConnectorIcon({ connector, state, checking, small }: { connector: Connector; state?: ConnectionState; checking?: boolean; small?: boolean }) {
  const Icon = ICONS[connector.icon as keyof typeof ICONS] ?? KeyRound
  const tone = checking || !state ? 'bg-primary-soft text-primary-soft-foreground' : STATE_LOOK[state].tile
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-lg', small ? 'size-8' : 'size-10', tone)}>
      <Icon className={small ? 'size-4' : 'size-5'} />
    </div>
  )
}

function StateBadge({ status, checking }: { status?: ConnectionStatus; checking: boolean }) {
  if (checking && !status)
    return (
      <Badge variant="secondary">
        <Loader2 className="animate-spin" /> Checking
      </Badge>
    )
  if (!status) return null
  const look = STATE_LOOK[status.state]
  const Icon = status.state === 'ok' ? CheckCircle2 : status.state === 'error' ? XCircle : status.state === 'expired' ? AlertTriangle : undefined
  return (
    <Badge variant={look.badge}>
      {checking ? <Loader2 className="animate-spin" /> : Icon && <Icon />} {look.label}
    </Badge>
  )
}

/** What uses each connection, shown in the table. Display only; a connector missing here shows a dash. */
const USED_BY: Record<string, string> = {
  gcloud: 'Google Cloud tools',
  atlassian: 'Tasks',
  claude: 'Chat, Coordinator, Claude Stats',
  openai: 'OpenAI tools, Codex',
  pi: 'Chat',
  'pi-playwright': 'pi',
  'claude-playwright': 'Claude Code in a terminal',
  git: 'GitHub+, Chat',
  github: 'GitHub+',
  docker: 'Docker page',
  metricflow: 'Explore, agents',
}

/** The detail that says which account a connection uses, for the Account column. */
const ACCOUNT_DETAIL = /^(account|email|site|signed in to|user\.email|codex sign-in|api key|context)$/i

/**
 * The table's columns. They drop out as the table gets narrow (container
 * queries on the card): Used by and Checked first, then Status and Account,
 * whose badge then moves under the name.
 */
const COLS =
  'grid items-center gap-x-4 gap-y-3 grid-cols-1 @xl:grid-cols-[minmax(0,1fr)_auto] @2xl:grid-cols-[minmax(0,2fr)_8.5rem_minmax(0,1.3fr)_auto] @4xl:grid-cols-[minmax(0,2fr)_8.5rem_minmax(0,1.3fr)_minmax(0,1fr)_6rem_auto]'

export function TableHead() {
  return (
    <div className={cn(COLS, 'border-b px-5 py-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase')}>
      <span>Connection</span>
      <span className="hidden @2xl:block">Status</span>
      <span className="hidden @2xl:block">Account</span>
      <span className="hidden @4xl:block">Used by</span>
      <span className="hidden @4xl:block">Checked</span>
      <span className="sr-only">Actions</span>
    </div>
  )
}

/** The name cell: icon, title and one line; subconnectors are indented on a tree corner. */
function NameCell({
  connector,
  line,
  child,
  state,
  checking,
  badge,
  extra,
}: {
  connector: Connector
  line: string
  child?: boolean
  state?: ConnectionState
  checking?: boolean
  /** Shown under the name only while the Status column is hidden. */
  badge?: React.ReactNode
  /** Shown beside the name (the Claude account type). */
  extra?: React.ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', child && 'pl-7')}>
      {child && <span className="-ml-4 h-6 w-3 shrink-0 -translate-y-2 rounded-bl border-b border-l border-border" aria-hidden />}
      <ConnectorIcon connector={connector} state={state} checking={checking} small />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{connector.title}</span>
          {child && <span className="hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground @5xl:inline">Add-on</span>}
          {connector.service && (
            <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground" title="A data source: its ingestion pipelines are on Settings > Services">
              Data service
            </span>
          )}
          {extra}
        </div>
        <div className="truncate text-xs text-muted-foreground" title={line}>
          {line}
        </div>
        {badge && <div className="mt-1 flex flex-wrap gap-1.5 @2xl:hidden">{badge}</div>}
      </div>
    </div>
  )
}

interface ConnectionRowProps {
  connector: Connector
  connection: Connection
  status?: ConnectionStatus
  checking: boolean
  job?: ConnectionJob
  /** A subconnector, drawn under its parent. */
  child?: boolean
  open: boolean
  onToggle: () => void
  onCheck: () => void
  onAction: (id: string) => void
  onCancel: () => void
  onEdit: () => void
  onRemove: () => void
}

/**
 * One connection: a table row (status, account, what uses it, last check and
 * the action that fits its state), and below it, when opened, everything the
 * check found, the actions and any sign-in that is running. A running or
 * failed sign-in keeps the details open.
 */
export function ConnectionRow({ connector, connection, status, checking, job, child, open: opened, onToggle, onCheck, onAction, onCancel, onEdit, onRemove }: ConnectionRowProps) {
  const running = job?.state === 'running'
  const open = opened || running || job?.state === 'failed'
  const actions = connector.actions.filter((a) => !status || (a.showWhen.includes(status.state) && (!status.actions || status.actions.includes(a.id))))
  const attention = !!status && status.state !== 'ok'
  const main = attention ? actions[0] : undefined
  const account = status?.details.find((d) => ACCOUNT_DETAIL.test(d.label) && d.value)
  const Chevron = open ? ChevronDown : ChevronRight
  const badges = <StateBadge status={status} checking={checking} />

  return (
    <div id={`connection-${connector.kind}`} className={cn('scroll-mt-24', open && 'bg-muted/30')}>
      <div
        className={cn(COLS, 'min-h-16 cursor-pointer px-5 py-3 hover:bg-muted/40')}
        onClick={onToggle}
      >
        <NameCell
          connector={connector}
          line={status?.summary ?? (checking ? 'Checking…' : 'Not checked yet.')}
          child={child}
          state={status?.state}
          checking={checking && !status}
          badge={badges}
          extra={status?.account && <ClaudeAccountBadge account={status.account} />}
        />
        <div className="hidden min-w-0 flex-wrap gap-1.5 @2xl:flex">{badges}</div>
        <div className="hidden min-w-0 truncate font-mono text-xs @2xl:block" title={account ? `${account.label}: ${account.value}` : undefined}>
          {account?.value ?? <span className="text-muted-foreground">–</span>}
        </div>
        <div className="hidden truncate text-xs text-muted-foreground @4xl:block">{USED_BY[connector.kind] ?? '–'}</div>
        <div className="hidden text-xs text-muted-foreground tabular-nums @4xl:block">{status?.checkedAt ? formatRelative(status.checkedAt) : '–'}</div>
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-1 @xl:justify-end" onClick={(e) => e.stopPropagation()}>
          {main ? (
            <Button size="sm" onClick={() => onAction(main.id)} disabled={running || !isDesktop()} title={main.description}>
              {running && job?.action === main.id ? <Loader2 className="animate-spin" /> : <LogIn />} {main.label}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onCheck} disabled={checking || !isDesktop()}>
              <RefreshCw className={cn(checking && 'animate-spin')} /> Check
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`${connector.title} options`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onCheck}>
                <RefreshCw /> Check again
              </DropdownMenuItem>
              {connector.fields.length > 0 && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRemove} className="text-destructive">
                <Trash2 /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? `Hide ${connector.title} details` : `Show ${connector.title} details`}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Chevron className="size-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className={cn('flex flex-col gap-4 border-t border-dashed px-5 py-4', child ? '@xl:pl-[104px]' : '@xl:pl-[68px]')}>
          <div className="text-sm text-muted-foreground">{connector.description}</div>
          {status ? (
            <>
              {status.hint && <div className="text-sm">{status.hint}</div>}
              {status.account && <AccountNote account={status.account} onEdit={onEdit} />}
              {status.details.length > 0 && (
                <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm @xl:grid-cols-2 @4xl:grid-cols-4">
                  {status.details.map((d) => (
                    <div key={d.label} className="min-w-0">
                      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{d.label}</dt>
                      <dd
                        className={cn(
                          'mt-0.5 font-medium break-words',
                          d.ok === true && 'text-success-soft-foreground',
                          d.ok === false && 'text-warning-soft-foreground',
                        )}
                      >
                        {d.value ?? '–'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          ) : null}

          {job && <JobPanel job={job} onCancel={onCancel} />}

          <div className="flex flex-wrap items-center gap-2">
            {actions.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant={attention ? 'default' : 'outline'}
                onClick={() => onAction(a.id)}
                disabled={running || !isDesktop()}
                title={a.description}
              >
                {running && job?.action === a.id ? <Loader2 className="animate-spin" /> : <LogIn />} {a.label}
              </Button>
            ))}
            {connector.fields.length > 0 && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil /> Edit
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onCheck} disabled={checking || !isDesktop()}>
              <RefreshCw className={cn(checking && 'animate-spin')} /> Check
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {status?.checkedAt && `Checked ${formatRelative(status.checkedAt)}`}
              {status?.checkedAt && connection.updatedAt && connector.fields.length > 0 && ' · '}
              {connection.updatedAt && connector.fields.length > 0 && `Settings saved ${formatRelative(connection.updatedAt)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Claude: what the account type means for cost, why it was picked, and a way to change it. */
function AccountNote({ account, onEdit }: { account: ClaudeAccount; onEdit: () => void }) {
  const tone = account.type === 'unknown' ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-muted text-foreground'
  return (
    <div className={cn('flex flex-col gap-1 rounded-lg px-4 py-3 text-sm', tone)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{account.label} account</span>
        <span className="text-xs opacity-80">{account.source === 'override' ? 'set by you' : 'detected'}</span>
        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={onEdit}>
          <Pencil /> Change
        </Button>
      </div>
      <div className={account.type === 'unknown' ? undefined : 'text-muted-foreground'}>{account.billing}</div>
      <div className="text-xs opacity-80">
        {account.source === 'override' ? `MonoRail detected ${account.detected === 'unknown' ? 'no type' : account.detected}: ` : ''}
        {account.reason}
      </div>
    </div>
  )
}

function JobPanel({ job, onCancel }: { job: ConnectionJob; onCancel: () => void }) {
  if (job.state === 'running') {
    return (
      <div className="flex flex-col gap-3 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground">
        <div className="flex items-start gap-2">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {job.steps > 1 ? `Step ${Math.max(job.step, 1)} of ${job.steps}: ` : ''}
              {job.stepLabel ?? 'Working…'}
            </div>
            <div className="mt-1">{job.note ?? 'Finish signing in in the browser window that opened.'}</div>
          </div>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
            No browser? Open the sign-in page <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    )
  }
  if (job.state === 'failed' || job.state === 'cancelled') {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{job.state === 'cancelled' ? 'Cancelled.' : job.error}</span>
        </div>
        {job.output.trim() && (
          <details>
            <summary className="cursor-pointer text-xs">Output</summary>
            <pre className="mt-2 max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">{job.output.trim()}</pre>
          </details>
        )}
      </div>
    )
  }
  if (job.note) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success-soft-foreground">
        <CheckCircle2 className="size-4 shrink-0" /> {job.note}
      </div>
    )
  }
  if (job.steps > 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success-soft-foreground">
        <CheckCircle2 className="size-4 shrink-0" /> Both sign-ins finished.
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg bg-info-soft px-4 py-3 text-sm text-info-soft-foreground">
      <ShieldAlert className="size-4 shrink-0" /> Finish in the window that opened. MonoRail checks again when you come back.
    </div>
  )
}

interface AvailableRowProps {
  connector: Connector
  busy: boolean
  onAdd: () => void
  child?: boolean
}

/** A connector that is not set up. Nothing has been checked for it, so it shows no status. */
export function AvailableRow({ connector, busy, onAdd, child }: AvailableRowProps) {
  return (
    <div id={`connection-${connector.kind}`} className="flex min-h-16 scroll-mt-24 flex-col items-start gap-3 px-5 py-3 @xl:flex-row @xl:items-center">
      <div className="min-w-0 w-full flex-1 @xl:w-auto">
        <NameCell connector={connector} line={connector.description} child={child} />
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground @2xl:block">{USED_BY[connector.kind] && `Used by ${USED_BY[connector.kind]}`}</span>
      <Button size="sm" variant="outline" onClick={onAdd} disabled={busy || !isDesktop()}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />} Set up
      </Button>
    </div>
  )
}
