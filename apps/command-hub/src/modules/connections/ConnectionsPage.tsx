import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Aperture,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Container,
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

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'
import { refreshSettingsAlerts } from '@/modules/settings/alerts'

import { ClaudeAccountBadge } from './ClaudeAccountBadge'
import { sampleList, sampleStatuses } from './sample'
import type { ClaudeAccount } from './account'
import type { Connection, ConnectionJob, ConnectionState, ConnectionStatus, ConnectionsList, Connector, ConnectorField } from './types'

const MODULE_ID = 'connections'

const ICONS = { aperture: Aperture, cloud: Cloud, key: KeyRound, sparkles: Sparkles, terminal: SquareTerminal, git: GitBranch, globe: Globe, container: Container } as const

const STATE_LOOK: Record<ConnectionState, { label: string; badge: 'success' | 'warning' | 'info' | 'destructive' | 'secondary'; tile: string }> = {
  ok: { label: 'Connected', badge: 'success', tile: 'bg-success-soft text-success-soft-foreground' },
  expired: { label: 'Expired', badge: 'warning', tile: 'bg-warning-soft text-warning-soft-foreground' },
  'needs-setup': { label: 'Not signed in', badge: 'info', tile: 'bg-info-soft text-info-soft-foreground' },
  error: { label: 'Error', badge: 'destructive', tile: 'bg-destructive-soft text-destructive-soft-foreground' },
  unavailable: { label: 'Not installed', badge: 'secondary', tile: 'bg-muted text-muted-foreground' },
}

