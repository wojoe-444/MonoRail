import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Box, Boxes, Cable, Container, Database, ExternalLink, Layers, Loader2, PlugZap, RefreshCw, Terminal } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { axisProps, gridProps } from '@/components/charts/palette'
import { StatTile } from '@/components/charts/StatTile'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { formatBytes, formatRelative } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'

import { sampleInfo, sampleLogs, sampleOverview, sampleStats } from './sample'
import type { ContainerInfo, ContainerLogs, ContainerState, ContainerStats, DockerBlock, DockerContainer, DockerOverview, StatsSample } from './types'

type Tab = 'containers' | 'images' | 'volumes' | 'networks'
type Detail = 'logs' | 'stats' | 'info'

/** Stats are read every few seconds while the page is open, and kept in memory only. */
const STATS_EVERY_MS = 5000
const STATS_KEEP = 60

const STATE_TONE: Record<ContainerState, { dot: string; badge: 'success' | 'warning' | 'secondary' | 'destructive' | 'info' }> = {
  running: { dot: 'bg-success', badge: 'success' },
  restarting: { dot: 'bg-warning', badge: 'warning' },
  paused: { dot: 'bg-info', badge: 'info' },
  created: { dot: 'bg-muted-foreground/40', badge: 'secondary' },
  exited: { dot: 'bg-muted-foreground/40', badge: 'secondary' },
  removing: { dot: 'bg-muted-foreground/40', badge: 'secondary' },
  dead: { dot: 'bg-destructive', badge: 'destructive' },
}

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })

export default function DockerPage() {
  const desktop = isDesktop()
  const overviewQuery = useModuleQuery<DockerOverview>('docker', 'getOverview')
  const overview = overviewQuery.data ?? (desktop ? undefined : sampleOverview)
  const { reload } = overviewQuery
  const ready = !!overview && !overview.block
  const samples = useStatsSamples(ready && desktop)
  const shownSamples = desktop ? samples : sampleStats
  const latest = shownSamples.at(-1)
  const [actionError, setActionError] = useState<string>()

  async function openLazydocker() {
    setActionError(undefined)
    try {
      await invokeModule('docker', 'openLazydocker')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Utilities"
        title="Docker"
        description="What Docker is running on this computer: containers, their logs and load, images and volumes. This page only looks; it never starts, stops or removes anything."
        actions={
          <>
            {ready && overview.lazydocker ? (
              <Button variant="outline" disabled={!desktop} onClick={openLazydocker} title="Opens lazydocker in a terminal window">
                <Terminal /> Open lazydocker
              </Button>
            ) : (
              ready && (
                <Button variant="ghost" onClick={() => void invokeModule('docker', 'openLazydockerPage').catch(() => {})} title="lazydocker was not found. Opens its project page.">
                  <ExternalLink /> Get lazydocker
                </Button>
              )
            )}
            <Button disabled={!desktop || overviewQuery.fetching} onClick={() => void reload()}>
              {overviewQuery.fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </Button>
          </>
        }
      />

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!overview ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {overviewQuery.error ? overviewQuery.error.message : (<><Loader2 className="size-4 animate-spin" /> Asking Docker…</>)}
        </div>
      ) : overview.block ? (
        <BlockedCard block={overview.block} detail={overview.blockDetail} onRetry={() => void reload()} />
      ) : (
        <>
          <EngineStrip overview={overview} />
          <Kpis overview={overview} latest={latest} />
          <ExplorerCard overview={overview} samples={shownSamples} />
        </>
      )}
    </div>
  )
}

/** Read every container's stats on a timer while the page is open. Nothing is saved. */
function useStatsSamples(enabled: boolean): StatsSample[] {
  const [samples, setSamples] = useState<StatsSample[]>([])
  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function tick() {
      try {
        const s = await invokeModule<StatsSample>('docker', 'getStats')
        if (!stopped) setSamples((prev) => [...prev, s].slice(-STATS_KEEP))
      } catch {
        // A missed sample is fine: the next one comes in a few seconds.
      }
      if (!stopped) timer = setTimeout(tick, STATS_EVERY_MS)
    }
    void tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [enabled])
  return samples
}

