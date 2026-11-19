/**
 * SQLX parsing for the SQLX page. A file is split into pieces: the named
 * blocks Dataform knows (`config`, `js`, `pre_operations`, `post_operations`)
 * and the text around them (the SQL body). Joining every piece's `raw` gives
 * back the file byte for byte, so nothing the page does not touch changes.
 *
 * The config block's body is a JavaScript object literal. `parseConfig` reads
 * the common subset (strings, numbers, booleans, arrays, objects) into values
 * the form edits; anything else (a variable, a function call, a concatenation)
 * is kept as its source text (`raw`) and written back unchanged.
 */

export type BlockKind = 'config' | 'js' | 'pre_operations' | 'post_operations'

export interface TextPiece {
  kind: 'text'
  raw: string
}

export interface BlockPiece {
  kind: BlockKind
  /** From the keyword through the opening brace, e.g. "config {". */
  header: string
  /** Between the braces. */
  inner: string
  raw: string
}

export type Piece = TextPiece | BlockPiece

export interface SqlxFile {
  pieces: Piece[]
  /** Line ending of the file on disk; pieces always use "\n". */
  eol: '\n' | '\r\n'
}

const BLOCK_RE = /^(config|js|pre_operations|post_operations)\s*\{/

// ---------------------------------------------------------------------------
// Scanning

/** Index just past a quoted string starting at `i` (the quote). Handles backslash escapes and SQL triple quotes. */
function skipString(s: string, i: number): number {
  const q = s[i]
  if ((q === "'" || q === '"') && s.startsWith(q.repeat(3), i)) {
    const end = s.indexOf(q.repeat(3), i + 3)
    return end < 0 ? s.length : end + 3
  }
  let j = i + 1
  while (j < s.length) {
    const c = s[j]
    if (c === '\\') j += 2
    else if (c === q) return j + 1
    else j++
  }
  return s.length
}

/** Index just past a JS template literal starting at `i` (the backtick). */
function skipTemplate(s: string, i: number): number {
  let j = i + 1
  while (j < s.length) {
    const c = s[j]
    if (c === '\\') j += 2
    else if (c === '`') return j + 1
    else if (c === '$' && s[j + 1] === '{') {
      const end = matchBrace(s, j + 1, 'js')
      if (end < 0) return s.length
      j = end + 1
    } else j++
  }
  return s.length
}

/**
 * Index of the `}` that closes the `{` at `open`, or -1. `js` mode skips JS
 * strings, templates and comments; `sql` mode skips SQL strings and comments
 * and treats `${ ... }` as JavaScript.
 */
export function matchBrace(s: string, open: number, mode: 'js' | 'sql'): number {
  let depth = 0
  let i = open
  while (i < s.length) {
    const c = s[i]
    const n = s[i + 1]
    if (mode === 'js' && c === '/' && n === '/') {
      const e = s.indexOf('\n', i)
      i = e < 0 ? s.length : e
      continue
    }
    if (mode === 'sql' && c === '-' && n === '-') {
      const e = s.indexOf('\n', i)
      i = e < 0 ? s.length : e
      continue
    }
    if (c === '/' && n === '*') {
      const e = s.indexOf('*/', i + 2)
      i = e < 0 ? s.length : e + 2
      continue
    }
    if (c === "'" || c === '"') {
      i = skipString(s, i)
      continue
    }
    if (c === '`') {
      i = mode === 'js' ? skipTemplate(s, i) : skipString(s, i)
      continue
    }
    if (mode === 'sql' && c === '$' && n === '{') {
      const e = matchBrace(s, i + 1, 'js')
      if (e < 0) return -1
      i = e + 1
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

/** Ranges of `${ ... }` interpolations in SQL text (start at `$`, end past `}`). */
export function interpolations(sql: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  let i = 0
  while (i < sql.length) {
    const c = sql[i]
    const n = sql[i + 1]
    if (c === '-' && n === '-') {
      const e = sql.indexOf('\n', i)
      i = e < 0 ? sql.length : e
    } else if (c === '/' && n === '*') {
      const e = sql.indexOf('*/', i + 2)
      i = e < 0 ? sql.length : e + 2
    } else if (c === "'" || c === '"' || c === '`') {
      i = skipString(sql, i)
    } else if (c === '$' && n === '{') {
      const e = matchBrace(sql, i + 1, 'js')
      const end = e < 0 ? sql.length : e + 1
      out.push({ start: i, end })
      i = end
    } else i++
  }
  return out
}

// ---------------------------------------------------------------------------
// File <-> pieces

export function parseSqlx(text: string): SqlxFile {
  const eol = /\r\n/.test(text) ? '\r\n' : '\n'
  const s = text.replace(/\r\n/g, '\n')
  const pieces: Piece[] = []
  let last = 0
  let i = 0
  const pushText = (end: number) => {
    if (end > last) pieces.push({ kind: 'text', raw: s.slice(last, end) })
  }
  while (i < s.length) {
    const c = s[i]
    const n = s[i + 1]
    if (/[a-z]/.test(c) && /^[ \t]*$/.test(s.slice(s.lastIndexOf('\n', i - 1) + 1, i))) {
      const m = BLOCK_RE.exec(s.slice(i, i + 40))
      if (m) {
        const kind = m[1] as BlockKind
        const open = i + m[0].length - 1
        const close = matchBrace(s, open, kind === 'config' || kind === 'js' ? 'js' : 'sql')
        if (close > 0) {
          pushText(i)
          const header = s.slice(i, open + 1)
          const inner = s.slice(open + 1, close)
          pieces.push({ kind, header, inner, raw: header + inner + '}' })
          i = last = close + 1
          continue
        }
      }
    }
    if (c === '-' && n === '-') {
      const e = s.indexOf('\n', i)
      i = e < 0 ? s.length : e
    } else if (c === '/' && n === '*') {
      const e = s.indexOf('*/', i + 2)
      i = e < 0 ? s.length : e + 2
    } else if (c === "'" || c === '"' || c === '`') {
      i = skipString(s, i)
    } else if (c === '$' && n === '{') {
      const e = matchBrace(s, i + 1, 'js')
      i = e < 0 ? s.length : e + 1
    } else i++
  }
  pushText(s.length)
  return { pieces, eol }
}

export function buildSqlx(file: SqlxFile): string {
  const text = file.pieces.map((p) => p.raw).join('')
  return file.eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text
}

export function findBlock(file: SqlxFile, kind: BlockKind): BlockPiece | undefined {
  return file.pieces.find((p): p is BlockPiece => p.kind === kind)
}

export function setBlockInner(file: SqlxFile, kind: BlockKind, inner: string): SqlxFile {
  const pieces = file.pieces.map((p) => (p.kind === kind ? { ...p, inner, raw: p.header + inner + '}' } : p))
  return { ...file, pieces }
}

/** Add an empty block of `kind`: config first in the file, other blocks before the body. */
export function addBlock(file: SqlxFile, kind: BlockKind, inner = '\n'): SqlxFile {
  if (findBlock(file, kind)) return file
  const header = `${kind} {`
  const block: BlockPiece = { kind, header, inner, raw: header + inner + '}' }
  const pieces = [...file.pieces]
  if (kind === 'post_operations') {
    pieces.push({ kind: 'text', raw: '\n\n' }, block, { kind: 'text', raw: '\n' })
  } else {
    // After the last leading block (config, js, pre_operations), before the SQL.
    let at = 0
    for (let k = 0; k < pieces.length; k++) {
      const p = pieces[k]
      if (p.kind === 'text' ? p.raw.trim() !== '' : p.kind === 'post_operations') break
      if (p.kind !== 'text') at = k + 1
      if (kind === 'config') break
    }
    pieces.splice(at, 0, ...(at === 0 ? [block, { kind: 'text' as const, raw: '\n\n' }] : [{ kind: 'text' as const, raw: '\n\n' }, block]))
  }
  return { ...file, pieces }
}

export function removeBlock(file: SqlxFile, kind: BlockKind): SqlxFile {
  const idx = file.pieces.findIndex((p) => p.kind === kind)
  if (idx < 0) return file
  const pieces = [...file.pieces]
  pieces.splice(idx, 1)
  // Tidy the blank lines the block leaves behind.
  const next = pieces[idx]
  if (next?.kind === 'text' && /^\s*$/.test(next.raw.split('\n').slice(0, 2).join('\n'))) {
    pieces[idx] = { kind: 'text', raw: next.raw.replace(/^[ \t]*\n(\s*\n)?/, '') }
  }
  return { ...file, pieces: pieces.filter((p) => p.kind !== 'text' || p.raw !== '') }
}

// ---------------------------------------------------------------------------
// The SQL body: the text around the blocks

function textEdges(raw: string) {
  const lead = /^(?:[ \t]*\n)*/.exec(raw)![0]
  const rest = raw.slice(lead.length)
  const trail = /(?:\n[ \t]*)*$/.exec(rest)![0]
  return { lead, body: rest.slice(0, rest.length - trail.length), trail }
}

export interface Body {
  sql: string
  /** The SQL sits in more than one place between blocks; editing joins it into the first. */
  split: boolean
}

export function getBody(file: SqlxFile): Body {
  const parts = file.pieces.filter((p) => p.kind === 'text' && p.raw.trim() !== '').map((p) => textEdges(p.raw).body)
  return { sql: parts.join('\n\n'), split: parts.length > 1 }
}

export function setBody(file: SqlxFile, sql: string): SqlxFile {
  const pieces = [...file.pieces]
  const idx = pieces.map((p, k) => (p.kind === 'text' && p.raw.trim() !== '' ? k : -1)).filter((k) => k >= 0)
  if (idx.length === 0) {
    if (!sql) return file
    const lastBlock = pieces.length > 0
    pieces.push({ kind: 'text', raw: (lastBlock ? '\n\n' : '') + sql + '\n' })
    return { ...file, pieces }
  }
  const first = idx[0]
  const { lead, trail } = textEdges(pieces[first].raw)
  pieces[first] = { kind: 'text', raw: lead + sql + (trail || '\n') }
  for (const k of idx.slice(1)) pieces[k] = { kind: 'text', raw: '\n' }
  return { ...file, pieces }
}

// ---------------------------------------------------------------------------
// The config object

export type Quote = '"' | "'" | '`'

export type Value =
  | { t: 'string'; v: string; q?: Quote }
  | { t: 'number'; v: number; src?: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'array'; items: Value[] }
  | { t: 'object'; entries: Entry[] }
  | { t: 'raw'; src: string }

export interface Entry {
  key: string
  value: Value
}

export type ObjectValue = Extract<Value, { t: 'object' }>

export type ConfigParse = { ok: true; value: ObjectValue; hasComments: boolean } | { ok: false; error: string }

class ParseError extends Error {}

const IDENT_RE = /^[A-Za-z_$][\w$]*$/

/** Parse the body of a config block (between its braces). */
export function parseConfig(inner: string): ConfigParse {
  const s = inner
  let i = 0
  let hasComments = false

  const fail = (msg: string): never => {
    throw new ParseError(`${msg} (character ${i + 1} of the config)`)
  }

  function ws() {
    for (;;) {
      while (i < s.length && /\s/.test(s[i])) i++
      if (s.startsWith('//', i)) {
        hasComments = true
        const e = s.indexOf('\n', i)
        i = e < 0 ? s.length : e
      } else if (s.startsWith('/*', i)) {
        hasComments = true
        const e = s.indexOf('*/', i + 2)
        i = e < 0 ? s.length : e + 2
      } else return
    }
  }

  /** Skip one expression's source up to a top-level `,` `}` `]` and return it. */
  function rawUntilDelimiter(start: number): Value {
    let depth = 0
    let j = start
    while (j < s.length) {
      const c = s[j]
      if (c === "'" || c === '"') j = skipString(s, j)
      else if (c === '`') j = skipTemplate(s, j)
      else if (s.startsWith('//', j)) {
        const e = s.indexOf('\n', j)
        j = e < 0 ? s.length : e
      } else if (s.startsWith('/*', j)) {
        const e = s.indexOf('*/', j + 2)
        j = e < 0 ? s.length : e + 2
      } else if ('([{'.includes(c)) {
        depth++
        j++
      } else if (')]}'.includes(c)) {
        if (depth === 0) break
        depth--
        j++
      } else if (c === ',' && depth === 0) break
      else j++
    }
    i = j
    const src = s.slice(start, j).trim()
    if (!src) fail('Expected a value')
    return { t: 'raw', src }
  }

  function readString(): string {
    const q = s[i]
    let out = ''
    i++
    while (i < s.length && s[i] !== q) {
      if (s[i] === '\\') {
        const e = s[i + 1]
        const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' }
        if (e === 'u' && s[i + 2] === '{') {
          const close = s.indexOf('}', i)
          out += String.fromCodePoint(parseInt(s.slice(i + 3, close), 16))
          i = close + 1
        } else if (e === 'u') {
          out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16))
          i += 6
        } else if (e === 'x') {
          out += String.fromCharCode(parseInt(s.slice(i + 2, i + 4), 16))
          i += 4
        } else if (e === '\n') {
          i += 2
        } else {
          out += map[e] ?? e
          i += 2
        }
      } else out += s[i++]
    }
    if (s[i] !== q) fail('Unterminated string')
    i++
    return out
  }

  /** A simple value, or the expression's source when it is more than one. */
  function value(): Value {
    ws()
    const start = i
    const v = simple()
    ws()
    if (v && (i >= s.length || ',}]'.includes(s[i]))) return v
    i = start
    return rawUntilDelimiter(start)
  }

  function simple(): Value | undefined {
    const c = s[i]
    if (c === '{') return object(true)
    if (c === '[') return array()
    if (c === '"' || c === "'") return { t: 'string', v: readString(), q: c }
    if (c === '`') {
      const end = skipTemplate(s, i)
      const body = s.slice(i + 1, end - 1)
      if (body.includes('${')) return undefined
      i++
      let out = ''
      while (i < end - 1) {
        if (s[i] === '\\') {
          out += s[i + 1] === 'n' ? '\n' : s[i + 1] === 't' ? '\t' : s[i + 1]
          i += 2
        } else out += s[i++]
      }
      i = end
      return { t: 'string', v: out, q: '`' }
    }
    const num = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i, i + 40))
    if (num) {
      i += num[0].length
      return { t: 'number', v: Number(num[0]), src: num[0] }
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(s.slice(i, i + 40))?.[0]
    if (word === 'true' || word === 'false') {
      i += word.length
      return { t: 'bool', v: word === 'true' }
    }
    if (word === 'null') {
      i += 4
      return { t: 'null' }
    }
    return undefined
  }

  function array(): Value {
    i++ // [
    const items: Value[] = []
    for (;;) {
      ws()
      if (s[i] === ']') {
        i++
        return { t: 'array', items }
      }
      if (i >= s.length) fail('Unclosed [')
      items.push(value())
      ws()
      if (s[i] === ',') i++
      else if (s[i] !== ']') fail('Expected , or ]')
    }
  }

  function key(): string {
    const c = s[i]
    if (c === '"' || c === "'") return readString()
    const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(s.slice(i, i + 200))
    if (!m) fail(c === '.' ? 'Spread (...) is not supported in the form' : 'Expected a field name')
    i += m![0].length
    return m![0]
  }

  function object(braced: boolean): ObjectValue {
    if (braced) i++ // {
    const entries: Entry[] = []
    for (;;) {
      ws()
      if (braced && s[i] === '}') {
        i++
        return { t: 'object', entries }
      }
      if (i >= s.length) {
        if (braced) fail('Unclosed {')
        return { t: 'object', entries }
      }
      const k = key()
      ws()
      if (s[i] !== ':') fail(`Expected : after ${k}`)
      i++
      entries.push({ key: k, value: value() })
      ws()
      if (s[i] === ',') i++
      else if (braced ? s[i] !== '}' : i < s.length) fail('Expected , between fields')
    }
  }

  try {
    const value = object(false)
    return { ok: true, value, hasComments }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message }
    throw e
  }
}

