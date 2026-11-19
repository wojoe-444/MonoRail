/**
 * A small, tolerant reader for Malloy source files. MonoRail runs no Malloy:
 * this only finds what a file declares (sources, the table or source each
 * extends, primary key, joins, dimensions, measures, views, named queries,
 * imports) so the Malloy tab can show it. Anything it does not understand is
 * skipped, never an error; the source text is always shown beside it.
 */

export type MalloyFieldKind = 'dimension' | 'measure' | 'view'

export interface MalloyField {
  name: string
  kind: MalloyFieldKind
  /** The definition after `is`, trimmed and collapsed to one line. */
  expr: string
  /** The same as written, line breaks kept (comments too). */
  definition: string
  line: number
  /** From a `#"` doc annotation (or `# description=`) right above it. */
  description?: string
}

export interface MalloyJoin {
  name: string
  kind: 'one' | 'many' | 'cross'
  /** The source joined; the join's own name when it is not renamed. */
  target: string
  on?: string
  with?: string
  line: number
}

export interface MalloySource {
  name: string
  /** What it is built on, as written: `duckdb.table('orders')` or another source's name. */
  base: string
  connection?: string
  table?: string
  /** The source it extends, when `base` is another source. */
  extends?: string
  primaryKey?: string
  fields: MalloyField[]
  joins: MalloyJoin[]
  line: number
  endLine: number
  description?: string
}

export interface MalloyQuery {
  name: string
  expr: string
  line: number
}

export interface MalloyModel {
  path: string
  sources: MalloySource[]
  queries: MalloyQuery[]
  imports: string[]
}

const STATEMENTS = ['source', 'query', 'run', 'import']
const PROPERTIES = ['primary_key', 'join_one', 'join_many', 'join_cross', 'dimension', 'measure', 'view', 'query', 'where', 'rename', 'except', 'accept', 'declare', 'timezone', 'include']

/**
 * Comments and annotations blanked to spaces (offsets and lines stay true),
 * plus the annotations found, by the offset where they start.
 */
function clean(text: string): { code: string; notes: { at: number; text: string }[] } {
  const out = text.split('')
  const notes: { at: number; text: string }[] = []
  let i = 0
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < text.length) {
    const c = text[i]
    const two = text.slice(i, i + 2)
    if (c === '"' && text.startsWith('"""', i)) {
      const end = text.indexOf('"""', i + 3)
      i = end < 0 ? text.length : end + 3
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1
      i = j + 1
    } else if (two === '//' || two === '--') {
      const end = text.indexOf('\n', i)
      const stop = end < 0 ? text.length : end
      blank(i, stop)
      i = stop
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end < 0 ? text.length : end + 2
      blank(i, stop)
      i = stop
    } else if (c === '#') {
      const end = text.indexOf('\n', i)
      const stop = end < 0 ? text.length : end
      notes.push({ at: i, text: text.slice(i, stop) })
      blank(i, stop)
      i = stop
    } else {
      i++
    }
  }
  return { code: out.join(''), notes }
}

/** The description an annotation gives, if any: `#" text` or `# description="text"`. */
function describe(note: string): string | undefined {
  const doc = note.match(/^##?"\s?(.*)$/)
  if (doc) return doc[1].trim() || undefined
  const kv = note.match(/\b(?:description|desc)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/)
  return kv ? (kv[1] ?? kv[2] ?? kv[3]) : undefined
}

/** Offsets where each depth-0 (relative to `from`) keyword `word:` starts, within [from, to). */
function keywordsAt(code: string, from: number, to: number, words: string[]): { word: string; at: number; body: number }[] {
  const found: { word: string; at: number; body: number }[] = []
  let depth = 0
  const re = new RegExp(`\\b(${words.join('|')})\\s*:(?!:)`, 'y')
  for (let i = from; i < to; i++) {
    const c = code[i]
    if (c === "'" || c === '"' || c === '`') {
      if (code.startsWith('"""', i)) {
        const end = code.indexOf('"""', i + 3)
        i = end < 0 ? to : end + 2
        continue
      }
      let j = i + 1
      while (j < to && code[j] !== c && code[j] !== '\n') j += code[j] === '\\' ? 2 : 1
      i = j
      continue
    }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    else if (depth === 0 && /[a-z_]/i.test(c) && (i === 0 || !/[\w.]/.test(code[i - 1]))) {
      re.lastIndex = i
      const m = re.exec(code)
      if (m && m.index === i) {
        found.push({ word: m[1], at: i, body: i + m[0].length })
        i += m[0].length - 1
      }
    }
  }
  return found
}

/** The offset of the brace that closes the one at `open`, or the end. */
function closing(code: string, open: number): number {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    const c = code[i]
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < code.length && code[j] !== c && code[j] !== '\n') j += code[j] === '\\' ? 2 : 1
      i = j
    } else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return code.length
}