const BLOCKS: Record<DockerBlock, { title: string; body: string; icon: typeof PlugZap }> = {
  'not-set-up': {
    title: 'Docker is not set up in MonoRail',
    body: 'Docker is optional. Add the Docker connection on Connections and this page shows your containers, logs and images. Until then MonoRail checks nothing: it does not look for Docker or lazydocker, and it never downloads or installs them.',
    icon: PlugZap,
  },
  'not-installed': {
    title: 'Docker was not found on this computer',
    body: 'The docker command is not on your PATH. If you want to use Docker, install Docker Desktop yourself, then check again. MonoRail never installs it for you.',
    icon: Box,
  },
  'not-running': {
    title: 'Docker is installed but not running',
    body: 'The docker command answered, but its engine did not. Start Docker Desktop, wait until it says "Engine running", then check again.',
    icon: AlertTriangle,
  },
}

function BlockedCard({ block, detail, onRetry }: { block: DockerBlock; detail?: string; onRetry: () => void }) {
  const b = BLOCKS[block]
  return (
    <Card className="items-start gap-4 px-6 py-8">
      <span className={cn('flex size-10 items-center justify-center rounded-lg', block === 'not-running' ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
        <b.icon className="size-5" />
      </span>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="text-lg font-semibold">{b.title}</h2>
        <p className="text-sm text-muted-foreground">{b.body}</p>
        {detail && <p className="font-mono text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className="flex gap-2">
        {block === 'not-set-up' ? (
          <Button onClick={() => navigate('/connections')}>
            <Cable /> Set up on Connections
          </Button>
        ) : (
          <Button onClick={onRetry}>
            <RefreshCw /> Check again
          </Button>
        )}
      </div>
    </Card>
  )
}

function EngineStrip({ overview }: { overview: DockerOverview }) {
  const e = overview.engine
  const parts = [
    e?.platform,
    e?.wsl && `in WSL (${e.wsl})`,
    e?.server && `Engine ${e.server}`,
    e?.context && `context ${e.context}`,
    e?.cpus && `${e.cpus} CPUs`,
    e?.memory && `${formatBytes(e.memory)} memory`,
  ].filter(Boolean)
  return (
    <div className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <Badge variant="success">
        <span className="size-1.5 rounded-full bg-success" /> Engine running
      </Badge>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-foreground/20">·</span>}
          <span className="tabular-nums">{p}</span>
        </span>
      ))}
      <span className="ml-auto text-xs">Read {formatRelative(overview.readAt)}</span>
    </div>
  )
}

function Kpis({ overview, latest }: { overview: DockerOverview; latest?: StatsSample }) {
  const running = overview.containers.filter((c) => c.state === 'running').length
  const restarting = overview.containers.filter((c) => c.state === 'restarting').length
  const unhealthy = overview.containers.filter((c) => c.health === 'unhealthy').length
  const cpu = latest?.stats.reduce((n, s) => n + s.cpu, 0)
  const mem = latest?.stats.reduce((n, s) => n + s.memory, 0)
  const cpus = overview.engine?.cpus
  const disk = overview.disk
  const diskTotal = disk ? disk.images + disk.containers + disk.volumes + disk.buildCache : undefined
  const trouble = [restarting && `${restarting} restarting`, unhealthy && `${unhealthy} unhealthy`].filter(Boolean).join(', ')
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile hero label="Running containers" value={`${running}`} hint={`of ${overview.containers.length}${trouble ? ` · ${trouble}` : ''}`} />
      <StatTile label="CPU now" value={cpu === undefined ? '…' : `${cpu.toFixed(1)}%`} hint={cpus ? `of ${cpus * 100}% (${cpus} CPUs)` : undefined} />
      <StatTile label="Memory now" value={mem === undefined ? '…' : formatBytes(mem)} hint={overview.engine?.memory ? `of ${formatBytes(overview.engine.memory)} for Docker` : undefined} />
      <StatTile label="Docker disk use" value={formatBytes(diskTotal)} hint={disk ? `${formatBytes(disk.reclaimable)} reclaimable` : undefined} />
    </div>
  )
}

