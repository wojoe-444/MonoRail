import { isObject } from './entity'
import { isTier } from './util'
import type { OmColumn, OmColumnProfile, OmEntity, OmLineage, OmTableProfile, OmTag } from './types'

/** Plain helpers behind the table page (TableView): columns with their profiles, tests and trends. */

export interface TableColumn {
  col: OmColumn
  /** How deep in a nested column it sits (0: top level). */
  depth: number
  /** `name` or `parent.child`: unique within the table, used to select it. */
  path: string
  /** The column's fully qualified name, as lineage and tests name it. */
  fqn: string
  profile?: OmColumnProfile
  key?: 'Primary key' | 'Unique'
  /** Glossary terms on the column. */
  terms: OmTag[]
  /** Classification tags on the column (tiers left out). */
  tags: OmTag[]
}

const KEY_LABEL: Record<string, TableColumn['key']> = { PRIMARY_KEY: 'Primary key', UNIQUE: 'Unique' }

/** Every column, nested ones after their parent, with its latest profile, key, terms and tags. */
export function flattenColumns(entity: OmEntity, profile?: OmTableProfile): TableColumn[] {
  const tableFqn = entity.fullyQualifiedName ?? entity.name
  const profiles = new Map((profile?.columns ?? []).map((p) => [p.name, p]))
  // OpenMetadata also lists keys apart from the columns (tableConstraints).
  const constraintKeys = new Map<string, TableColumn['key']>()
  for (const c of Array.isArray(entity.tableConstraints) ? entity.tableConstraints : []) {
    if (!isObject(c) || !Array.isArray(c.columns)) continue
    const label = KEY_LABEL[String(c.constraintType)]
    if (label) for (const name of c.columns) if (typeof name === 'string' && !constraintKeys.has(name)) constraintKeys.set(name, label)
  }
  const out: TableColumn[] = []
  const walk = (cols: OmColumn[] | undefined, depth: number, parent: string) => {
    for (const col of cols ?? []) {
      const path = parent ? `${parent}.${col.name}` : col.name
      const tags = col.tags ?? []
      out.push({
        col,
        depth,
        path,
        fqn: col.fullyQualifiedName ?? `${tableFqn}.${path}`,
        profile: profiles.get(path) ?? profiles.get(col.name),
        key: KEY_LABEL[col.constraint ?? ''] ?? (depth === 0 ? constraintKeys.get(col.name) : undefined),
        terms: tags.filter((t) => t.source === 'Glossary'),
        tags: tags.filter((t) => t.source !== 'Glossary' && !isTier(t)),
      })
      walk(col.children, depth + 1, path)
    }
  }
  walk(Array.isArray(entity.columns) ? (entity.columns as OmColumn[]) : [], 0, '')
  return out
}

/** The share of a column's values that are set (0 to 1), from whatever the profile has. */
export function filledShare(p: OmColumnProfile | undefined, rowCount?: number): number | undefined {
  if (!p) return undefined
  if (typeof p.nullProportion === 'number') return Math.min(1, Math.max(0, 1 - p.nullProportion))
  if (typeof p.valuesCount === 'number' && typeof p.nullCount === 'number' && p.valuesCount + p.nullCount > 0) return p.valuesCount / (p.valuesCount + p.nullCount)
  if (typeof p.nullCount === 'number' && rowCount) return Math.min(1, Math.max(0, 1 - p.nullCount / rowCount))
  return undefined
}

