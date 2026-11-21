import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AlignLeft, CheckCircle2, CircleAlert, Loader2, Play, Settings2, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'

import { bq, errorText } from './api'
import { formatBytes, formatSql } from './format'
import { ResultsPanel, type RunState } from './ResultsPanel'
import { SqlEditor } from './SqlEditor'
import { DEFAULT_SETTINGS, type BqQueryResult, type QuerySettings } from './types'

const LOCATIONS = ['', 'US', 'EU', 'us-central1', 'us-east1', 'us-east4', 'us-west1', 'europe-west1', 'europe-west2', 'europe-west3', 'europe-north1', 'asia-east1', 'asia-northeast1', 'asia-south1', 'asia-southeast1', 'australia-southeast1', 'northamerica-northeast1', 'southamerica-east1']

type Validation = { state: 'idle' } | { state: 'checking' } | { state: 'ok'; bytes?: number } | { state: 'error'; message: string }

/** "[3:14]" in a BigQuery error: line 3. */
function errorLineOf(message: string): number | undefined {
  const m = message.match(/\[(\d+):(\d+)\]/)
  return m ? Number(m[1]) : undefined
}

interface Props {
  sql: string
  onSql: (sql: string) => void
  settings: QuerySettings
  onSettings: (s: QuerySettings) => void
  projectId?: string
  active: boolean
  /** A query finished: refresh history. */
  onRan: () => void
}

