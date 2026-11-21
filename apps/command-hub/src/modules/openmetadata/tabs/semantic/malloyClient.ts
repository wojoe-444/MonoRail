import { moduleClient } from '@/modules/client'

import { parseMalloy } from './malloy'
import { sampleListing } from './malloySample'

/*
 * The page side of the Malloy backend (electron/modules/malloy.cjs,
 * malloy-lib.cjs): Malloy models compiled by the real Malloy compiler and run
 * on BigQuery with the user's gcloud login. In the browser dev server (no
 * backend) the same calls answer from the fictional sample files, compiled by
 * the tolerant reader in malloy.ts, with made-up rows.
 */

/** Why the backend could not do what was asked. */
export type MalloyBlock = 'not-set-up' | 'no-folder' | 'no-project' | 'no-gcloud' | 'run-off'

export interface MalloyStatus {
  block?: 'not-set-up' | 'no-folder'
  /** The models folder's own name, never its path. */
  folderName?: string
  /** "Run queries on BigQuery" is on. */
  run?: boolean
  /** A Google Cloud login is available (the token could be fetched). */
  gcloud?: boolean
  /** The project queries are billed to. */
  project?: string
  maxBytesBilled?: number
  rowLimit?: number
}

export interface MalloyProblem {
  message: string
  severity: 'error' | 'warn' | 'debug'
  /** 1-based. */
  line?: number
  character?: number
  /** Relative to the models folder. */
  file?: string
}

export interface OutlineField {
  name: string
  kind: 'dimension' | 'measure' | 'view' | 'join'
  /** Malloy's type: string, number, boolean, date, timestamp, … */
  type?: string
  description?: string
  /** Joins only: one | many | cross, the source joined, its table, and its own fields. */
  relationship?: string
  source?: string
  tablePath?: string
  fields?: OutlineField[]
  /** Where it is defined: a file relative to the models folder, 1-based line. */
  file?: string
  line?: number
}

export interface OutlineSource {
  name: string
  description?: string
  /** `project.dataset.table` for a table source. */
  tablePath?: string
  connection?: string
  primaryKey?: string
  fields: OutlineField[]
  file?: string
  line?: number
}

export interface MalloyCompiled {
  ok: boolean
  block?: MalloyBlock
  sources: OutlineSource[]
  queries: { name: string }[]
  problems: MalloyProblem[]
}

export interface MalloyEstimate {
  /** Bytes BigQuery's dry run says the query scans. */
  bytes?: number
  maxBytesBilled?: number
  error?: string
}

export interface MalloySql {
  ok: boolean
  block?: MalloyBlock
  sql?: string
  estimate?: MalloyEstimate
  problems: MalloyProblem[]
}

export interface MalloyResultField {
  name: string
  /** string | number | boolean | date | timestamp | nested | … */
  type: string
  isMeasure: boolean
}

export interface MalloyRun extends MalloySql {
  fields?: MalloyResultField[]
  rows?: Record<string, unknown>[]
  totalRows?: number
  /** More rows than the backend keeps (rowLimit). */
  truncated?: boolean
  ms?: number
}

export const malloyCall = moduleClient('malloy', (method, args) =>
  new Promise((resolve) => setTimeout(() => resolve(sampleAnswer(method, args)), 150)),
)

/** A Malloy query as text, quoted the way Malloy reads names. */
export const malloyName = (name: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `\`${name.replace(/`/g, '')}\``)

// ---------- Browser sample ----------

function sampleOutline(path: string): MalloyCompiled {
  const file = sampleListing.files.find((f) => f.path === path)
  if (!file?.text) return { ok: false, sources: [], queries: [], problems: [{ message: `${path} was not found in the models folder.`, severity: 'error' }] }
  const model = parseMalloy(file.path, file.text)
  const typeOf = (expr: string) => (/count\(|sum\(|avg\(|\.sum|\.avg|\.count|min\(|max\(|\/|\*/.test(expr) ? 'number' : /_at\b|time|date|month|day|year/.test(expr) ? 'timestamp' : /[<>=]| and | or /.test(expr) ? 'boolean' : 'string')
  return {
    ok: true,
    sources: model.sources.map((s) => ({
      name: s.name,
      description: s.description,
      tablePath: s.table,
      connection: s.connection ?? 'bigquery',
      primaryKey: s.primaryKey,
      file: path,
      line: s.line,
      fields: [
        ...s.fields.map((f) => ({ name: f.name, kind: f.kind, type: f.kind === 'view' ? undefined : f.kind === 'measure' ? 'number' : typeOf(f.expr), description: f.description, file: path, line: f.line })),
        ...s.joins.map((j) => ({ name: j.name, kind: 'join' as const, relationship: j.kind, source: j.target, file: path, line: j.line, fields: [] })),
      ],
    })),
    queries: model.queries.map((q) => ({ name: q.name })),
    problems: [],
  }
}

/** Made-up rows for a query: one dimension value per group, numbers for the rest. */
function sampleRun(query: string): MalloyRun {
  const names = (key: string) =>
    [...query.matchAll(new RegExp(`${key}:\\s*([^\\n}]+)`, 'g'))].flatMap((m) =>
      m[1]
        .split(/[,;]/)
        .map((x) => x.trim().split(/\s+is\s+/)[0].split('.').pop()!.trim())
        .filter(Boolean),
    )
  const dims = names('group_by')
  const measures = names('aggregate')
  const fields: MalloyResultField[] = [...dims.map((name) => ({ name, type: 'string', isMeasure: false })), ...measures.map((name) => ({ name, type: 'number', isMeasure: true }))]
  if (!fields.length) fields.push({ name: 'row_count', type: 'number', isMeasure: true })
  const groups = dims.length ? ['Harbor', 'Old Town', 'Riverside', 'Station', 'Uptown'] : ['']
  const rows = groups.map((g, i) => Object.fromEntries(fields.map((f, k) => [f.name, f.isMeasure ? Math.round((1000 / (i + 1)) * (k + 1)) : `${g}${k ? ` ${k}` : ''}`])))
  return { ok: true, sql: `-- Sample: the browser dev server runs no Malloy\nSELECT ...`, estimate: { bytes: 18_400_000, maxBytesBilled: 1024 ** 3 }, fields, rows, totalRows: rows.length, ms: 420, problems: [] }
}

function sampleAnswer(method: string, args: Record<string, unknown> = {}): unknown {
  switch (method) {
    case 'status':
      return { folderName: sampleListing.folderName, run: true, gcloud: true, project: 'lantern-demo', maxBytesBilled: 1024 ** 3, rowLimit: 1000 } satisfies MalloyStatus
    case 'listModels':
      return sampleListing
    case 'compile':
      return sampleOutline(String(args.path ?? ''))
    case 'sql':
      return { ok: true, sql: `-- Sample: the browser dev server runs no Malloy\n-- ${String(args.query ?? '').split('\n').join('\n-- ')}\nSELECT ...`, estimate: { bytes: 18_400_000, maxBytesBilled: 1024 ** 3 }, problems: [] } satisfies MalloySql
    case 'run':
      return sampleRun(String(args.query ?? ''))
    default:
      throw new Error(`Unknown method ${method}`)
  }
}
