import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, File, Folder, FolderOpen, HardDrive, Loader2, RefreshCw, Settings2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatBytes, formatCount, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'

import { sampleDrives, sampleScan } from './sample'
import type { Advice, Drive, DrivesResult, LocationGroup, ScanState, StorageLocation } from './types'

const GROUPS: { id: LocationGroup; title: string }[] = [
  { id: 'monorail', title: 'MonoRail' },
  { id: 'agents', title: 'Agents and repos' },
  { id: 'dev', title: 'Developer caches' },
  { id: 'system', title: 'Your folders and Windows' },
]

const ADVICE: Record<Advice, { label: string; variant: 'success' | 'warning' | 'secondary'; help: string }> = {
  safe: { label: 'Safe to clear', variant: 'success', help: 'A cache its tool downloads again when needed.' },
  review: { label: 'Check first', variant: 'warning', help: 'May hold things you want to keep.' },
  keep: { label: 'In use', variant: 'secondary', help: 'Needed as it is.' },
}

/** Below this, the system drive gets a warning banner. */
const LOW_BYTES = 5 * 1024 ** 3
const LOW_SHARE = 0.05

function isLow(d: Drive) {
  return d.free < LOW_BYTES || d.free / d.total < LOW_SHARE
}

export default function StoragePage() {
  const desktop = isDesktop()
  const drivesQuery = useModuleQuery<DrivesResult>('storage', 'getDrives')
  const scanQuery = useModuleQuery<ScanState>('storage', 'getScan')
  const drives = drivesQuery.data ?? (desktop ? undefined : sampleDrives)
  const scan = scanQuery.data ?? (desktop ? undefined : sampleScan)
  const running = scan?.state === 'running'
  const { reload: reloadScan } = scanQuery
  const { reload: reloadDrives } = drivesQuery
  const [actionError, setActionError] = useState<string>()

  // Follow a running scan; read the drives again when it ends.
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => void reloadScan(), 1000)
    return () => {
      clearInterval(t)
      void reloadDrives()
    }
  }, [running, reloadScan, reloadDrives])

  async function act(fn: () => Promise<unknown>) {
    setActionError(undefined)
    try {
      await fn()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  const startScan = () =>
    act(async () => {
      await invokeModule('storage', 'startScan')
      await reloadScan()
    })

  const lowDrive = drives?.drives.find((d) => d.system && isLow(d))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Utilities"
        title="Storage"
        description="How full your drives are and which folders take up the space. This page only looks: it never moves or deletes anything."
        actions={
          <>
            {drives?.platform === 'win32' && (
              <Button variant="outline" disabled={!desktop} onClick={() => act(() => invokeModule('storage', 'openStorageSettings'))}>
                <Settings2 /> Windows storage settings
              </Button>
            )}
            <Button disabled={!desktop || running} onClick={startScan}>
              {running ? <Loader2 className="animate-spin" /> : <RefreshCw />} {scan?.locations ? 'Scan again' : 'Scan folders'}
            </Button>
          </>
        }
      />

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {lowDrive && (
        <Card className="flex-row items-start gap-4 bg-warning-soft px-6 py-4 text-warning-soft-foreground ring-warning/30">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">
              {lowDrive.id} is almost full: {formatBytes(lowDrive.free)} free
            </span>
            <span>
              Windows, MonoRail and your agents slow down or fail when the system drive runs out. Start with the items marked “Safe to clear”, using each tool's own cleanup command, or
              Windows' Temporary files cleanup.
            </span>
          </div>
        </Card>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Drives</h2>
        {!drives ? (
          <Status error={drivesQuery.error} />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[...drives.drives]
              .sort((a, b) => Number(b.system) - Number(a.system) || a.id.localeCompare(b.id))
              .map((d) => (
                <DriveCard key={d.id} drive={d} />
              ))}
          </div>
        )}
      </section>

      <FoldersCard scan={scan} error={scanQuery.error} desktop={desktop} onScan={startScan} onOpen={(id) => act(() => invokeModule('storage', 'openLocation', { id }))} />
    </div>
  )
}

function Status({ error }: { error?: Error }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {error ? error.message : (<><Loader2 className="size-4 animate-spin" /> Loading…</>)}
    </div>
  )
}