function message(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  // Electron prefixes errors thrown in the main process.
  return m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export default function ConnectionsPage() {
  const desktop = isDesktop()
  const [list, setList] = useState<ConnectionsList | undefined>(desktop ? undefined : sampleList)
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>(desktop ? {} : sampleStatuses)
  const [checking, setChecking] = useState<Record<string, boolean>>({})
  const [jobs, setJobs] = useState<Record<string, ConnectionJob | undefined>>({})
  const [loadError, setLoadError] = useState<string>()
  const [editing, setEditing] = useState<Connector>()
  const [removing, setRemoving] = useState<Connector>()

  const check = useCallback(
    async (kind: string, force = false) => {
      if (!desktop) return
      setChecking((c) => ({ ...c, [kind]: true }))
      try {
        const s = await invokeModule<ConnectionStatus>(MODULE_ID, 'check', { kind, force })
        setStatuses((all) => ({ ...all, [kind]: s }))
      } catch (e) {
        setStatuses((all) => ({ ...all, [kind]: { state: 'error', summary: message(e), details: [], added: true, checkedAt: new Date().toISOString() } }))
      } finally {
        setChecking((c) => ({ ...c, [kind]: false }))
        // The check's summary is written just after it returns; Settings alerts read it.
        setTimeout(() => void refreshSettingsAlerts(), 500)
      }
    },
    [desktop],
  )

  const load = useCallback(async () => {
    if (!desktop) return undefined
    try {
      const l = await invokeModule<ConnectionsList>(MODULE_ID, 'list')
      setList(l)
      setLoadError(undefined)
      setJobs(Object.fromEntries(l.connections.map((c) => [c.kind, c.job])))
      setStatuses((all) => ({ ...Object.fromEntries(l.connections.filter((c) => c.status).map((c) => [c.kind, c.status!])), ...all }))
      return l
    } catch (e) {
      setLoadError(message(e))
      return undefined
    }
  }, [desktop])

  // First load: list, then check the connections the user has set up (a
  // recent result is reused). Connectors that are not set up are never
  // checked: MonoRail runs nothing for a tool or account the user has not
  // asked it to look at.
  useEffect(() => {
    void load().then((l) => l?.connections.forEach((c) => void check(c.kind)))
  }, [load, check])

  // Poll running jobs (sign-ins) and re-check when one finishes.
  const runningKinds = Object.values(jobs)
    .filter((j) => j?.state === 'running')
    .map((j) => j!.kind)
    .join(',')
  useEffect(() => {
    if (!runningKinds) return
    const t = setInterval(() => {
      for (const kind of runningKinds.split(',')) {
        invokeModule<ConnectionJob | undefined>(MODULE_ID, 'getJob', { kind }).then((job) => {
          setJobs((all) => ({ ...all, [kind]: job }))
          if (job && job.state !== 'running') void check(kind, true)
        }, () => {})
      }
    }, 1000)
    return () => clearInterval(t)
  }, [runningKinds, check])

  // Coming back to the window after a sign-in the user started here (in a
  // terminal or the browser) re-checks that connection while it is not
  // connected. Nothing else is re-checked on focus.
  const statusesRef = useRef(statuses)
  const signingIn = useRef(new Set<string>())
  useEffect(() => {
    statusesRef.current = statuses
  })
  useEffect(() => {
    if (!desktop) return
    const onFocus = () => {
      for (const kind of signingIn.current) {
        const s = statusesRef.current[kind]
        if (s?.state === 'ok' || !s?.added) signingIn.current.delete(kind)
        else void check(kind, true)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [desktop, check])

  async function runAction(kind: string, action: string) {
    if (!desktop) return
    signingIn.current.add(kind)
    try {
      const job = await invokeModule<ConnectionJob>(MODULE_ID, 'runAction', { kind, action })
      setJobs((all) => ({ ...all, [kind]: job }))
    } catch (e) {
      setJobs((all) => ({
        ...all,
        [kind]: { id: 0, kind, action, state: 'failed', step: 0, steps: 1, output: '', error: message(e), startedAt: new Date().toISOString() },
      }))
    }
  }

  async function cancelJob(kind: string) {
    const job = await invokeModule<ConnectionJob>(MODULE_ID, 'cancelJob', { kind }).catch(() => undefined)
    setJobs((all) => ({ ...all, [kind]: job }))
  }

  async function addWithoutFields(kind: string) {
    if (!desktop) return
    setChecking((c) => ({ ...c, [kind]: true }))
    try {
      const s = await invokeModule<ConnectionStatus>(MODULE_ID, 'save', { kind })
      setStatuses((all) => ({ ...all, [kind]: s }))
      await load()
    } catch (e) {
      setLoadError(message(e))
    } finally {
      setChecking((c) => ({ ...c, [kind]: false }))
    }
  }

  const added = useMemo(() => new Map((list?.connections ?? []).map((c) => [c.kind, c])), [list])
  const topLevel = (list?.connectors ?? []).filter((c) => !c.parent)
  const yours = topLevel.filter((c) => added.has(c.kind))
  const available = topLevel.filter((c) => !added.has(c.kind))
  const addedSubs = (list?.connectors ?? []).filter((c) => c.parent && added.has(c.kind))
  const addedKinds = [...yours, ...addedSubs].map((c) => c.kind)
  const needsAttention = [...yours, ...addedSubs].filter((c) => statuses[c.kind] && statuses[c.kind].state !== 'ok').length

  /** A connector and its subconnectors (drawn under it, indented), as table rows. */
  function rowsFor(c: Connector, child = false): React.ReactNode[] {
    const connection = added.get(c.kind)
    const row = connection ? (
      <ConnectionRow
        key={c.kind}
        connector={c}
        connection={connection}
        status={statuses[c.kind]}
        checking={!!checking[c.kind]}
        job={jobs[c.kind]}
        child={child}
        open={open.has(c.kind)}
        onToggle={() => toggle(c.kind)}
        onCheck={() => void check(c.kind, true)}
        onAction={(a) => {
          setOpen((o) => new Set(o).add(c.kind))
          void runAction(c.kind, a)
        }}
        onCancel={() => void cancelJob(c.kind)}
        onEdit={() => setEditing(c)}
        onRemove={() => setRemoving(c)}
      />
    ) : (
      <AvailableRow
        key={c.kind}
        connector={c}
        child={child}
        busy={!!checking[c.kind]}
        onAdd={() => (c.fields.length ? setEditing(c) : void addWithoutFields(c.kind))}
      />
    )
    const subs = child ? [] : (list?.connectors ?? []).filter((s) => s.parent === c.kind)
    return [row, ...subs.flatMap((s) => rowsFor(s, true))]
  }

  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (kind: string) =>
    setOpen((o) => {
      const next = new Set(o)
      if (!next.delete(kind)) next.add(kind)
      return next
    })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Connections"
        description="Accounts MonoRail signs in with, and whether each one still works. Secrets stay encrypted on this PC."
        actions={
          <Button
            variant="outline"
            onClick={() => addedKinds.forEach((kind) => void check(kind, true))}
            disabled={!desktop || !addedKinds.length || Object.values(checking).some(Boolean)}
            title="Checks the connections you have set up"
          >
            <RefreshCw className={cn(Object.values(checking).some(Boolean) && 'animate-spin')} /> Check all
          </Button>
        }
      />

      {!desktop && <Notice tone="info">This is fictional sample data. Connections work in the desktop app.</Notice>}
      {loadError && <Notice tone="destructive">{loadError}</Notice>}
      {list && !list.encryptionAvailable && (
        <Notice tone="warning">Windows could not provide encryption, so MonoRail will not save tokens. Credential Manager entries still work.</Notice>
      )}

      {!list && !loadError && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {yours.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Your connections"
            note={needsAttention ? `${needsAttention} need${needsAttention === 1 ? 's' : ''} attention` : undefined}
          />
          <Card className="@container gap-0 py-0">
            <TableHead />
            <div className="divide-y">{yours.flatMap((c) => rowsFor(c))}</div>
          </Card>
        </section>
      )}

      {available.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading title={yours.length ? 'Add a connection' : 'Set up a connection'} />
          <p className="-mt-1 text-sm text-muted-foreground">
            MonoRail does not look for these tools or accounts on this PC until you set one up. Setting up runs its check; nothing runs for the others.
          </p>
          <Card className="@container gap-0 divide-y py-0">{available.flatMap((c) => rowsFor(c))}</Card>
        </section>
      )}

      {editing && list && (
        <SetupDialog
          connector={editing}
          connection={added.get(editing.kind)}
          platform={list.platform}
          onClose={() => setEditing(undefined)}
          onSaved={async (s) => {
            setStatuses((all) => ({ ...all, [editing.kind]: s }))
            setEditing(undefined)
            await load()
          }}
        />
      )}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.title}?</DialogTitle>
            <DialogDescription>
              MonoRail forgets this connection and any token it saved. Accounts and tools set up outside MonoRail (gcloud, Claude Code, pi, git, Credential
              Manager) are not signed out or changed, and pi keeps its current scoped models.
              {removing?.kind === 'pi-playwright' && ' The use-my-browser skill MonoRail wrote for pi is removed; pi-playwright and the browser extension stay installed.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const kind = removing!.kind
                setRemoving(undefined)
                try {
                  await invokeModule(MODULE_ID, 'remove', { kind })
                } catch (e) {
                  setLoadError(message(e))
                }
                setStatuses(({ [kind]: _gone, ...rest }) => rest)
                setTimeout(() => void refreshSettingsAlerts(), 500)
                signingIn.current.delete(kind)
                await load()
              }}
            >
              <Trash2 /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</h2>
      {note && <span className="text-xs font-medium text-warning-soft-foreground">{note}</span>}
    </div>
  )
}

