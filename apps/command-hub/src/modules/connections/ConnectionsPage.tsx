import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  KeyRound,
  Loader2,
  LogIn,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'

import { sampleList, sampleStatuses } from './sample'
import type { Connection, ConnectionJob, ConnectionState, ConnectionStatus, ConnectionsList, Connector, ConnectorField } from './types'

const MODULE_ID = 'connections'

const ICONS = { cloud: Cloud, key: KeyRound, sparkles: Sparkles } as const

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

  // First load: list, then check every connector (added ones show their
  // status, the others show what was detected before they are added).
  useEffect(() => {
    void load().then((l) => l?.connectors.forEach((c) => void check(c.kind)))
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

  // Coming back to the window (e.g. after signing in in a terminal or the
  // browser) re-checks whatever was not connected.
  const statusesRef = useRef(statuses)
  useEffect(() => {
    statusesRef.current = statuses
  })
  useEffect(() => {
    if (!desktop) return
    const onFocus = () => {
      for (const [kind, s] of Object.entries(statusesRef.current)) if (s.state !== 'ok') void check(kind, true)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [desktop, check])

  async function runAction(kind: string, action: string) {
    if (!desktop) return
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
  const yours = (list?.connectors ?? []).filter((c) => added.has(c.kind))
  const available = (list?.connectors ?? []).filter((c) => !added.has(c.kind))
  const needsAttention = yours.filter((c) => statuses[c.kind] && statuses[c.kind].state !== 'ok').length

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Configure"
        title="Connections"
        description="Accounts MonoRail signs in with, and whether each one still works. Secrets stay encrypted on this PC."
        actions={
          <Button variant="outline" onClick={() => list?.connectors.forEach((c) => void check(c.kind, true))} disabled={!desktop || Object.values(checking).some(Boolean)}>
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
        <section className="flex flex-col gap-4">
          <SectionHeading
            title="Your connections"
            note={needsAttention ? `${needsAttention} need${needsAttention === 1 ? 's' : ''} attention` : undefined}
          />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {yours.map((c) => (
              <ConnectionCard
                key={c.kind}
                connector={c}
                connection={added.get(c.kind)!}
                status={statuses[c.kind]}
                checking={!!checking[c.kind]}
                job={jobs[c.kind]}
                onCheck={() => void check(c.kind, true)}
                onAction={(a) => void runAction(c.kind, a)}
                onCancel={() => void cancelJob(c.kind)}
                onEdit={() => setEditing(c)}
                onRemove={() => setRemoving(c)}
              />
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeading title={yours.length ? 'Add a connection' : 'Set up a connection'} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {available.map((c) => (
              <AvailableCard
                key={c.kind}
                connector={c}
                detected={statuses[c.kind]}
                busy={!!checking[c.kind]}
                onAdd={() => (c.fields.length ? setEditing(c) : void addWithoutFields(c.kind))}
              />
            ))}
          </div>
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
              MonoRail forgets this connection and any token it saved. Accounts signed in outside MonoRail (gcloud, Claude Code, Credential Manager) are not
              signed out.
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
                await load()
                void check(kind, true)
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

function ConnectorIcon({ connector, state, checking }: { connector: Connector; state?: ConnectionState; checking?: boolean }) {
  const Icon = ICONS[connector.icon as keyof typeof ICONS] ?? KeyRound
  const tone = checking || !state ? 'bg-primary-soft text-primary-soft-foreground' : STATE_LOOK[state].tile
  return (
    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tone)}>
      <Icon className="size-5" />
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

interface ConnectionCardProps {
  connector: Connector
  connection: Connection
  status?: ConnectionStatus
  checking: boolean
  job?: ConnectionJob
  onCheck: () => void
  onAction: (id: string) => void
  onCancel: () => void
  onEdit: () => void
  onRemove: () => void
}

function ConnectionCard({ connector, connection, status, checking, job, onCheck, onAction, onCancel, onEdit, onRemove }: ConnectionCardProps) {
  const running = job?.state === 'running'
  const actions = connector.actions.filter((a) => !status || a.showWhen.includes(status.state))
  const attention = status && status.state !== 'ok'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <ConnectorIcon connector={connector} state={status?.state} checking={checking && !status} />
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {connector.title} <StateBadge status={status} checking={checking} />
            </CardTitle>
            <CardDescription className="mt-1">{connector.description}</CardDescription>
          </div>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`${connector.title} options`}>
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
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-4">
        {status ? (
          <>
            <div>
              <div className="text-sm font-medium">{status.summary}</div>
              {status.hint && <div className="mt-1 text-sm text-muted-foreground">{status.hint}</div>}
            </div>
            {status.details.length > 0 && (
              <dl className="flex flex-col divide-y text-sm">
                {status.details.map((d) => (
                  <div key={d.label} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd
                      className={cn(
                        'min-w-0 truncate text-right font-medium',
                        d.ok === true && 'text-success-soft-foreground',
                        d.ok === false && 'text-warning-soft-foreground',
                      )}
                      title={d.value}
                    >
                      {d.value ?? '–'}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking…
          </div>
        )}

        {job && <JobPanel job={job} onCancel={onCancel} />}

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <Button
              key={a.id}
              variant={attention ? 'default' : 'outline'}
              onClick={() => onAction(a.id)}
              disabled={running || !isDesktop()}
              title={a.description}
            >
              {running && job?.action === a.id ? <Loader2 className="animate-spin" /> : <LogIn />} {a.label}
            </Button>
          ))}
          {connector.fields.length > 0 && attention && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
          )}
          <Button variant="ghost" onClick={onCheck} disabled={checking || !isDesktop()}>
            <RefreshCw className={cn(checking && 'animate-spin')} /> Check
          </Button>
          {status?.checkedAt && <span className="ml-auto text-xs text-muted-foreground">Checked {formatRelative(status.checkedAt)}</span>}
        </div>
        {connection.updatedAt && connector.fields.length > 0 && (
          <div className="text-xs text-muted-foreground">Settings saved {formatRelative(connection.updatedAt)}</div>
        )}
      </CardContent>
    </Card>
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
            <div className="mt-1">Finish signing in in the browser window that opened.</div>
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
          <span className="break-words">{job.state === 'cancelled' ? 'Sign-in cancelled.' : job.error}</span>
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

function AvailableCard({ connector, detected, busy, onAdd }: { connector: Connector; detected?: ConnectionStatus; busy: boolean; onAdd: () => void }) {
  // For detect-only connectors (no fields) show what was found on this PC.
  const showDetected = connector.fields.length === 0 && detected
  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <ConnectorIcon connector={connector} />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{connector.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{connector.description}</div>
          </div>
        </div>
        {showDetected && (
          <div className="flex items-center gap-2 text-sm">
            <StateBadge status={detected} checking={busy} />
            <span className="min-w-0 truncate text-muted-foreground">{detected.summary}</span>
          </div>
        )}
        <div>
          <Button onClick={onAdd} disabled={busy || !isDesktop()}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Set up
          </Button>
        </div>
      </CardContent>
    </Card>
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
