import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'
import { refreshSettingsAlerts } from '@/modules/settings/alerts'

import { AvailableRow, ConnectionRow, Notice, TableHead } from './ConnectionRows'
import { sampleList, sampleStatuses } from './sample'
import type { Connection, ConnectionJob, ConnectionStatus, ConnectionsList, Connector, ConnectorField } from './types'

const MODULE_ID = 'connections'

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
        const s = await invokeModule(MODULE_ID, 'check', { kind, force })
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
      const l = await invokeModule(MODULE_ID, 'list')
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
    // oxlint-disable-next-line react/set-state-in-effect -- Load configured connections from the backend before checking them.
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
        invokeModule(MODULE_ID, 'getJob', { kind }).then((job) => {
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
      const job = await invokeModule(MODULE_ID, 'runAction', { kind, action })
      setJobs((all) => ({ ...all, [kind]: job }))
    } catch (e) {
      setJobs((all) => ({
        ...all,
        [kind]: { id: 0, kind, action, state: 'failed', step: 0, steps: 1, output: '', error: message(e), startedAt: new Date().toISOString() },
      }))
    }
  }

  async function cancelJob(kind: string) {
    const job = await invokeModule(MODULE_ID, 'cancelJob', { kind }).catch(() => undefined)
    setJobs((all) => ({ ...all, [kind]: job }))
  }

  async function addWithoutFields(kind: string) {
    if (!desktop) return
    setChecking((c) => ({ ...c, [kind]: true }))
    try {
      const s = await invokeModule(MODULE_ID, 'save', { kind })
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
      <p className="-mt-4 text-sm text-muted-foreground">
        Connections marked <span className="font-medium text-foreground">Data service</span> are data sources. Their ingestion pipelines are on{' '}
        <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => navigate('/services')}>
          Services
        </button>
        .
      </p>
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
              {removing?.kind === 'claude-playwright' && ' The playwright-extension server MonoRail added to Claude Code is removed (never one you added yourself); the browser extension stays installed.'}
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
      const s = await invokeModule(MODULE_ID, 'save', { kind: connector.kind, values, secrets })
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
