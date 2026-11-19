import { FileCode2, Settings2, Loader2, Play, RotateCcw, Table2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { MalloyBench } from './malloyBench'
import { malloyName, type MalloySql, type MalloyStatus } from './malloyClient'
import { malloyScanText } from './malloyFormat'
import { openMalloySettings } from './malloySettings'
import { MalloyProblems, MalloyResults } from './MalloyResults'
import type { MalloyViewModel } from './malloyOutline'

/*
 * The Malloy tab's workbench: one query editor per model with Show SQL
 * (compile + BigQuery dry run, runs nothing) and Run (only with "Run queries
 * on BigQuery" on in Malloy settings). Queries live in memory only.
 */

export function MalloyWorkbench({ path, model, status, bench, starter }: { path: string; model: MalloyViewModel; status?: MalloyStatus; bench: MalloyBench; starter: string }) {
  const state = bench.benches[path] ?? {}
  const query = state.query ?? starter
  const canRun = !!status?.run
  const go = (kind: 'sql' | 'run', q = query) => {
    if (!q.trim() || state.busy) return
    void bench.call(path, kind === 'run' && !canRun ? 'sql' : kind, q)
  }

  const ready = [
    ...model.queries.map((q) => ({ key: `q:${q.name}`, label: q.name, query: `run: ${malloyName(q.name)}`, hint: 'Named query' })),
    ...model.sources
      .filter((s) => !s.imported)
      .flatMap((s) => s.fields.filter((f) => f.kind === 'view').map((v) => ({ key: `v:${s.name}.${v.name}`, label: `${s.name} -> ${v.name}`, query: `run: ${malloyName(s.name)} -> ${malloyName(v.name)}`, hint: v.description ?? `View on ${s.name}` }))),
  ]

  const answer = state.last === 'sql' ? state.sql : state.result
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workbench</CardTitle>
        <CardDescription>
          Write a Malloy query against this model. Show SQL compiles it and asks BigQuery&apos;s dry run how much it would scan; Run runs it on BigQuery and shows the rows.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ready.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Views and named queries</span>
            <div className="flex flex-wrap gap-2">
              {ready.map((r) => (
                <Button
                  key={r.key}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  disabled={!!state.busy}
                  title={`${r.hint}\n${r.query}${canRun ? '' : '\n(Run queries is off: shows the SQL)'}`}
                  onClick={() => go('run', r.query)}
                >
                  {canRun ? <Play /> : <FileCode2 />} {r.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Textarea
            aria-label="Malloy query"
            value={query}
            spellCheck={false}
            rows={Math.min(14, Math.max(5, query.split('\n').length + 1))}
            className="font-mono text-xs leading-5"
            placeholder="run: source_name -> view_name"
            onChange={(e) => bench.patch(path, { query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                go('run')
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={!query.trim() || !!state.busy} onClick={() => go('sql')} title="Compile the query and dry-run it on BigQuery. Runs nothing.">
              {state.busy === 'sql' ? <Loader2 className="animate-spin" /> : <FileCode2 />} Show SQL
            </Button>
            <Button size="sm" disabled={!canRun || !query.trim() || !!state.busy} onClick={() => go('run')} title={canRun ? 'Run on BigQuery (Ctrl+Enter)' : 'Turn on Run queries in Malloy settings'}>
              {state.busy === 'run' ? <Loader2 className="animate-spin" /> : <Play />} Run
            </Button>
            {query !== starter && (
              <Button variant="ghost" size="sm" disabled={!!state.busy} onClick={() => bench.patch(path, { query: undefined })} title="Back to the suggested query">
                <RotateCcw /> Reset
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {canRun ? (
                <>Ctrl+Enter runs · at most {status?.maxBytesBilled ? formatBytes(status.maxBytesBilled) : 'the scan limit'} scanned per query</>
              ) : (
                <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={openMalloySettings}>
                  <Settings2 className="size-3" /> Turn on Run queries in Malloy settings
                </button>
              )}
            </span>
          </div>
        </div>

        {state.busy ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {state.busy === 'sql' ? 'Compiling and asking BigQuery for an estimate…' : 'Running on BigQuery…'}
          </div>
        ) : state.error ? (
          <p className="rounded-lg bg-destructive-soft/60 px-3 py-2 text-sm text-destructive-soft-foreground">{state.error}</p>
        ) : state.last === 'sql' && state.sql ? (
          <SqlAnswer sql={state.sql} />
        ) : state.last === 'run' && state.result ? (
          <div className="flex flex-col gap-3">
            <MalloyResults result={state.result} />
            {state.result.sql && (
              <details className="group text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">SQL that ran</summary>
                <SqlText sql={state.result.sql} className="mt-2" />
              </details>
            )}
          </div>
        ) : (
          !answer && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Table2 className="size-4 opacity-60" /> {canRun ? 'Run a query to see its rows here.' : 'Show SQL to see what a query compiles to and how much it would scan.'}
            </p>
          )
        )}
      </CardContent>
    </Card>
  )
}

function SqlText({ sql, className }: { sql: string; className?: string }) {
  return <pre className={cn('max-h-[420px] overflow-auto rounded-lg bg-muted/40 px-4 py-3 font-mono text-xs leading-5 whitespace-pre ring-1 ring-foreground/10', className)}>{sql}</pre>
}

function SqlAnswer({ sql }: { sql: MalloySql }) {
  const scan = malloyScanText(sql.estimate)
  const over = sql.estimate?.bytes !== undefined && sql.estimate.maxBytesBilled !== undefined && sql.estimate.bytes > sql.estimate.maxBytesBilled
  return (
    <div className="flex flex-col gap-2">
      {sql.problems.length > 0 && <MalloyProblems problems={sql.problems} />}
      {scan && <p className={cn('text-xs tabular-nums', over || sql.estimate?.error ? 'text-warning-soft-foreground' : 'text-muted-foreground')}>{scan}{over ? ': over the limit, Run would refuse it' : ''}</p>}
      {sql.sql && <SqlText sql={sql.sql} />}
    </div>
  )
}