/** Trim and drop the common indent of every line after the first. */
function dedent(s: string): string {
  const lines = s.replace(/\r\n?/g, '\n').replace(/^\s*\n/, '').trimEnd().split('\n')
  // Annotations and comments at the end belong to the next definition.
  while (lines.length > 1 && /^\s*(#|\/\/|--|$)/.test(lines[lines.length - 1])) lines.pop()
  const lead = (l: string) => l.length - l.trimStart().length
  const rest = lines.slice(1).filter((l) => l.trim())
  const indent = rest.length ? Math.min(...rest.map(lead)) : 0
  return [lines[0].trim(), ...lines.slice(1).map((l) => l.slice(Math.min(indent, lead(l))))].join('\n').replace(/,$/, '')
}

const one = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * A definition starts a line (or the section) or follows a comma, so `x is null`
 * inside an expression is not read as a new definition.
 */
function startsDefinition(code: string, from: number, i: number): boolean {
  for (let k = i - 1; k >= from; k--) {
    const c = code[k]
    if (c === '\n' || c === ',') return true
    if (c !== ' ' && c !== '\t' && c !== '\r') return false
  }
  return true
}

/** Split `a is x  b is y` (newline or comma separated) into named definitions, keeping each start offset. */
function definitions(code: string, from: number, to: number): { name: string; expr: string; at: number; exprAt: number; end: number }[] {
  const starts: { name: string; at: number; exprAt: number }[] = []
  let depth = 0
  const re = /([A-Za-z_][\w]*|`[^`]+`)\s+is\b/y
  for (let i = from; i < to; i++) {
    const c = code[i]
    if (c === "'" || c === '"') {
      let j = i + 1
      while (j < to && code[j] !== c && code[j] !== '\n') j += code[j] === '\\' ? 2 : 1
      i = j
      continue
    }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    else if (depth === 0 && /[A-Za-z_`]/.test(c) && startsDefinition(code, from, i)) {
      re.lastIndex = i
      const m = re.exec(code)
      if (m) {
        starts.push({ name: m[1].replace(/`/g, ''), at: i, exprAt: i + m[0].length })
        i += m[0].length - 1
      }
    }
  }
  return starts.map((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1].at : to
    return { name: s.name, at: s.at, exprAt: s.exprAt, end, expr: one(code.slice(s.exprAt, end)).replace(/,$/, '').trim() }
  })
}

function parseJoin(kind: MalloyJoin['kind'], text: string, line: number): MalloyJoin[] {
  // `a is src on x = y`, `src with key`, `src on ...`; several may share one join_one: line.
  const out: MalloyJoin[] = []
  const parts = text.split(/\n(?=\s*[A-Za-z_`][\w`]*\s+(?:is|with|on)\b)/)
  let lineAt = line
  for (const raw of parts) {
    const t = one(raw)
    const m = t.match(/^([A-Za-z_][\w]*|`[^`]+`)(?:\s+is\s+([A-Za-z_][\w.]*))?(?:\s+with\s+(.+?)|\s+on\s+(.+?))?$/s)
    if (m) out.push({ name: m[1].replace(/`/g, ''), kind, target: m[2] ?? m[1].replace(/`/g, ''), with: m[3]?.trim(), on: m[4]?.trim(), line: lineAt })
    lineAt += raw.split('\n').length
  }
  return out
}

function lineOf(code: string): (offset: number) => number {
  const starts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') starts.push(i + 1)
  return (offset: number) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

function baseOf(base: string) {
  const t = base.match(/^(?:([A-Za-z_]\w*)\.)?table\(\s*['"`]([^'"`]+)['"`]\s*\)/)
  if (t) {
    // Older Malloy: table('duckdb:orders').
    const [conn, table] = !t[1] && t[2].includes(':') ? t[2].split(/:(.*)/s) : [t[1], t[2]]
    return { connection: conn, table }
  }
  const s = base.match(/^([A-Za-z_]\w*)\s*$/)
  return s ? { extends: s[1] } : {}
}

export function parseMalloy(path: string, text: string): MalloyModel {
  const { code, notes } = clean(text)
  const line = lineOf(code)
  const noteBefore = (at: number): string | undefined => {
    // The annotations on the lines right above `at` (nothing but blanks between).
    let desc: string | undefined
    for (let k = notes.length - 1; k >= 0; k--) {
      const n = notes[k]
      if (n.at >= at) continue
      if (code.slice(n.at, at).trim()) break
      desc = describe(n.text) ?? desc
      at = n.at
    }
    return desc
  }

  const model: MalloyModel = { path, sources: [], queries: [], imports: [] }
  const top = keywordsAt(code, 0, code.length, STATEMENTS)
  // `import "x"` has no colon.
  for (const m of text.matchAll(/^\s*import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/gm)) model.imports.push(m[1])

  top.forEach((st, k) => {
    const end = k + 1 < top.length ? top[k + 1].at : code.length
    if (st.word === 'source') {
      for (const d of definitions(code, st.body, end)) {
        const at = d.at
        const brace = code.indexOf('{', d.exprAt)
        const hasBody = brace >= 0 && brace < d.end
        const close = hasBody ? closing(code, brace) : d.end
        const base = one(code.slice(d.exprAt, hasBody ? brace : d.end)).replace(/\s*extend$/, '').replace(/\s*\+$/, '')
        const src: MalloySource = {
          name: d.name,
          base,
          ...baseOf(base),
          fields: [],
          joins: [],
          line: line(at),
          endLine: line(close),
          description: noteBefore(at) ?? noteBefore(st.at),
        }
        if (hasBody) {
          const props = keywordsAt(code, brace + 1, close, PROPERTIES)
          props.forEach((p, j) => {
            const pEnd = j + 1 < props.length ? props[j + 1].at : close
            const body = code.slice(p.body, pEnd)
            if (p.word === 'primary_key') src.primaryKey = one(body)
            else if (p.word.startsWith('join_')) src.joins.push(...parseJoin(p.word.slice(5) as MalloyJoin['kind'], body.trim(), line(p.body + body.search(/\S|$/))))
            else if (p.word === 'dimension' || p.word === 'measure' || p.word === 'view' || p.word === 'query') {
              const defs = definitions(code, p.body, pEnd)
              for (const f of defs) {
                src.fields.push({
                  name: f.name,
                  kind: p.word === 'query' ? 'view' : p.word,
                  expr: f.expr,
                  definition: dedent(text.slice(f.exprAt, f.end)),
                  line: line(f.at),
                  description: noteBefore(f.at) ?? (defs[0] === f ? noteBefore(p.at) : undefined),
                })
              }
            }
          })
        }
        model.sources.push(src)
      }
    } else if (st.word === 'query') {
      for (const d of definitions(code, st.body, end)) model.queries.push({ name: d.name, expr: d.expr, line: line(d.at) })
    }
  })
  return model
}

/** The joined source's own definition, when it is in the same file set. */
export function findSource(models: MalloyModel[], name: string, prefer?: string): { model: MalloyModel; source: MalloySource } | undefined {
  const order = prefer ? [...models.filter((m) => m.path === prefer), ...models.filter((m) => m.path !== prefer)] : models
  for (const m of order) {
    const s = m.sources.find((x) => x.name === name)
    if (s) return { model: m, source: s }
  }
  return undefined
}
