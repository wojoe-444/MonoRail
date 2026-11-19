import { malloyName, type OutlineField, type OutlineSource } from './malloyClient'
import { joinFields } from './useMalloyModels'

/*
 * The Malloy Query builder's model: the fields a source offers (its own and,
 * through joins, `join.field` paths) and the query text a pick makes.
 */

export interface PickField {
  /** `channel`, or `stores.city` through a join. */
  path: string
  kind: 'dimension' | 'measure' | 'view'
  type?: string
  description?: string
  /** The join it comes through, for grouping; unset for the source's own fields. */
  join?: string
}

/** A source's own fields plus its joined sources' dimensions and measures (two levels deep). */
export function pickFields(source: OutlineSource, siblings: OutlineSource[]): PickField[] {
  const out: PickField[] = []
  const walk = (fields: OutlineField[], prefix: string[], depth: number) => {
    for (const f of fields) {
      if (f.kind === 'join') {
        if (depth < 2) walk(joinFields(f, siblings), [...prefix, f.name], depth + 1)
        continue
      }
      // A joined source's views cannot be used from here.
      if (prefix.length && f.kind === 'view') continue
      out.push({ path: [...prefix, f.name].join('.'), kind: f.kind, type: f.type, description: f.description, join: prefix.length ? prefix.join('.') : undefined })
    }
  }
  walk(source.fields, [], 0)
  return out
}

export type FilterOp = '=' | '!=' | '>' | '<' | 'contains' | 'is null' | 'is not null'
export const FILTER_OPS: FilterOp[] = ['=', '!=', '>', '<', 'contains', 'is null', 'is not null']
export const needsValue = (op: FilterOp) => op !== 'is null' && op !== 'is not null'

export interface MalloyFilter {
  field: string
  op: FilterOp
  value: string
}

export interface MalloyQuerySpec {
  source: string
  /** Run this view instead of the picked fields. */
  view?: string
  dims: string[]
  measures: string[]
  filters: MalloyFilter[]
  /** An output name (see `outputNames`). */
  orderBy?: string
  desc: boolean
  limit?: number
}

/** A field path quoted segment by segment: stores.city, `order date`. */
export const quotePath = (path: string) => path.split('.').map(malloyName).join('.')

const str = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function literal(value: string, type?: string): string {
  const v = value.trim()
  if (type === 'number' && /^-?\d+(\.\d+)?$/.test(v)) return v
  if (type === 'boolean' && /^(true|false)$/i.test(v)) return v.toLowerCase()
  if (type === 'date' || type === 'timestamp') {
    if (v.startsWith('@')) return v
    if (/^\d{4}(-\d{2}(-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?)?)?$/.test(v)) return `@${v.replace('T', ' ')}`
  }
  return str(v)
}

export function filterText(f: MalloyFilter, fields: PickField[]): string | undefined {
  if (!f.field) return undefined
  const name = quotePath(f.field)
  if (f.op === 'is null') return `${name} = null`
  if (f.op === 'is not null') return `${name} != null`
  if (!f.value.trim()) return undefined
  if (f.op === 'contains') return `${name} ~ ${str(`%${f.value.trim()}%`)}`
  return `${name} ${f.op} ${literal(f.value, fields.find((x) => x.path === f.field)?.type)}`
}

/**
 * The name each picked field has in the result: its last segment, or
 * `join_field` when two picks would share one (written as `x is join.field`).
 */
export function outputNames(paths: string[]): { path: string; name: string; aliased: boolean }[] {
  const last = (p: string) => p.split('.').pop()!
  const counts = new Map<string, number>()
  for (const p of paths) counts.set(last(p), (counts.get(last(p)) ?? 0) + 1)
  return paths.map((p) => {
    const clash = (counts.get(last(p)) ?? 0) > 1 && p.includes('.')
    return { path: p, name: clash ? p.replace(/\./g, '_') : last(p), aliased: clash }
  })
}

/** The Malloy query a pick makes. */
export function buildMalloyQuery(spec: MalloyQuerySpec, fields: PickField[]): string {
  const where = spec.filters.map((f) => filterText(f, fields)).filter(Boolean) as string[]
  const lines: string[] = []
  if (where.length) lines.push(`where: ${where.join(', ')}`)
  if (!spec.view) {
    const names = outputNames([...spec.dims, ...spec.measures])
    const item = (n: { path: string; name: string; aliased: boolean }) => (n.aliased ? `${malloyName(n.name)} is ${quotePath(n.path)}` : quotePath(n.path))
    const dims = names.slice(0, spec.dims.length)
    const measures = names.slice(spec.dims.length)
    if (dims.length) lines.push(`group_by: ${dims.map(item).join(', ')}`)
    if (measures.length) lines.push(`aggregate: ${measures.map(item).join(', ')}`)
    if (spec.orderBy) lines.push(`order_by: ${malloyName(spec.orderBy)}${spec.desc ? ' desc' : ' asc'}`)
  }
  if (spec.limit && spec.limit > 0) lines.push(`limit: ${Math.floor(spec.limit)}`)

  const src = malloyName(spec.source)
  if (spec.view) {
    const view = malloyName(spec.view)
    return lines.length ? `run: ${src} -> ${view} + {\n${lines.map((l) => `  ${l}`).join('\n')}\n}` : `run: ${src} -> ${view}`
  }
  return `run: ${src} -> {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`
}

/** Whether the pick can run: fields mode needs at least one dimension or measure. */
export const specReady = (spec: MalloyQuerySpec) => Boolean(spec.view || spec.dims.length || spec.measures.length)
