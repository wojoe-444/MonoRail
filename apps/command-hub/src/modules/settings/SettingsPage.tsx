import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Info, Loader2, Puzzle, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useExtensionList } from '@/extensions/store'
import { formatRelative } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'

import type { AppStatus } from './types'

const MODULE_ID = 'settings'

/** Shown in the browser dev server, where there is no backend. Fictional. */
const browserStatus: AppStatus = {
  currentVersion: '0.0.0-dev',
  electronVersion: '–',
  dataDir: '%APPDATA%\\MonoRail',
  updatesSupported: false,
  unsupportedReason: 'Updates work in the installed desktop app, not in the browser.',
  state: 'idle',
}

function formatBytes(n: number): string {
  if (!n) return '0 MB'
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function SettingsPage() {
  const desktop = isDesktop()
  const query = useModuleQuery<AppStatus>(MODULE_ID, 'getStatus')
  const [live, setLive] = useState<AppStatus>()
  const [busy, setBusy] = useState(false)
  const [callError, setCallError] = useState<string>()

  const extensionCount = useExtensionList().extensions.length
  const status = live ?? query.data ?? (desktop ? undefined : browserStatus)

  // The backend is request/response, so poll while a download is running.
  const downloading = status?.state === 'downloading'
  useEffect(() => {
    if (!downloading) return
    const t = setInterval(() => {
      invokeModule<AppStatus>(MODULE_ID, 'getStatus').then(setLive, () => {})
    }, 500)
    return () => clearInterval(t)
  }, [downloading])

  async function call(method: string) {
    setBusy(true)
    setCallError(undefined)
    try {
      setLive(await invokeModule<AppStatus>(MODULE_ID, method))
    } catch (e) {
      setCallError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Configure" title="Settings" description="App version, updates and local data." />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Updates</CardTitle>
            <CardDescription>New versions are published from the MonoRail repository on GitHub.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-col gap-6">
            {!status ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : (
              <UpdatePanel status={status} busy={busy} callError={callError ?? query.error?.message} onCall={call} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>This copy of MonoRail.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent>
            <dl className="flex flex-col divide-y text-sm">
              <Row label="Version" value={status?.currentVersion} />
              <Row label="Electron" value={status?.electronVersion} />
              <Row label="Local data" value={status?.dataDir} mono />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="flex flex-wrap items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-highlight-soft text-highlight-soft-foreground">
              <Puzzle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">Extensions</div>
              <div className="text-sm text-muted-foreground">
                {extensionCount ? `${extensionCount} installed. ` : ''}Add modules and apps built in other repositories, and choose what they may access.
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/settings/extensions')}>
              Manage extensions <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium break-all', mono && 'font-mono text-xs')}>{value ?? '–'}</dd>
    </div>
  )
}

interface UpdatePanelProps {
  status: AppStatus
  busy: boolean
  callError?: string
  onCall: (method: string) => void
}

function UpdatePanel({ status, busy, callError, onCall }: UpdatePanelProps) {
  const { state } = status
  const checking = state === 'checking' || (busy && state !== 'available' && state !== 'downloaded')
  const pct = Math.round(status.progress?.percent ?? 0)

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <StatusIcon status={status} checking={checking} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{headline(status, checking)}</div>
          <div className="text-sm text-muted-foreground">
            {status.updatesSupported
              ? `You have version ${status.currentVersion}.${status.lastChecked ? ` Last checked ${formatRelative(status.lastChecked)}.` : ''}`
              : status.unsupportedReason}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state === 'available' && (
            <Button onClick={() => onCall('downloadUpdate')} disabled={busy}>
              <Download /> Download and restart
            </Button>
          )}
          {state === 'downloaded' && (
            <Button onClick={() => onCall('installAndRestart')} disabled={busy}>
              <RotateCcw /> Restart to update
            </Button>
          )}
          {state !== 'downloading' && state !== 'downloaded' && (
            <Button
              variant={state === 'available' ? 'outline' : 'default'}
              onClick={() => onCall('checkForUpdates')}
              disabled={!status.updatesSupported || checking || busy}
            >
              {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Check for updates
            </Button>
          )}
        </div>
      </div>

      {state === 'downloading' && (
        <div className="flex flex-col gap-2">
          <Progress value={pct} />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>Downloading {status.latestVersion}. MonoRail restarts when it finishes.</span>
            <span>
              {formatBytes(status.progress?.transferred ?? 0)} / {formatBytes(status.progress?.total ?? 0)} ({pct}%)
            </span>
          </div>
        </div>
      )}

      {(state === 'error' || callError) && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{status.error ?? callError}</span>
        </div>
      )}

      {status.releaseNotes && (state === 'available' || state === 'downloading' || state === 'downloaded') && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">What's new</div>
          <p className="text-sm whitespace-pre-line">{stripHtml(status.releaseNotes)}</p>
        </div>
      )}
    </>
  )
}

/** Release notes come from GitHub as HTML; show plain text. */
function stripHtml(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
}

function headline(s: AppStatus, checking: boolean): string {
  if (!s.updatesSupported) return 'Updates are not available here'
  if (checking) return 'Checking for updates…'
  switch (s.state) {
    case 'available':
      return `Version ${s.latestVersion} is available`
    case 'downloading':
      return `Downloading version ${s.latestVersion}`
    case 'downloaded':
      return `Version ${s.latestVersion} is ready to install`
    case 'not-available':
      return 'MonoRail is up to date'
    case 'error':
      return 'Could not check for updates'
    default:
      return 'Check for a newer version'
  }
}

function StatusIcon({ status, checking }: { status: AppStatus; checking: boolean }) {
  const { state } = status
  const [Icon, tone] = !status.updatesSupported
    ? [Info, 'bg-info-soft text-info-soft-foreground']
    : checking
      ? [Loader2, 'bg-primary-soft text-primary-soft-foreground']
      : state === 'available' || state === 'downloading' || state === 'downloaded'
        ? [Sparkles, 'bg-primary-soft text-primary-soft-foreground']
        : state === 'not-available'
          ? [CheckCircle2, 'bg-success-soft text-success-soft-foreground']
          : state === 'error'
            ? [AlertTriangle, 'bg-destructive-soft text-destructive-soft-foreground']
            : [RefreshCw, 'bg-muted text-muted-foreground']
  return (
    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tone)}>
      <Icon className={cn('size-5', checking && 'animate-spin')} />
    </div>
  )
}
