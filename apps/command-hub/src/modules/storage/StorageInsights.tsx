import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBytes } from '@/lib/format'
import type { ScanState, StorageHistory, StorageLocation } from './types'

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

/** Compare complete measurements only: timed-out scans are lower bounds. */
export function StorageInsights({ scan, history, desktop, onOpen }: { scan?: ScanState; history?: StorageHistory; desktop: boolean; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState('previous')
  const locations = scan?.locations ?? []
  const savedScans = (history?.snapshots ?? []).filter((s) => s.kind === 'scan' && s.locations)
  // While scanning, the displayed locations still belong to the last saved scan.
  const scans = scan?.finishedAt ? savedScans.filter((s) => Date.parse(s.takenAt) < Date.parse(scan.finishedAt!)) : savedScans.slice(0, -1)
  const comparison = selected === 'previous' ? scans.at(-1) : scans.find((s) => s.takenAt === selected)
  const previous = new Map((comparison?.locations ?? []).map((l) => [l.id, l]))
  const largest = locations.filter((l) => l.bytes !== undefined).sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 8)
  const growth = locations.flatMap((l) => {
    const before = previous.get(l.id)
    if (l.bytes === undefined || l.truncated || before?.bytes === undefined || before.truncated) return []
    return [{ location: l, change: l.bytes - before.bytes }]
  }).filter((row) => row.change > 0).sort((a, b) => b.change - a.change).slice(0, 8)
  const maxGrowth = growth[0]?.change ?? 1
  if (!locations.length) return null
  return (
    <section className="flex flex-col gap-4" aria-label="Storage insights">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-sm font-semibold">Scan insights</h2><p className="text-xs text-muted-foreground">Selected locations only; folder sizes can overlap and include cloud-only files.</p></div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Compare to
          <select className="max-w-64 rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!scans.length}>
            <option value="previous">Previous scan{scans.length ? ` (${dateTime.format(new Date(scans.at(-1)!.takenAt))})` : ' (none yet)'}</option>
            {[...scans].reverse().slice(1).map((s) => <option key={s.takenAt} value={s.takenAt}>{dateTime.format(new Date(s.takenAt))}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Where space grew</CardTitle><CardDescription>Largest increases among comparable locations{comparison ? ` since ${dateTime.format(new Date(comparison.takenAt))}` : ''}. Timed-out measurements are excluded.</CardDescription></CardHeader>
          <CardContent>{!comparison ? <p className="text-sm text-muted-foreground">Run another scan to compare folder growth.</p> : !growth.length ? <p className="text-sm text-muted-foreground">No comparable locations grew during this period.</p> : <div className="space-y-3">
            {growth.map(({ location, change }) => <div key={location.id}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="truncate" title={location.path}>{location.label}</span><span className="shrink-0 font-mono tabular-nums">+{formatBytes(change)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-warning" style={{ width: `${(change / maxGrowth) * 100}%` }} /></div></div>)}
          </div>}</CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Largest measured locations</CardTitle><CardDescription>Ranked by the latest scan. Open a location to investigate it in Explorer.</CardDescription></CardHeader>
          <CardContent><div className="divide-y">{largest.map((location) => <LargestRow key={location.id} location={location} desktop={desktop} onOpen={onOpen} />)}</div></CardContent>
        </Card>
      </div>
    </section>
  )
}

function LargestRow({ location, desktop, onOpen }: { location: StorageLocation; desktop: boolean; onOpen: (id: string) => void }) {
  return <div className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{location.label}</div><div className="truncate font-mono text-xs text-muted-foreground" title={location.path}>{location.path}</div></div><span className="shrink-0 font-mono text-sm tabular-nums">{location.truncated ? '≥ ' : ''}{formatBytes(location.bytes!)}</span><Button variant="ghost" size="icon" disabled={!desktop} onClick={() => onOpen(location.id)} aria-label={`Open ${location.label}`}><FolderOpen /></Button></div>
}
