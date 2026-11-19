import type { BqCell, BqField } from './types'

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** Bytes in binary units, as BigQuery's console shows them ("1.24 GB"). */
export function formatBytes(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  let v = n
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${UNITS[i]}`
}

export function formatCount(n: number | undefined): string {
  return n === undefined ? '—' : n.toLocaleString()
}

/** A duration in ms: "850 ms", "12.4 sec", "3 min 05 sec". */
export function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} sec`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return m < 60 ? `${m} min ${String(s).padStart(2, '0')} sec` : `${Math.floor(m / 60)} hr ${m % 60} min`
}

export function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export function durationMs(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

/** One cell as text in the grid. Records and arrays read as JSON. */
export function cellText(v: BqCell): string {
  if (v === null) return 'null'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Rows as objects keyed by column name (the JSON view and export). */
export function rowsAsObjects(fields: BqField[], rows: BqCell[][]): Record<string, BqCell>[] {
  return rows.map((r) => Object.fromEntries(fields.map((f, i) => [f.name, r[i] ?? null])))
}

function csvField(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(fields: BqField[], rows: BqCell[][]): string {
  const head = fields.map((f) => csvField(f.name)).join(',')
  const body = rows.map((r) => r.map((v) => (v === null ? '' : csvField(cellText(v)))).join(','))
  return [head, ...body].join('\r\n')
}

/** Hand the browser a file to save (no backend involved). */
export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const NUMERIC_TYPES = new Set(['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'])

/** `project.dataset.table` with backticks, ready for a FROM clause. */
export function tableRef(projectId: string, datasetId: string, tableId: string): string {
  return `\`${projectId}.${datasetId}.${tableId}\``
}

// ---------- formatting SQL ----------

const KEYWORDS = new Set(
  (
    'select from where group by order having limit offset join inner left right full outer cross on using as and or not in is null ' +
    'like between case when then else end distinct union all intersect except with over partition window qualify asc desc ' +
    'insert into values update set delete merge create replace table view if exists drop alter cast safe_cast struct array ' +
    'unnest interval true false declare begin exception commit rollback rows range preceding following current row unbounded ' +
    'count sum avg min max any_value array_agg string_agg extract date timestamp datetime time coalesce ifnull nullif'
  ).split(' '),
)

const BREAK_BEFORE = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'QUALIFY',
  'WINDOW',
  'LIMIT',
  'UNION ALL',
  'UNION DISTINCT',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'FULL OUTER JOIN',
  'LEFT OUTER JOIN',
  'INNER JOIN',
  'CROSS JOIN',
  'JOIN',
]

interface Token {
  kind: 'word' | 'other' | 'space' | 'literal'
  text: string
}

/** Split SQL so strings, quoted names and comments are never touched. */
function tokenize(sql: string): Token[] {
  const out: Token[] = []
  const re = /(--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`[^`]*`)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([\s\S])/g
  for (const m of sql.matchAll(re)) {
    if (m[1]) out.push({ kind: 'literal', text: m[1] })
    else if (m[2]) out.push({ kind: 'word', text: m[2] })
    else if (m[3]) out.push({ kind: 'space', text: m[3] })
    else out.push({ kind: 'other', text: m[4] })
  }
  return out
}

/**
 * A light formatter: keywords upper case, one clause per line, top-level
 * select lists one column per line. Strings, quoted names and comments are
 * left exactly as written.
 */
export function formatSql(sql: string): string {
  const tokens = tokenize(sql)
  // Collapse whitespace runs (outside literals) to single spaces, uppercase keywords.
  const flat: Token[] = []
  for (const t of tokens) {
    if (t.kind === 'space') {
      const keepNewline = flat.length && flat[flat.length - 1].kind === 'literal' && /^(--|#)/.test(flat[flat.length - 1].text)
      flat.push({ kind: 'space', text: keepNewline ? '\n' : ' ' })
    } else if (t.kind === 'word' && KEYWORDS.has(t.text.toLowerCase())) {
      flat.push({ kind: 'word', text: t.text.toUpperCase() })
    } else flat.push(t)
  }
  let out = ''
  let depth = 0
  let inSelect = false
  for (let i = 0; i < flat.length; i++) {
    const t = flat[i]
    if (t.kind === 'other' && t.text === '(') depth++
    if (t.kind === 'other' && t.text === ')') depth = Math.max(0, depth - 1)
    if (t.kind === 'word' && depth === 0) {
      const two = `${t.text} ${flat[i + 2]?.text ?? ''}`
      const three = `${two} ${flat[i + 4]?.text ?? ''}`
      const hit = [three, two, t.text].find((s) => BREAK_BEFORE.includes(s))
      if (hit) {
        out = out.replace(/[ \t]+$/, '')
        if (out && !out.endsWith('\n')) out += '\n'
        inSelect = hit === 'SELECT'
        out += hit
        i += (hit.split(' ').length - 1) * 2
        out += inSelect ? '\n  ' : ''
        if (inSelect && flat[i + 1]?.kind === 'space') i++
        continue
      }
    }
    if (inSelect && depth === 0 && t.kind === 'other' && t.text === ',') {
      out += ',\n  '
      if (flat[i + 1]?.kind === 'space') i++
      continue
    }
    if (t.kind === 'other' && t.text === ';') {
      out = out.replace(/\s+$/, '') + ';\n\n'
      inSelect = false
      if (flat[i + 1]?.kind === 'space') i++
      continue
    }
    if (t.kind === 'space' && (out.endsWith('\n') || out.endsWith('  ') || out === '')) continue
    out += t.text
  }
  return out.replace(/[ \t]+\n/g, '\n').trim() + '\n'
}
