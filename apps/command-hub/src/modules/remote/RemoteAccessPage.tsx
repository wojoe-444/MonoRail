import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, BookOpen, Check, CheckCircle2, Copy, Globe, Loader2, Lock, Monitor, Plus, RefreshCw, ShieldCheck, Smartphone, Tablet, Terminal, X } from 'lucide-react'
import QRCode from 'qrcode'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { hasBackends, hasLocalScreen, invokeModule, useModuleQuery } from '@/modules/client'
import { openWiki } from '@/modules/wiki/store'

import { sampleStatus } from './sample'
import type { RemoteAuditEntry, RemoteDevice, RemoteStatus } from './types'

const POLL_MS = 30_000
const PAIR_POLL_MS = 2_000

export default function RemoteAccessPage() {
  const backends = hasBackends()
  const local = hasLocalScreen()
  const query = useModuleQuery<RemoteStatus>('remote', 'getStatus', undefined, { enabled: local })
  const status = query.data ?? (backends ? undefined : sampleStatus)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const [pair, setPair] = useState<{ url: string; expiresAt: number; devices: number }>()
  // The phone joined: the code closes and the new device shows.
  const pairOpen = !!pair && !!status && status.devices.length <= pair.devices

  const { reload } = query
  useEffect(() => {
    if (!local) return
    const t = setInterval(() => void reload(), pairOpen ? PAIR_POLL_MS : POLL_MS)
    return () => clearInterval(t)
  }, [local, reload, pairOpen])

  /** Run a backend method that returns the new status. */
  const act = useCallback(
    async (name: string, method: string, args?: unknown) => {
      if (!local) return
      setBusy(name)
      setError(undefined)
      try {
        await invokeModule('remote', method, args)
        await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(undefined)
      }
    },
    [local, reload],
  )


  async function startPairing() {
    if (!local || !status) return
    setBusy('pair')
    setError(undefined)
    try {
      const p = await invokeModule<{ url: string; expiresAt: number }>('remote', 'startPairing')
      setPair({ ...p, devices: status.devices.length })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  function closePairing() {
    setPair(undefined)
    if (local) void invokeModule('remote', 'cancelPairing').catch(() => {})
  }

  if (backends && !local) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Remote access" description="Use MonoRail from your phone over Tailscale. Never public." />
        <Card>
          <CardContent className="flex items-start gap-3 text-sm">
            <Monitor className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">Manage this on your PC</div>
              <div className="mt-1 text-muted-foreground">Pairing, devices and who may connect can only be changed in MonoRail on the PC itself.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = status
  const on = !!s?.settings.enabled
  const ts = s?.tailscale
  const ready = !!s && on && s.listening && !s.blocked && ts?.state === 'running' && ts.serve === 'ok' && !!s.address

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Remote access"
        description="Use MonoRail from your phone. Only your own devices on Tailscale can reach it, never the internet."
        actions={
          <Button variant="outline" onClick={() => openWiki('guide/setup/remote-access')}>
            <BookOpen /> How it works
          </Button>
        }
      />

      {!backends && <p className="-mt-4 text-sm text-muted-foreground">Sample data: Remote access works in the desktop app.</p>}
      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError(undefined)}>
            <X className="size-4" />
          </button>
        </div>
      )}
      {query.error && !s && <p className="text-sm text-destructive">{query.error.message}</p>}
      {!s && !query.error && <Loader2 className="size-5 animate-spin text-muted-foreground" />}

      {s && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  Remote access{' '}
                  {ready ? <Badge variant="success">On</Badge> : on ? <Badge variant="warning">Needs setup</Badge> : <Badge variant="secondary">Off</Badge>}
                </CardTitle>
                <CardDescription>
                  {on
                    ? 'MonoRail stays running in the tray while this is on, so your phone is not cut off when you close the window.'
                    : 'Off. MonoRail opens no port and does not look for Tailscale until you turn this on.'}
                </CardDescription>
              </div>
              <Switch
                checked={on}
                disabled={!!busy || s.settingsDamaged}
                aria-label="Remote access"
                className="mt-1"
                onCheckedChange={(v) => void act('enable', 'setEnabled', { enabled: v })}
              />
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-6">
              {s.settingsDamaged && (
                <Notice tone="destructive">
                  The Remote access settings file is damaged, so Remote access stays off. MonoRail will not overwrite it: delete settings.json in the remote folder of MonoRail's data folder to start over.
                </Notice>
              )}
              {s.devicesDamaged && <Notice tone="destructive">The paired devices file is damaged, so no device can connect. Delete devices.json in the remote folder of MonoRail's data folder to start over.</Notice>}

              {!on && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm font-medium">Before you turn it on</p>
                  <ol className="flex flex-col gap-3 text-sm">
                    <Step n={1}>Install Tailscale on this PC and on your phone, and sign in to the same account on both.</Step>
                    <Step n={2}>Turn on Remote access here. MonoRail checks Tailscale and shows what is left to do.</Step>
                    <Step n={3}>Pair your phone by scanning a code. Each phone gets its own key you can revoke.</Step>
                  </ol>
                </div>
              )}

              {on && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col divide-y">
                    <TailscaleRow status={s} />
                    <AddressRow status={s} busy={busy} onSetup={() => void act('serve', 'setupServe')} />
                    {s.blocked === 'public' ? (
                      <CheckRow
                        tone="bad"
                        label="Your address is public, so Remote access stopped"
                        detail="Tailscale Funnel is on for this address, which would put MonoRail on the internet. Turn Funnel off (tailscale funnel reset), then check again."
                      />
                    ) : (
                      <CheckRow
                        tone={ts?.serve === 'ok' ? 'ok' : 'muted'}
                        label="Not public"
                        detail="Tailscale Funnel is off. MonoRail turns Remote access off by itself if the address ever becomes public."
                      />
                    )}
                    {s.serverError ? (
                      <CheckRow tone="warn" label="MonoRail could not start listening" detail={s.serverError} />
                    ) : (
                      <CheckRow
                        tone={s.listening ? 'ok' : 'muted'}
                        label="MonoRail listens on this PC only"
                        detail={`127.0.0.1 port ${s.settings.port}, so nothing on your Wi-Fi or the internet can reach it directly.`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void act('check', 'check')}>
                      {busy === 'check' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check again
                    </Button>
                    {s.checkedAt && <span>Checked {timeAgo(s.checkedAt)}</span>}
                  </div>
                </div>
              )}

              {on && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-6">
                    <Row
                      title="Who may connect"
                      description="Tailscale logins allowed to open MonoRail. Anyone else on your tailnet is refused."
                      control={<Logins logins={s.settings.allowedLogins} disabled={!!busy} onChange={(logins) => void act('logins', 'setLogins', { logins })} />}
                    />
                    <Row
                      title="Agent mode from the phone"
                      description="Off: chats started from the phone run in Ask mode (read-only tools). Your spending limit applies either way."
                      control={
                        <Switch
                          checked={s.settings.agentFromPhone}
                          disabled={!!busy}
                          aria-label="Agent mode from the phone"
                          onCheckedChange={(v) => void act('agent', 'setAgentFromPhone', { on: v })}
                        />
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pair a phone</CardTitle>
              <CardDescription>Scan with the phone's camera while it is on Tailscale. The code works once, for two minutes.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col items-start gap-4">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Lock className="mt-0.5 size-4 shrink-0" /> No password: the phone keeps its own key, and you can revoke it here.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Folder pickers, sign-ins and updates stay on this PC.
                </li>
              </ul>
              <Button disabled={!ready || !!busy || s.devicesDamaged} onClick={() => void startPairing()}>
                {busy === 'pair' ? <Loader2 className="animate-spin" /> : <Smartphone />} Pair a phone
              </Button>
              {!ready && <span className="text-xs text-muted-foreground">Available once the checks pass.</span>}
            </CardContent>
          </Card>

          {on && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Paired devices</CardTitle>
                <CardDescription>Revoking a device signs it out at once. Turning Remote access off signs out all of them.</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="flex flex-col divide-y">
                {s.devices.length === 0 && <p className="text-sm text-muted-foreground">No devices yet. Pair a phone to see it here.</p>}
                {s.devices.map((d) => (
                  <DeviceRow
                    key={d.id}
                    device={d}
                    disabled={!!busy}
                    onRename={(name) => void act('rename', 'renameDevice', { id: d.id, name })}
                    onRevoke={() => void act('revoke', 'revokeDevice', { id: d.id })}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {on && (
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>What paired devices did. Only names and outcomes, never what was sent.</CardDescription>
                <CardAction>
                  <Button size="sm" variant="ghost" disabled={!!busy || s.audit.length === 0} onClick={() => void act('clear', 'clearAudit')}>
                    Clear
                  </Button>
                </CardAction>
              </CardHeader>
              <Separator />
              <CardContent className="flex flex-col divide-y text-sm">
                {s.audit.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
                {s.audit.map((a, i) => (
                  <ActivityRow key={`${a.at}-${i}`} entry={a} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={pairOpen} onOpenChange={(o) => !o && closePairing()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan with your phone</DialogTitle>
            <DialogDescription>Open the phone's camera and point it at the code. The phone must be on Tailscale.</DialogDescription>
          </DialogHeader>
          {pair && pairOpen && <PairingCode url={pair.url} expiresAt={pair.expiresAt} onNew={() => void startPairing()} />}
          <DialogFooter>
            <Button variant="outline" onClick={closePairing}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TailscaleRow({ status }: { status: RemoteStatus }) {
  const ts = status.tailscale
  if (!ts) return <CheckRow tone="muted" label="Checking Tailscale…" detail="MonoRail asks Tailscale on this PC whether it is running." />
  if (ts.state === 'missing')
    return <CheckRow tone="warn" label="Tailscale is not installed on this PC" detail="Install Tailscale from tailscale.com, sign in, then press Check again." />
  if (ts.state === 'stopped')
    return <CheckRow tone="warn" label="Tailscale is not running" detail="Open Tailscale on this PC and sign in, then press Check again." />
  if (ts.state === 'error') return <CheckRow tone="warn" label="Could not check Tailscale" detail={ts.error ?? 'Tailscale did not answer.'} />
  return <CheckRow tone="ok" label="Tailscale is running on this PC" detail={ts.login ? `Signed in as ${ts.login}` : 'Signed in'} />
}

function AddressRow({ status, busy, onSetup }: { status: RemoteStatus; busy?: string; onSetup: () => void }) {
  const ts = status.tailscale
  const [copied, setCopied] = useState(false)
  if (ts?.state !== 'running') return <CheckRow tone="muted" label="Private address" detail="Set up once Tailscale is running." />
  if (ts.serve === 'ok' && status.address)
    return (
      <CheckRow
        tone="ok"
        label="Private address is set up"
        detail={
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{status.address}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                void navigator.clipboard?.writeText(status.address!).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
            </Button>
          </span>
        }
      />
    )
  if (ts.serve === 'other')
    return (
      <CheckRow
        tone="warn"
        label="Your tailnet address already forwards to something else"
        detail={`Tailscale serve on this PC points at another program. MonoRail will not replace it. Remove it (tailscale serve reset), or forward the address yourself to 127.0.0.1:${status.settings.port}, then check again.`}
      />
    )
  return (
    <CheckRow
      tone="warn"
      label="Private address is not set up yet"
      detail={`Tailscale needs to forward your tailnet address to MonoRail. This runs one command on this PC: tailscale serve --bg http://127.0.0.1:${status.settings.port}`}
      action={
        <Button size="sm" disabled={!!busy} onClick={onSetup}>
          {busy === 'serve' ? <Loader2 className="animate-spin" /> : <Terminal />} Set it up
        </Button>
      }
    />
  )
}

function Logins({ logins, disabled, onChange }: { logins: string[]; disabled: boolean; onChange: (logins: string[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const valid = /^[^\s@]+@[^\s@]+$/.test(value.trim())
  const add = () => {
    if (!valid) return
    onChange([...logins, value.trim().toLowerCase()])
    setValue('')
    setAdding(false)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {logins.length === 0 && <span className="text-sm text-muted-foreground">Nobody yet</span>}
      {logins.map((l) => (
        <Badge key={l} variant="outline" className="gap-1.5 py-1">
          {l}
          <button type="button" aria-label={`Remove ${l}`} disabled={disabled} onClick={() => onChange(logins.filter((x) => x !== l))}>
            <X className="size-3 text-muted-foreground hover:text-foreground" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="name@example.com" className="h-8 w-56" aria-label="Tailscale login" />
          <Button size="sm" type="submit" disabled={!valid || disabled}>
            Add
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => setAdding(true)}>
          <Plus /> Add
        </Button>
      )}
    </div>
  )
}

function DeviceRow({ device, disabled, onRename, onRevoke }: { device: RemoteDevice; disabled: boolean; onRename: (name: string) => void; onRevoke: () => void }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(device.name)
  const seenMs = Date.now() - Date.parse(device.lastSeen)
  const active = seenMs < 2 * 60_000
  const tablet = /iPad|Tablet/i.test(device.agent) || /tablet/i.test(device.name)
  return (
    <div className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
        {tablet ? <Tablet className="size-5" /> : <Smartphone className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        {renaming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) onRename(name.trim())
              setRenaming(false)
            }}
          >
            <Input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="h-8 w-48" aria-label="Device name" />
            <Button size="sm" type="submit" disabled={!name.trim()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm font-medium">
              {device.name} {active && <Badge variant="success">Connected</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">
              {device.agent} · paired {dateLabel(device.pairedAt)} · {active ? 'Active now' : `Last seen ${timeAgo(Date.parse(device.lastSeen))}`}
            </div>
          </>
        )}
      </div>
      {!renaming && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              setName(device.name)
              setRenaming(true)
            }}
          >
            Rename
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" disabled={disabled} onClick={onRevoke}>
            Revoke
          </Button>
        </>
      )}
    </div>
  )
}

const MODULE_NAMES: Record<string, string> = {
  'agent-chat': 'Chat',
  'agent-catalog': 'Catalog',
  agents: 'Agents',
  'claude-stats': 'Claude Stats',
  connections: 'Connections',
  storage: 'Storage',
  docker: 'Docker',
  mcp: 'Agent access',
  extensions: 'Extensions',
  settings: 'Settings',
  backups: 'Backups',
  flashcards: 'Flashcards',
  notes: 'Notes',
  profiles: 'Profile',
  developer: 'Developer Mode',
  remote: 'Remote access',
  home: 'Home',
  'app:github-plus': 'GitHub+',
  'app:jira-plus': 'Jira+',
  'app:email': 'Email',
}

const METHOD_LABELS: Record<string, string> = {
  'agent-chat.startTurn': 'sent a message',
  'agent-chat.stopTurn': 'stopped a reply',
  'remote.pair': 'paired this device',
}

function activityLabel(a: RemoteAuditEntry) {
  const mod = MODULE_NAMES[a.module] ?? (a.module.startsWith('ext:') ? 'An extension' : a.module)
  const what = METHOD_LABELS[`${a.module}.${a.method}`] ?? a.method.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return a.module === 'remote' && a.method === 'pair' ? 'Paired' : `${mod}: ${what}`
}

function ActivityRow({ entry }: { entry: RemoteAuditEntry }) {
  const bad = entry.outcome !== 'ok'
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      {bad ? <X className="mt-0.5 size-4 shrink-0 text-destructive" /> : <Check className="mt-0.5 size-4 shrink-0 text-success" />}
      <div className="min-w-0 flex-1">
        <div>{activityLabel(entry)}</div>
        <div className="text-xs text-muted-foreground">
          {entry.device} · {timeLabel(entry.at)}
          {entry.outcome === 'refused' && <> · refused{entry.reason ? `: ${entry.reason.replace(/:.*$/, '')}` : ''}</>}
          {entry.outcome === 'error' && <> · failed</>}
        </div>
      </div>
    </div>
  )
}

function PairingCode({ url, expiresAt, onNew }: { url: string; expiresAt: number; onNew: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, Math.round((expiresAt - now) / 1000))
  const qr = useMemo(() => {
    const code = QRCode.create(url, { errorCorrectionLevel: 'M' })
    const n = code.modules.size
    const rects: ReactNode[] = []
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) if (code.modules.get(x, y)) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    return { n, rects }
  }, [url])
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className={`rounded-xl bg-white p-4 ring-1 ring-foreground/10 ${left === 0 ? 'opacity-20' : ''}`}>
        <svg viewBox={`-1 -1 ${qr.n + 2} ${qr.n + 2}`} className="size-52" fill="#111" shapeRendering="crispEdges" role="img" aria-label="Pairing code">
          {qr.rects}
        </svg>
      </div>
      {left > 0 ? (
        <span className="text-sm text-muted-foreground">
          Expires in{' '}
          <span className="font-mono tabular-nums text-foreground">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </span>{' '}
          · works once
        </span>
      ) : (
        <span className="flex items-center gap-3 text-sm text-muted-foreground">
          This code has expired.
          <Button size="sm" variant="outline" onClick={onNew}>
            New code
          </Button>
        </span>
      )}
    </div>
  )
}

function Notice({ tone, children }: { tone: 'destructive' | 'warning'; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${tone === 'destructive' ? 'bg-destructive-soft text-destructive-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground'}`}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}

function CheckRow({ tone, label, detail, action }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; label: string; detail: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0">
      {tone === 'warn' ? (
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
      ) : tone === 'bad' ? (
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
      ) : tone === 'ok' ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
      ) : (
        <Globe className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      )}
      <div className={`min-w-0 flex-1 basis-64 ${tone === 'muted' ? 'opacity-60' : ''}`}>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
      </div>
      {action}
    </div>
  )
}

function Row({ title, description, control }: { title: string; description: string; control: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1 basis-64">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      {control}
    </div>
  )
}

function timeAgo(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`
  return `${Math.round(h / 24)} days ago`
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
