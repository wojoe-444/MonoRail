import { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { STATE_INFO, call, duration, errorText, when } from './api'
import type { Pipeline, PipelineStatus } from './types'

const n = (v?: number) => (v ?? 0).toLocaleString()

/** A pipeline's runs: OpenMetadata's per-step summary, failures and the log. */
export function RunsDialog({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const server = pipeline.extension?.monorail?.runner === 'server'
  const [runs, setRuns] = useState<PipelineStatus[]>()
  const [serverLog, setServerLog] = useState<{ lines: string[]; truncated: boolean }>()
  const [selected, setSelected] = useState<string>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await call<PipelineStatus[]>(server ? 'serverRuns' : 'runs', server ? { fqn: pipeline.fullyQualifiedName ?? pipeline.name } : { id: pipeline.id })
      setRuns(list)
      setError('')
      if (server) setServerLog(await call<{ lines: string[]; truncated: boolean }>('serverLogs', { id: pipeline.id }).catch(() => undefined))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [pipeline, server])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Start loading run history when the selected pipeline changes.
    void load()
  }, [load])

  const run = runs?.find((r) => r.runId === selected) ?? runs?.[0]
  // A local run that is still going: read again every two seconds.
  useEffect(() => {
    if (server || run?.pipelineState !== 'running') return
    const t = setInterval(() => void load(), 2000)
    return () => clearInterval(t)
  }, [server, run?.pipelineState, load])

  const log = server ? serverLog?.lines : run?.log
  const failures = (run?.status ?? []).flatMap((s) => s.failures ?? [])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{pipeline.displayName || pipeline.name}</DialogTitle>
          <DialogDescription>
            Runs {server ? 'from the last 30 days on your OpenMetadata server' : 'on this PC (newest 30 kept)'}.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>}
        {!runs && !error && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading runs…
          </p>
        )}
        {runs && runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet. Use Run to start one now.</p>}

        {runs && runs.length > 0 && run && (
          <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
            <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto" aria-label="Runs">
              {runs.map((r) => (
                <li key={r.runId}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.runId)}
                    className={cn('flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', r.runId === run.runId && 'bg-primary-soft text-primary-soft-foreground')}
                  >
                    <span className="truncate">{when(r.startDate)}</span>
                    <span className={cn('size-2 shrink-0 rounded-full', r.pipelineState === 'success' ? 'bg-success' : r.pipelineState === 'failed' ? 'bg-destructive' : r.pipelineState === 'partialSuccess' ? 'bg-warning' : 'bg-info')} aria-label={STATE_INFO[r.pipelineState]?.label} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <Badge variant={STATE_INFO[run.pipelineState]?.variant ?? 'secondary'}>{STATE_INFO[run.pipelineState]?.label ?? run.pipelineState}</Badge>
                <span>{new Date(run.startDate).toLocaleString()}</span>
                {run.endDate && <span>{duration(run.startDate, run.endDate)}</span>}
                {run.extension?.monorail?.trigger && <span>{run.extension.monorail.trigger === 'schedule' ? 'Scheduled' : 'Started by hand'}</span>}
                <span className="font-mono text-xs">{run.runId.slice(0, 8)}</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className={cn(loading && 'animate-spin')} /> Refresh
                </Button>
              </div>

              {(run.status?.length ?? 0) > 0 && (
                <div className="overflow-x-auto rounded-lg ring-1 ring-border">
                  <table className="w-full text-sm tabular-nums">
                    <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Step</th>
                        {['Records', 'Updated', 'Filtered', 'Warnings', 'Errors'].map((h) => (
                          <th key={h} className="px-3 py-2 text-right font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {run.status!.map((s, i) => (
                        <tr key={`${s.name}-${i}`}>
                          <td className="px-3 py-2">{s.name}</td>
                          <td className="px-3 py-2 text-right">{n(s.records)}</td>
                          <td className="px-3 py-2 text-right">{n(s.updated_records)}</td>
                          <td className="px-3 py-2 text-right">{n(s.filtered)}</td>
                          <td className={cn('px-3 py-2 text-right', (s.warnings ?? 0) > 0 && 'text-warning-soft-foreground')}>{n(s.warnings)}</td>
                          <td className={cn('px-3 py-2 text-right', (s.errors ?? 0) > 0 && 'text-destructive')}>{n(s.errors)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {failures.length > 0 && (
                <div className="grid gap-2">
                  {failures.slice(0, 20).map((f, i) => (
                    <p key={i} className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
                      {f.name && <span className="font-medium">{f.name}: </span>}
                      {f.error ?? f.message}
                    </p>
                  ))}
                </div>
              )}

              {log && log.length > 0 && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Log{server ? ' of the last run' : ''}</h3>
                    <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(log.join('\n')).catch(() => undefined)}>
                      <Copy /> Copy
                    </Button>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{log.join('\n')}</pre>
                  {serverLog?.truncated && <p className="text-xs text-muted-foreground">Showing the last 400 lines.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