function ExplorerCard({ overview, samples }: { overview: DockerOverview; samples: StatsSample[] }) {
  const [tab, setTab] = useState<Tab>('containers')
  const tabs: { value: Tab; label: string }[] = [
    { value: 'containers', label: `Containers ${overview.containers.length}` },
    { value: 'images', label: `Images ${overview.images.length}` },
    { value: 'volumes', label: `Volumes ${overview.volumes.length}` },
    { value: 'networks', label: `Networks ${overview.networks.length}` },
  ]
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-6 py-4">
        <Segmented className="w-fit" aria-label="What to show" value={tab} onChange={setTab} options={tabs} />
      </CardHeader>
      <Separator />
      {tab === 'containers' && <ContainersView containers={overview.containers} samples={samples} />}
      {tab === 'images' && <ImagesView overview={overview} />}
      {tab === 'volumes' && <VolumesView overview={overview} />}
      {tab === 'networks' && <NetworksView overview={overview} />}
    </Card>
  )
}

/** Compose projects first (alphabetical), then the containers started on their own. */
function groupContainers(containers: DockerContainer[]) {
  const groups = new Map<string, DockerContainer[]>()
  for (const c of containers) {
    const key = c.project ?? ''
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
}

function ContainersView({ containers, samples }: { containers: DockerContainer[]; samples: StatsSample[] }) {
  const groups = useMemo(() => groupContainers(containers), [containers])
  const [selectedId, setSelectedId] = useState<string | undefined>(() => containers.find((c) => c.state === 'running')?.id ?? containers[0]?.id)
  const selected = containers.find((c) => c.id === selectedId) ?? containers[0]
  const latest = new Map((samples.at(-1)?.stats ?? []).map((s) => [s.id, s]))

  if (!containers.length) return <Empty icon={Container} text="No containers yet. Containers you run with docker or docker compose show up here." />
  return (
    <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col border-b lg:border-r lg:border-b-0">
        {groups.map(([project, list]) => (
          <div key={project} className="flex flex-col py-2">
            <div className="flex items-center gap-2 px-6 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {project ? <Layers className="size-3.5" /> : <Box className="size-3.5" />}
              {project || 'Standalone'}
              {project && <span className="normal-case tracking-normal">· compose</span>}
            </div>
            {list.map((c) => {
              const s = latest.get(c.id)
              const active = c.id === selected?.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn('mx-2 flex items-center gap-3 rounded-md px-4 py-2 text-left text-sm transition-colors', active ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted')}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', STATE_TONE[c.state].dot)} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{c.service ?? c.name}</span>
                    <span className={cn('truncate text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>{c.status}</span>
                  </span>
                  {s && <span className="font-mono text-xs tabular-nums opacity-80">{s.cpu.toFixed(1)}%</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {selected && <ContainerDetail key={selected.id} container={selected} samples={samples} />}
    </div>
  )
}

function ContainerDetail({ container: c, samples }: { container: DockerContainer; samples: StatsSample[] }) {
  const [detail, setDetail] = useState<Detail>('logs')
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-start gap-4 px-6 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{c.name}</h3>
            <Badge variant={STATE_TONE[c.state].badge}>{c.state}</Badge>
            {c.health && <Badge variant={c.health === 'healthy' ? 'success' : c.health === 'unhealthy' ? 'destructive' : 'warning'}>{c.health}</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span className="font-mono">{c.image}</span>
            {c.ports.map((p) => (
              <span key={p} className="font-mono">
                {p}
              </span>
            ))}
            <span className="font-mono">{c.id.slice(0, 12)}</span>
          </div>
        </div>
        <Segmented
          className="ml-auto"
          aria-label="Container details"
          value={detail}
          onChange={setDetail}
          options={[
            { value: 'logs', label: 'Logs' },
            { value: 'stats', label: 'Stats', disabled: c.state !== 'running', title: c.state !== 'running' ? 'Only running containers have stats' : undefined },
            { value: 'info', label: 'Info' },
          ]}
        />
      </div>
      <Separator />
      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        {detail === 'logs' && <LogsView container={c} />}
        {detail === 'stats' && <StatsView id={c.id} samples={samples} />}
        {detail === 'info' && <InfoView id={c.id} />}
      </div>
    </div>
  )
}

function LogsView({ container: c }: { container: DockerContainer }) {
  const desktop = isDesktop()
  const [follow, setFollow] = useState(c.state === 'running')
  const [stamps, setStamps] = useState(false)
  const [logs, setLogs] = useState<ContainerLogs | undefined>(desktop ? undefined : sampleLogs)
  const [error, setError] = useState<string>()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!desktop) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function read() {
      try {
        const l = await invokeModule<ContainerLogs>('docker', 'getLogs', { id: c.id })
        if (!stopped) {
          setLogs(l)
          setError(undefined)
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e))
      }
      if (!stopped && follow) timer = setTimeout(read, 3000)
    }
    void read()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [desktop, c.id, follow])

  // Keep the newest line in view while following.
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [logs, follow])

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={follow} onCheckedChange={setFollow} disabled={c.state !== 'running'} /> Follow
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={stamps} onCheckedChange={setStamps} /> Timestamps
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{logs?.truncated ? 'Last 500 lines' : logs ? `${logs.lines.length} lines` : ''}</span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div ref={box} className="h-[420px] overflow-auto rounded-lg bg-muted/60 px-4 py-3 font-mono text-xs leading-5 ring-1 ring-foreground/10">
        {!logs ? (
          <span className="text-muted-foreground">Reading logs…</span>
        ) : logs.lines.length === 0 ? (
          <span className="text-muted-foreground">This container has not logged anything.</span>
        ) : (
          logs.lines.map((l, i) => (
            <div key={i} className={cn('whitespace-pre-wrap break-all', l.stream === 'stderr' && 'text-destructive')}>
              {stamps && l.at && <span className="mr-3 text-muted-foreground select-none">{time.format(new Date(l.at))}</span>}
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatsView({ id, samples }: { id: string; samples: StatsSample[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const rows = samples
    .map((s) => ({ t: Date.parse(s.at), s: s.stats.find((x) => x.id === id) }))
    .filter((r): r is { t: number; s: ContainerStats } => !!r.s)
    .map((r) => ({ t: r.t, cpu: r.s.cpu, memory: r.s.memory }))
  const last = samples.at(-1)?.stats.find((x) => x.id === id)
  if (!last) return <Empty icon={Loader2} text="Waiting for the first reading…" />
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Figure label="Memory" value={`${formatBytes(last.memory)}`} sub={`of ${formatBytes(last.memoryLimit)}`} />
        <Figure label="Network in / out" value={`${formatBytes(last.netIn)} / ${formatBytes(last.netOut)}`} />
        <Figure label="Disk read / write" value={`${formatBytes(last.blockIn)} / ${formatBytes(last.blockOut)}`} />
        <Figure label="Processes" value={`${last.pids}`} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">A reading every {STATS_EVERY_MS / 1000} seconds while this page is open. Not saved.</span>
        <Segmented aria-label="Chart or table" value={view} onChange={setView} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />
      </div>
      {view === 'chart' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <MiniChart title="CPU" rows={rows} dataKey="cpu" format={(v) => `${v.toFixed(v < 1 ? 2 : 1)}%`} />
          <MiniChart title="Memory" rows={rows} dataKey="memory" format={formatBytes} />
        </div>
      ) : (
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Time</th>
                <th className="py-2 text-right font-medium">CPU</th>
                <th className="py-2 text-right font-medium">Memory</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.t} className="border-b last:border-0">
                  <td className="py-1.5">{time.format(new Date(r.t))}</td>
                  <td className="py-1.5 text-right font-mono">{r.cpu.toFixed(1)}%</td>
                  <td className="py-1.5 text-right font-mono">{formatBytes(r.memory)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MiniChart({ title, rows, dataKey, format }: { title: string; rows: { t: number; cpu: number; memory: number }[]; dataKey: 'cpu' | 'memory'; format: (v: number) => string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{title}</span>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t) => time.format(new Date(t))} {...axisProps} minTickGap={48} />
            <YAxis {...axisProps} width={64} tickFormatter={(v) => format(Number(v))} />
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipContent title={time.format(new Date(Number(label)))} rows={[{ key: dataKey, label: title, value: format(Number(payload[0].value)), color: 'var(--series-1)' }]} />
                ) : null
              }
            />
            <Line type="monotone" dataKey={dataKey} name={title} stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function InfoView({ id }: { id: string }) {
  const desktop = isDesktop()
  const query = useModuleQuery<ContainerInfo>('docker', 'getContainer', { id })
  const info = query.data ?? (desktop ? undefined : { ...sampleInfo, id })
  if (!info) return <Empty icon={Loader2} text={query.error?.message ?? 'Reading…'} />
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-[160px_1fr]">
      <Row label="Command">
        <code className="font-mono text-xs">{info.command}</code>
      </Row>
      <Row label="Started">{info.startedAt ? formatRelative(info.startedAt) : 'Not running'}</Row>
      <Row label="Restart policy">
        {info.restartPolicy ?? 'no'} · {info.restarts} restart{info.restarts === 1 ? '' : 's'}
      </Row>
      <Row label="Ports">{info.ports.length ? info.ports.map((p) => <div key={p} className="font-mono text-xs">{p}</div>) : 'None published'}</Row>
      <Row label="Mounts">
        {info.mounts.length
          ? info.mounts.map((m) => (
              <div key={m.target} className="font-mono text-xs">
                {m.source} → {m.target} <span className="text-muted-foreground">({m.type}{m.readOnly ? ', read-only' : ''})</span>
              </div>
            ))
          : 'None'}
      </Row>
      <Row label="Networks">{info.networks.join(', ') || 'None'}</Row>
      <Row label="Environment">
        <div className="flex flex-wrap gap-1">
          {info.envNames.map((n) => (
            <Badge key={n} variant="secondary" className="font-mono">
              {n}
            </Badge>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Names only. Values can hold passwords, so MonoRail never reads them out.</p>
      </Row>
      <Row label="Labels">
        {info.labels.map((l) => (
          <div key={l.key} className="font-mono text-xs">
            <span className="text-muted-foreground">{l.key}=</span>
            {l.value}
          </div>
        ))}
      </Row>
    </dl>
  )
}

function ImagesView({ overview }: { overview: DockerOverview }) {
  const images = [...overview.images].sort((a, b) => b.size - a.size)
  const dangling = images.filter((i) => i.dangling)
  if (!images.length) return <Empty icon={Layers} text="No images yet." />
  return (
    <>
      {dangling.length > 0 && (
        <div className="flex items-center gap-2 bg-warning-soft px-6 py-3 text-sm text-warning-soft-foreground">
          <AlertTriangle className="size-4" />
          {dangling.length} untagged image{dangling.length === 1 ? '' : 's'} ({formatBytes(dangling.reduce((n, i) => n + i.size, 0))}) left over from earlier builds. Docker's own "docker image prune" removes them; MonoRail does not.
        </div>
      )}
      <Table
        head={['Image', 'Tag', 'Used by', 'Created', 'Size']}
        rows={images.map((i) => [
          <span key="r" className={cn('font-mono', i.dangling && 'text-muted-foreground')}>{i.repository}</span>,
          <span key="t" className="font-mono">{i.tag}</span>,
          i.containers ? `${i.containers} container${i.containers === 1 ? '' : 's'}` : <span key="u" className="text-muted-foreground">Unused</span>,
          i.createdAt ? formatRelative(i.createdAt) : '',
          <span key="s" className="font-mono">{formatBytes(i.size)}</span>,
        ])}
      />
    </>
  )
}

function VolumesView({ overview }: { overview: DockerOverview }) {
  if (!overview.volumes.length) return <Empty icon={Database} text="No volumes." />
  return (
    <Table
      head={['Volume', 'Driver', 'Used by', 'Size']}
      rows={[...overview.volumes]
        .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
        .map((v) => [
          <span key="n" className="font-mono">{v.name}</span>,
          v.driver,
          v.containers ? `${v.containers} container${v.containers === 1 ? '' : 's'}` : <span key="u" className="text-muted-foreground">Unused</span>,
          <span key="s" className="font-mono">{v.size === undefined ? '' : formatBytes(v.size)}</span>,
        ])}
    />
  )
}

function NetworksView({ overview }: { overview: DockerOverview }) {
  return (
    <Table
      head={['Network', 'Driver', 'Scope', 'Containers']}
      rows={overview.networks.map((n) => [<span key="n" className="font-mono">{n.name}</span>, n.driver, n.scope, `${n.containers}`])}
    />
  )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  const last = head.length - 1
  return (
    <div className="overflow-x-auto px-6 py-2">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            {head.map((h, i) => (
              <th key={h} className={cn('py-3 font-medium', i === last ? 'text-right' : 'text-left')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
              {r.map((cell, j) => (
                <td key={j} className={cn('py-2.5 pr-4', j === last && 'pr-0 text-right')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: typeof Boxes; text: string }) {
  return (
    <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
      <Icon className="size-6" />
      {text}
    </CardContent>
  )
}