function DriveCard({ drive: d }: { drive: Drive }) {
  const usedShare = d.total ? d.used / d.total : 0
  const tone = usedShare >= 0.95 || isLow(d) ? 'bg-destructive' : usedShare >= 0.85 ? 'bg-warning' : 'bg-primary'
  return (
    <Card className="gap-4 px-6 py-6">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
          <HardDrive className="size-4" />
        </span>
        <span className="font-mono text-sm font-semibold">{d.id}</span>
        <div className="ml-auto flex gap-1">
          {d.system && <Badge variant="secondary">System</Badge>}
          {d.holdsData && <Badge variant="primary">MonoRail data</Badge>}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Free</span>
        <span className={cn('font-semibold tracking-tight tabular-nums', d.system ? 'text-4xl' : 'text-3xl', isLow(d) && 'text-destructive')}>{formatBytes(d.free)}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={`${d.id} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(usedShare * 100)}
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.min(100, usedShare * 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatBytes(d.used)} used of {formatBytes(d.total)} ({Math.round(usedShare * 100)}%)
      </span>
    </Card>
  )
}

function FoldersCard({
  scan,
  error,
  desktop,
  onScan,
  onOpen,
}: {
  scan?: ScanState
  error?: Error
  desktop: boolean
  onScan: () => void
  onOpen: (id: string) => void
}) {
  const locations = useMemo(() => scan?.locations ?? [], [scan?.locations])
  // One scale for every row, from the full result, so bars compare across groups.
  const max = Math.max(1, ...locations.map((l) => l.bytes ?? 0))
  const safe = locations.filter((l) => l.advice === 'safe').reduce((s, l) => s + (l.bytes ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>What takes up space</CardTitle>
        <CardDescription>
          MonoRail, your agents, developer caches and the usual suspects. Sizes count every file; links and junctions are not followed.
          {safe > 0 && (
            <>
              {' '}
              Caches marked safe to clear add up to <span className="font-medium text-foreground tabular-nums">{formatBytes(safe)}</span>.
            </>
          )}
        </CardDescription>
        <CardAction>
          <ScanStatus scan={scan} />
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-6">
        {!scan ? (
          <Status error={error} />
        ) : scan.state === 'error' && !locations.length ? (
          <p className="text-sm text-destructive">{scan.error}</p>
        ) : !locations.length ? (
          <div className="flex flex-col items-start gap-3 py-4 text-sm text-muted-foreground">
            {scan.state === 'running' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Measuring folders. Large ones can take up to a minute.
              </span>
            ) : (
              <>
                <span>Folders are measured when you ask, since walking large folders takes a while. Nothing is saved to disk.</span>
                <Button disabled={!desktop} onClick={onScan}>
                  <RefreshCw /> Scan folders
                </Button>
              </>
            )}
          </div>
        ) : (
          GROUPS.map((g) => {
            const rows = locations.filter((l) => l.group === g.id).sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1))
            if (!rows.length) return null
            const total = rows.reduce((s, l) => s + (l.bytes ?? 0), 0)
            return (
              <section key={g.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.title}</h3>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatBytes(total)}</span>
                </div>
                <div className="divide-y rounded-lg ring-1 ring-foreground/10">
                  {rows.map((l) => (
                    <LocationRow key={l.id} loc={l} max={max} desktop={desktop} onOpen={onOpen} />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function ScanStatus({ scan }: { scan?: ScanState }) {
  if (!scan || scan.state === 'idle') return null
  if (scan.state === 'running') {
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
        <Loader2 className="size-3.5 animate-spin" /> {scan.done ?? 0} of {scan.total ?? 0}
        {scan.current?.length ? ` · ${scan.current.join(', ')}` : ''}
      </span>
    )
  }
  if (scan.state === 'done' && scan.finishedAt) {
    return (
      <span className="text-xs text-muted-foreground">
        Scanned {formatRelative(scan.finishedAt)}
        {scan.tookMs !== undefined && ` in ${Math.max(1, Math.round(scan.tookMs / 1000))} s`}
      </span>
    )
  }
  return null
}

function LocationRow({ loc, max, desktop, onOpen }: { loc: StorageLocation; max: number; desktop: boolean; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const advice = ADVICE[loc.advice]
  const size = loc.bytes === undefined ? 'Unknown' : `${loc.truncated ? '≥ ' : ''}${formatBytes(loc.bytes)}`
  const share = (loc.bytes ?? 0) / max
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{loc.label}</span>
              <Badge variant={advice.variant} title={advice.help}>
                {advice.label}
              </Badge>
            </div>
            <span className="truncate font-mono text-xs text-muted-foreground" title={loc.path}>
              {loc.path}
            </span>
          </div>
          <div className="hidden w-40 shrink-0 sm:block">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share > 0 ? 1 : 0, share * 100)}%` }} />
            </div>
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums">{size}</span>
        </button>
        <Button variant="ghost" size="icon" disabled={!desktop} onClick={() => onOpen(loc.id)} title={loc.kind === 'file' ? 'Show in Explorer' : 'Open in Explorer'} aria-label={`Open ${loc.label}`}>
          <FolderOpen />
        </Button>
      </div>
      {open && <LocationDetails loc={loc} />}
    </div>
  )
}

function LocationDetails({ loc }: { loc: StorageLocation }) {
  const childMax = Math.max(1, ...(loc.children ?? []).map((c) => c.bytes))
  return (
    <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 pl-11 text-sm">
      {loc.note && <p className="text-muted-foreground">{loc.note}</p>}
      {loc.tip && (
        <p className="text-muted-foreground">
          Clear it with the tool's own command: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{loc.tip}</code>
        </p>
      )}
      {loc.files !== undefined && loc.kind !== 'file' && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatCount(loc.files)} files{loc.dirs !== undefined && ` in ${formatCount(loc.dirs)} folders`}
          {loc.truncated && ' · stopped at the time limit, so the real size is larger'}
          {!!loc.skipped && ` · ${formatCount(loc.skipped)} folders could not be read`}
        </p>
      )}
      {!!loc.children?.length && (
        <table className="w-full max-w-2xl text-xs">
          <caption className="sr-only">Largest items in {loc.label}</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Largest inside{loc.childCount && loc.childCount > loc.children.length ? ` (top ${loc.children.length} of ${formatCount(loc.childCount)})` : ''}</th>
              <th className="w-40 py-1" />
              <th className="w-24 py-1 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody>
            {loc.children.map((c) => (
              <tr key={c.name}>
                <td className="py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    {c.kind === 'dir' ? <Folder className="size-3.5 shrink-0 text-muted-foreground" /> : <File className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="truncate font-mono">{c.name}</span>
                  </span>
                </td>
                <td className="py-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(c.bytes / childMax) * 100}%` }} />
                  </div>
                </td>
                <td className="py-1 text-right font-mono tabular-nums">{formatBytes(c.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