/** One editor tab: the SQL editor, its toolbar with the dry-run estimate, and the results below. */
export function QueryTab({ sql, onSql, settings, onSettings, projectId, active, onRan }: Props) {
  const [selection, setSelection] = useState('')
  const [validation, setValidation] = useState<Validation>({ state: 'idle' })
  const [run, setRun] = useState<RunState>()
  const [paging, setPaging] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [editorHeight, setEditorHeight] = useState(260)
  const cancelled = useRef(false)
  const runSeq = useRef(0)

  const toRun = selection.trim() ? selection : sql

  // Dry-run as the user types, like the console's validator (dry runs are free).
  useEffect(() => {
    if (!active || !projectId || !toRun.trim()) {
      // oxlint-disable-next-line react/set-state-in-effect -- Cancel the visible validation state when this query cannot be dry-run.
      setValidation({ state: 'idle' })
      return
    }
    setValidation({ state: 'checking' })
    let stale = false
    const t = setTimeout(() => {
      bq.dryRun({ projectId, query: toRun, location: settings.location || undefined })
        .then((r) => !stale && setValidation({ state: 'ok', bytes: r.totalBytesProcessed }))
        .catch((e) => !stale && setValidation({ state: 'error', message: errorText(e) }))
    }, 700)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [toRun, projectId, settings.location, active])

  useEffect(() => {
    if (run?.status !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [run?.status])

  const finish = useCallback(
    async (seq: number, r: BqQueryResult, startedAt: number) => {
      let info
      try {
        info = await bq.getJob(r.job)
      } catch {
        /* job details are optional */
      }
      if (seq !== runSeq.current) return
      const error = info?.error ?? (r.errors.length ? r.errors.join('\n') : undefined)
      setRun({
        status: info?.error ? 'error' : 'done',
        startedAt,
        endedAt: Date.now(),
        job: r.job,
        info,
        fields: r.fields,
        rows: r.rows,
        totalRows: r.totalRows,
        tokens: [undefined, r.pageToken],
        page: 0,
        error: info?.error ? error : undefined,
        bytes: r.totalBytesProcessed,
        cacheHit: r.cacheHit,
        dml: r.numDmlAffectedRows,
      })
      onRan()
    },
    [onRan],
  )

  async function start() {
    if (!projectId || !toRun.trim() || run?.status === 'running') return
    const seq = ++runSeq.current
    cancelled.current = false
    const startedAt = Date.now()
    setNow(startedAt)
    setRun({ status: 'running', startedAt, fields: [], rows: [], tokens: [], page: 0 })
    try {
      const maxBytes = Number(settings.maximumBytesBilled)
      let r = await bq.runQuery({
        projectId,
        query: toRun,
        location: settings.location || undefined,
        maximumBytesBilled: maxBytes > 0 ? maxBytes : undefined,
        useQueryCache: settings.useQueryCache,
        maxResults: settings.pageSize,
      })
      setRun((cur) => (cur && seq === runSeq.current ? { ...cur, job: r.job } : cur))
      while (!r.jobComplete) {
        if (cancelled.current || seq !== runSeq.current) return
        r = await bq.getQueryResults({ ...r.job, maxResults: settings.pageSize, timeoutMs: 10_000 })
      }
      if (seq === runSeq.current) await finish(seq, r, startedAt)
    } catch (e) {
      if (seq !== runSeq.current) return
      setRun((cur) => ({ ...(cur ?? { fields: [], rows: [], tokens: [], page: 0, startedAt }), status: cancelled.current ? 'cancelled' : 'error', endedAt: Date.now(), error: errorText(e) }))
      onRan()
    }
  }

  async function stop() {
    cancelled.current = true
    const job = run?.job
    runSeq.current++
    setRun((cur) => (cur ? { ...cur, status: 'cancelled', endedAt: Date.now() } : cur))
    if (job) {
      try {
        await bq.cancelJob(job)
      } catch {
        /* the job may have finished meanwhile */
      }
      onRan()
    }
  }

  async function page(dir: 1 | -1) {
    if (!run?.job) return
    const next = run.page + dir
    if (next < 0 || (dir === 1 && !run.tokens[next])) return
    setPaging(true)
    try {
      const r = await bq.getQueryResults({ ...run.job, maxResults: settings.pageSize, pageToken: run.tokens[next] })
      setRun((cur) => {
        if (!cur) return cur
        const tokens = [...cur.tokens]
        tokens[next + 1] = r.pageToken
        return { ...cur, rows: r.rows, page: next, tokens, totalRows: r.totalRows ?? cur.totalRows }
      })
    } catch (e) {
      setRun((cur) => (cur ? { ...cur, status: 'error', error: errorText(e) } : cur))
    } finally {
      setPaging(false)
    }
  }

  async function changePageSize(n: number) {
    onSettings({ ...settings, pageSize: n })
    if (!run?.job || run.status !== 'done') return
    setPaging(true)
    try {
      const r = await bq.getQueryResults({ ...run.job, maxResults: n })
      setRun((cur) => (cur ? { ...cur, rows: r.rows, page: 0, tokens: [undefined, r.pageToken] } : cur))
    } catch (e) {
      setRun((cur) => (cur ? { ...cur, status: 'error', error: errorText(e) } : cur))
    } finally {
      setPaging(false)
    }
  }

  function startResize(e: ReactPointerEvent) {
    const y0 = e.clientY
    const h0 = editorHeight
    const move = (ev: PointerEvent) => setEditorHeight(Math.max(96, Math.min(window.innerHeight - 260, h0 + ev.clientY - y0)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const running = run?.status === 'running'
  const errorLine = validation.state === 'error' && !selection ? errorLineOf(validation.message) : undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        {running ? (
          <Button size="sm" variant="destructive" onClick={() => void stop()}>
            <Square /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => void start()} disabled={!projectId || !toRun.trim()} title="Ctrl+Enter">
            <Play /> {selection.trim() ? 'Run selection' : 'Run'}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onSql(formatSql(sql))} title="Ctrl+Shift+F">
          <AlignLeft /> Format
        </Button>
        <SettingsDialog settings={settings} onSettings={onSettings} />
        <div className="ml-auto flex min-w-0 items-center gap-1.5 text-xs">
          {validation.state === 'checking' ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Checking…
            </span>
          ) : validation.state === 'ok' ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-success" />
              {validation.bytes !== undefined ? `This ${selection.trim() ? 'selection' : 'query'} will process ${formatBytes(validation.bytes)} when run.` : 'Valid.'}
            </span>
          ) : validation.state === 'error' ? (
            <span className="flex min-w-0 items-center gap-1.5 text-destructive" title={validation.message}>
              <CircleAlert className="size-3.5 shrink-0" />
              <span className="truncate">{validation.message}</span>
            </span>
          ) : !projectId ? (
            <span className="text-muted-foreground">Pick a project to run queries in.</span>
          ) : null}
        </div>
      </div>
      <SqlEditor
        value={sql}
        onChange={onSql}
        onRun={() => void start()}
        onFormat={() => onSql(formatSql(sql))}
        onSelection={setSelection}
        errorLine={errorLine}
        className="shrink-0"
        style={{ height: editorHeight }}
      />
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the editor"
        onPointerDown={startResize}
        className="h-1.5 shrink-0 cursor-row-resize border-y bg-muted/60 hover:bg-primary/20"
      />
      <div className="min-h-0 flex-1">
        <ResultsPanel run={run} pageSize={settings.pageSize} onPageSize={(n) => void changePageSize(n)} onPage={(d) => void page(d)} paging={paging} now={now} />
      </div>
    </div>
  )
}

function SettingsDialog({ settings, onSettings }: { settings: QuerySettings; onSettings: (s: QuerySettings) => void }) {
  const [draft, setDraft] = useState(settings)
  return (
    <Dialog onOpenChange={(open) => open && setDraft(settings)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Settings2 /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Query settings</DialogTitle>
          <DialogDescription>Apply to this tab's queries. Queries run as you, with your own access, and bill to the project picked in the explorer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="bq-location">Data location</Label>
            <NativeSelect id="bq-location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })}>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l || 'Automatic selection'}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bq-maxbytes">Maximum bytes billed</Label>
            <Input id="bq-maxbytes" inputMode="numeric" placeholder="No limit" value={draft.maximumBytesBilled} onChange={(e) => setDraft({ ...draft, maximumBytesBilled: e.target.value.replace(/[^0-9]/g, '') })} />
            <p className="text-xs text-muted-foreground">A query that would bill more than this fails without charge. {Number(draft.maximumBytesBilled) > 0 && `(${formatBytes(Number(draft.maximumBytesBilled))})`}</p>
          </div>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              Use cached results
              <span className="block text-xs text-muted-foreground">Repeat queries read the earlier result for free when the tables have not changed.</span>
            </span>
            <Switch checked={draft.useQueryCache} onCheckedChange={(v) => setDraft({ ...draft, useQueryCache: v })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_SETTINGS)}>
            Reset
          </Button>
          <DialogClose asChild>
            <Button onClick={() => onSettings(draft)}>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