function Notice({ tone, children }: { tone: 'info' | 'warning' | 'destructive'; children: React.ReactNode }) {
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
  atlassian: 'Jira+',
  claude: 'Chat, Coordinator, Claude Stats',
  openai: 'OpenAI tools, Codex',
  pi: 'Chat',
  'pi-playwright': 'pi',
  git: 'GitHub+, Chat',
  github: 'GitHub+',
  docker: 'Docker page',
}

/** The detail that says which account a connection uses, for the Account column. */
const ACCOUNT_DETAIL = /^(account|email|site|signed in to|user\.email|codex sign-in|api key|context)$/i

/**
 * The table's columns. They drop out as the table gets narrow (container
 * queries on the card): Used by and Checked first, then Status and Account,
 * whose badge then moves under the name.
 */
const COLS =
  'grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_auto] @2xl:grid-cols-[minmax(0,2fr)_8.5rem_minmax(0,1.3fr)_auto] @4xl:grid-cols-[minmax(0,2fr)_8.5rem_minmax(0,1.3fr)_minmax(0,1fr)_6rem_auto]'

function TableHead() {
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
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{connector.title}</span>
          {child && <span className="hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground @5xl:inline">Add-on</span>}
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
function ConnectionRow({ connector, connection, status, checking, job, child, open: opened, onToggle, onCheck, onAction, onCancel, onEdit, onRemove }: ConnectionRowProps) {
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
        <div className={cn('flex flex-col gap-4 border-t border-dashed py-4 pr-5', child ? 'pl-[104px]' : 'pl-[68px]')}>
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
function AvailableRow({ connector, busy, onAdd, child }: AvailableRowProps) {
  return (
    <div id={`connection-${connector.kind}`} className="flex min-h-16 scroll-mt-24 items-center gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <NameCell connector={connector} line={connector.description} child={child} />
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground @2xl:block">{USED_BY[connector.kind] && `Used by ${USED_BY[connector.kind]}`}</span>
      <Button size="sm" variant="outline" onClick={onAdd} disabled={busy || !isDesktop()}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />} Set up
      </Button>
    </div>
  )
}

function visible(field: ConnectorField, values: Record<string, string>): boolean {
  return !field.showIf || Object.entries(field.showIf).every(([k, v]) => values[k] === v)
}

interface SetupDialogProps {
  connector: Connector
  connection?: Connection
  platform: string
  onClose: () => void
  onSaved: (s: ConnectionStatus) => void | Promise<void>
}

function SetupDialog({ connector, connection, platform, onClose, onSaved }: SetupDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(connector.fields.filter((f) => f.type !== 'secret').map((f) => [f.key, connection?.values[f.key] || f.defaultValue || ''])),
  )
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [entries, setEntries] = useState<{ target: string; userName: string }[]>()
  const [entriesError, setEntriesError] = useState<string>()

  async function browseEntries() {
    setEntriesError(undefined)
    try {
      setEntries(await invokeModule(MODULE_ID, 'listWindowsCredentials'))
    } catch (e) {
      setEntriesError(message(e))
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(undefined)
    try {
      const s = await invokeModule<ConnectionStatus>(MODULE_ID, 'save', { kind: connector.kind, values, secrets })
      await onSaved(s)
    } catch (err) {
      setError(message(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>
              {connection ? 'Edit' : 'Set up'} {connector.title}
            </DialogTitle>
            <DialogDescription>{connector.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {connector.fields
              .filter((f) => visible(f, values))
              .map((f) => (
                <div key={f.key} className="flex flex-col gap-2">
                  <Label htmlFor={`cf-${f.key}`}>{f.label}</Label>
                  {f.type === 'select' ? (
                    <NativeSelect id={`cf-${f.key}`} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value} disabled={o.value === 'wincred' && platform !== 'win32'}>
                          {o.label}
                          {o.value === 'wincred' && platform !== 'win32' ? ' (Windows only)' : ''}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : f.type === 'secret' ? (
                    <Input
                      id={`cf-${f.key}`}
                      type="password"
                      autoComplete="off"
                      placeholder={connection?.secretsSet[f.key] ? 'Saved. Leave blank to keep it.' : f.placeholder}
                      value={secrets[f.key] ?? ''}
                      onChange={(e) => setSecrets({ ...secrets, [f.key]: e.target.value })}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id={`cf-${f.key}`}
                        placeholder={f.placeholder}
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      />
                      {f.credentialPicker && platform === 'win32' && (
                        <Button type="button" variant="outline" onClick={() => void browseEntries()}>
                          Browse
                        </Button>
                      )}
                    </div>
                  )}
                  {f.credentialPicker && entries && (
                    <NativeSelect
                      aria-label="Credential Manager entries"
                      value=""
                      onChange={(e) => {
                        const entry = entries.find((x) => x.target === e.target.value)
                        if (entry) setValues({ ...values, [f.key]: entry.target })
                      }}
                    >
                      <option value="">{entries.length ? `Pick one of ${entries.length} entries…` : 'No generic credentials found'}</option>
                      {entries.map((x) => (
                        <option key={x.target} value={x.target}>
                          {x.target}
                          {x.userName ? ` (${x.userName})` : ''}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                  {f.credentialPicker && entriesError && <p className="text-xs text-destructive">{entriesError}</p>}
                  {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </div>
              ))}
          </div>
          {error && <Notice tone="destructive">{error}</Notice>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save and check
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
