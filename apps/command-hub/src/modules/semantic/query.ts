import type { GroupByDimension, QueryRequest, SemanticMetric, TimeGrain } from './types'

export const GRAINS: TimeGrain[] = ['day', 'week', 'month', 'quarter', 'year']

/** Names MetricFlow accepts for metrics and group-bys. The backend checks the same. */
export const NAME_RE = /^[a-z_][a-z0-9_]*(__[a-z0-9_]+)*$/i

export type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in'

export interface FilterRow {
  dimension: string
  op: FilterOp
  value: string
}

function quote(v: string): string {
  const t = v.trim()
  if (/^-?\d+(\.\d+)?$/.test(t) || /^(true|false)$/i.test(t)) return t
  return `'${t.replace(/'/g, "''")}'`
}

/** A filter row as MetricFlow's Jinja where clause. */
export function filterToWhere(f: FilterRow, dims: GroupByDimension[]): string {
  const d = dims.find((x) => x.name === f.dimension)
  const ref = d?.type === 'time' ? `{{ TimeDimension('${f.dimension}', 'day') }}` : `{{ Dimension('${f.dimension}') }}`
  if (f.op === 'in') {
    const list = f.value.split(',').map((v) => v.trim()).filter(Boolean).map(quote)
    return `${ref} IN (${list.join(', ')})`
  }
  return `${ref} ${f.op} ${quote(f.value)}`
}

/** Dimensions every chosen metric can be split by. */
export function sharedDimensions(metrics: SemanticMetric[], all: GroupByDimension[]): GroupByDimension[] {
  if (!metrics.length) return all.filter((d) => d.name !== 'metric_time')
  const allowed = metrics.map((m) => new Set(m.dimensions))
  return all.filter((d) => d.name !== 'metric_time' && allowed.every((s) => s.has(d.name)))
}

function shellArg(v: string): string {
  return /^[\w.,:/=-]+$/.test(v) ? v : `"${v.replace(/(["\\$`])/g, '\\$1')}"`
}

/** The same query as an `mf query` command, to copy into a terminal. */
export function mfCommand(req: QueryRequest): string {
  const parts = ['mf query', `--metrics ${req.metrics.join(',')}`]
  if (req.groupBy.length) parts.push(`--group-by ${req.groupBy.join(',')}`)
  for (const w of req.where) parts.push(`--where ${shellArg(w)}`)
  if (req.start) parts.push(`--start-time ${req.start}`)
  if (req.end) parts.push(`--end-time ${req.end}`)
  if (req.orderBy.length) parts.push(`--order ${req.orderBy.join(',')}`)
  if (req.limit) parts.push(`--limit ${req.limit}`)
  return parts.join(' ')
}

/** Short labels for column names: `order__channel` -> `channel`, `metric_time__week` -> `week`. */
export function shortName(name: string): string {
  if (name.startsWith('metric_time__')) return name.slice('metric_time__'.length)
  const i = name.lastIndexOf('__')
  return i >= 0 ? name.slice(i + 2) : name
}