/** A share as a percent that never rounds a gap away: 99.6%, not 100%; 0.4%, not 0%. */
export function percentText(share: number | undefined): string {
  if (share === undefined || !Number.isFinite(share)) return '–'
  if (share === 0 || share === 1) return `${share * 100}%`
  const p = share * 100
  return p < 1 || p > 99 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`
}

export type TypeKind = 'text' | 'number' | 'date' | 'time' | 'boolean' | 'struct' | 'array' | 'binary' | 'other'

/** What kind of value a column holds, from OpenMetadata's dataType. */
export function typeKind(dataType: string | undefined): TypeKind {
  const t = (dataType ?? '').toUpperCase()
  if (!t) return 'other'
  if (/^(STRUCT|MAP|JSON|RECORD|OBJECT|VARIANT|UNION)/.test(t)) return 'struct'
  if (/^ARRAY/.test(t)) return 'array'
  if (/^(BOOL|BOOLEAN)$/.test(t)) return 'boolean'
  if (/^(DATETIME|TIMESTAMP|TIMESTAMPZ|TIME|INTERVAL)/.test(t)) return 'time'
  if (t === 'DATE') return 'date'
  if (/^(BINARY|VARBINARY|BLOB|BYTES|BYTEA|LONGBLOB|MEDIUMBLOB)/.test(t)) return 'binary'
  if (/^(INT|TINYINT|SMALLINT|MEDIUMINT|BIGINT|INT64|NUMERIC|BIGNUMERIC|DECIMAL|NUMBER|FLOAT|DOUBLE|REAL|LONG|BYTEINT|MONEY)/.test(t)) return 'number'
  if (/^(STRING|VARCHAR|CHAR|TEXT|NVARCHAR|NCHAR|CLOB|MEDIUMTEXT|LONGTEXT|UUID|ENUM|CITEXT)/.test(t)) return 'text'
  return 'other'
}

// ---------- Tests ----------

export type TestStatus = 'Success' | 'Failed' | 'Aborted' | 'Queued'

export interface TableTest {
  entity: OmEntity
  /** The column it checks, when it is a column test. */
  column?: string
  status?: TestStatus
  result?: string
  /** When it last ran (epoch ms). */
  at?: number
}

/** `<#E::table::FQN>` or `<#E::table::FQN::columns::col>`. */
export function parseEntityLink(link: unknown): { type: string; fqn: string; column?: string } | undefined {
  if (typeof link !== 'string') return undefined
  const m = /^<#E::([^:]+)::(.+?)(?:::columns::(.+))?>$/.exec(link)
  return m ? { type: m[1], fqn: m[2], column: m[3] } : undefined
}

const STATUS_ORDER: Record<string, number> = { Failed: 0, Aborted: 1, Queued: 2, Success: 3 }

/** The table's tests with their last result, failing first, then by name. */
export function tableTests(cases: OmEntity[]): TableTest[] {
  return cases
    .map((entity) => {
      const r = isObject(entity.testCaseResult) ? entity.testCaseResult : undefined
      const status = typeof r?.testCaseStatus === 'string' ? (r.testCaseStatus as TestStatus) : undefined
      return {
        entity,
        column: parseEntityLink(entity.entityLink)?.column,
        status,
        result: typeof r?.result === 'string' ? r.result : undefined,
        at: typeof r?.timestamp === 'number' ? r.timestamp : undefined,
      }
    })
    .sort((a, b) => (STATUS_ORDER[a.status ?? ''] ?? 4) - (STATUS_ORDER[b.status ?? ''] ?? 4) || a.entity.name.localeCompare(b.entity.name))
}

export function testCounts(tests: TableTest[]) {
  const passed = tests.filter((t) => t.status === 'Success').length
  const failed = tests.filter((t) => t.status === 'Failed').length
  const last = Math.max(0, ...tests.map((t) => t.at ?? 0))
  return { total: tests.length, passed, failed, other: tests.length - passed - failed, lastRun: last || undefined }
}

// ---------- Trends and lineage ----------

/** How the row count moved over the kept history: first and last, and the change as a fraction of the first. */
export function rowTrend(history: { timestamp: number; rowCount: number }[]) {
  if (history.length < 2) return undefined
  const first = history[0]
  const last = history[history.length - 1]
  return { first, last, change: last.rowCount - first.rowCount, delta: first.rowCount ? (last.rowCount - first.rowCount) / first.rowCount : undefined }
}

/** Which columns feed a column and which it feeds, from the edges' columnsLineage (one step each way). */
export function columnLineage(data: OmLineage | undefined, columnFqn: string): { from: string[]; to: string[] } {
  if (!data) return { from: [], to: [] }
  const from = new Set<string>()
  const to = new Set<string>()
  for (const e of data.upstreamEdges) {
    if (e.toEntity !== data.entity.id) continue
    for (const c of e.lineageDetails?.columnsLineage ?? []) if (c.toColumn === columnFqn) for (const f of c.fromColumns ?? []) from.add(f)
  }
  for (const e of data.downstreamEdges) {
    if (e.fromEntity !== data.entity.id) continue
    for (const c of e.lineageDetails?.columnsLineage ?? []) if (c.toColumn && c.fromColumns?.includes(columnFqn)) to.add(c.toColumn)
  }
  return { from: [...from], to: [...to] }
}

/** `table.column` from a column's fully qualified name, for compact display. */
export const shortColumn = (fqn: string) => fqn.split('.').slice(-2).join('.')

/** A description's first line as plain text, for the header. */
export function firstLine(markdown: string | undefined): string {
  const line = (markdown ?? '').split('\n').find((l) => l.trim()) ?? ''
  return line.replace(/[#>*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()
}