function quote(v: string, q: Quote = '"'): string {
  if (q === '`' || (v.includes('\n') && q !== "'")) {
    return '`' + v.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`'
  }
  const esc = v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  return q === "'" ? `'${esc.replace(/'/g, "\\'")}'` : `"${esc.replace(/"/g, '\\"')}"`
}

function fmtKey(k: string): string {
  return IDENT_RE.test(k) ? k : quote(k)
}

/** One value as JavaScript source, in Dataform's usual style (2-space indent). */
export function formatValue(v: Value, indent = ''): string {
  const inner = indent + '  '
  switch (v.t) {
    case 'string':
      return quote(v.v, v.q)
    case 'number':
      return v.src && Number(v.src) === v.v ? v.src : String(v.v)
    case 'bool':
      return String(v.v)
    case 'null':
      return 'null'
    case 'raw':
      return v.src
    case 'array': {
      if (v.items.length === 0) return '[]'
      const parts = v.items.map((x) => formatValue(x, inner))
      const oneLine = `[${parts.join(', ')}]`
      if (!parts.some((p) => p.includes('\n')) && oneLine.length + indent.length <= 90) return oneLine
      return `[\n${parts.map((p) => inner + p).join(',\n')}\n${indent}]`
    }
    case 'object': {
      if (v.entries.length === 0) return '{}'
      return `{\n${v.entries.map((e) => `${inner}${fmtKey(e.key)}: ${formatValue(e.value, inner)}`).join(',\n')}\n${indent}}`
    }
  }
}

/** The inner text of a config block for `value` (what goes between the braces). */
export function formatConfigInner(value: ObjectValue): string {
  if (value.entries.length === 0) return '\n'
  return `\n${value.entries.map((e) => `  ${fmtKey(e.key)}: ${formatValue(e.value, '  ')}`).join(',\n')}\n`
}

// ---------------------------------------------------------------------------
// Helpers for the page

export function getEntry(obj: ObjectValue | undefined, key: string): Value | undefined {
  return obj?.entries.find((e) => e.key === key)?.value
}

export function stringOf(v: Value | undefined): string | undefined {
  return v?.t === 'string' ? v.v : undefined
}

export interface Reference {
  /** The function: ref, resolve, self, ... */
  fn: string
  /** The table name (last argument) for ref / resolve. */
  name?: string
  schema?: string
}

/** Calls inside `${ ... }` in the SQL (ref, resolve, self, when, incremental). */
export function references(sql: string): Reference[] {
  const out: Reference[] = []
  const seen = new Set<string>()
  for (const r of interpolations(sql)) {
    const code = sql.slice(r.start + 2, r.end - 1)
    const re = /\b(ref|resolve|self|when|incremental|name|database|schema)\s*\(([^()]*)\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(code))) {
      const args = [...m[2].matchAll(/(['"`])((?:(?!\1).)*)\1/g)].map((a) => a[2])
      const ref: Reference = { fn: m[1] }
      if ((m[1] === 'ref' || m[1] === 'resolve') && args.length) {
        ref.name = args[args.length - 1]
        if (args.length > 1) ref.schema = args[args.length - 2]
      } else if (m[1] === 'ref' || m[1] === 'resolve') {
        const nm = /name\s*:\s*(['"`])([^'"`]+)\1/.exec(m[2])
        const sc = /schema\s*:\s*(['"`])([^'"`]+)\1/.exec(m[2])
        if (nm) ref.name = nm[2]
        if (sc) ref.schema = sc[2]
      }
      const id = `${ref.fn}:${ref.schema ?? ''}:${ref.name ?? ''}`
      if (!seen.has(id)) {
        seen.add(id)
        out.push(ref)
      }
    }
  }
  return out
}
