import type { MalloyModel } from './malloy'
import { malloyName as quote, type MalloyCompiled, type OutlineField } from './malloyClient'

/*
 * What the Malloy tab shows for one model: the compiler's outline when it
 * compiled (the authority for sources, fields, types and joins), with the
 * tolerant reader's definition text and end lines laid over it; the tolerant
 * reader alone while compiling or when compiling failed.
 */

export type MalloyViewFieldKind = 'dimension' | 'measure' | 'view'

export interface MalloyViewField {
  name: string
  kind: MalloyViewFieldKind
  type?: string
  description?: string
  /** 1-based, in `file`. */
  line?: number
  file?: string
  /** The definition as written (tolerant reader). */
  definition?: string
  /** A table column: no definition of its own in the model. */
  column?: boolean
}

export interface MalloyViewJoin {
  name: string
  relationship?: string
  source?: string
  tablePath?: string
  on?: string
  line?: number
  file?: string
  fields?: OutlineField[]
}

export interface MalloyViewSource {
  name: string
  description?: string
  table?: string
  extends?: string
  connection?: string
  primaryKey?: string
  file?: string
  line?: number
  endLine?: number
  fields: MalloyViewField[]
  joins: MalloyViewJoin[]
  /** Defined in another file and brought in with import. */
  imported?: boolean
}

export interface MalloyViewModel {
  /** compiled: from the compiler; read: from the tolerant reader. */
  from: 'compiled' | 'read'
  sources: MalloyViewSource[]
  queries: { name: string; line?: number; expr?: string }[]
}

export function malloyViewModel(path: string, parsed: MalloyModel | undefined, compiled: MalloyCompiled | undefined): MalloyViewModel {
  if (compiled?.ok) {
    const sources = compiled.sources.map((s): MalloyViewSource => {
      const p = parsed?.sources.find((x) => x.name === s.name)
      const own = !s.file || s.file === path
      const fields: MalloyViewField[] = []
      const joins: MalloyViewJoin[] = []
      for (const f of s.fields) {
        if (f.kind === 'join') {
          const pj = p?.joins.find((j) => j.name === f.name)
          joins.push({ name: f.name, relationship: f.relationship || pj?.kind, source: f.source ?? pj?.target, tablePath: f.tablePath, on: pj?.on ?? (pj?.with ? `with ${pj.with}` : undefined), line: f.line ?? pj?.line, file: f.file ?? (pj ? path : undefined), fields: f.fields })
          continue
        }
        const pf = p?.fields.find((x) => x.name === f.name)
        fields.push({
          name: f.name,
          kind: f.kind,
          type: f.type,
          description: f.description ?? pf?.description,
          line: f.line ?? (own ? pf?.line : undefined),
          file: f.file ?? (pf ? path : undefined),
          definition: own || f.file === path ? pf?.definition : undefined,
          column: !pf && f.line === undefined,
        })
      }
      return {
        name: s.name,
        description: s.description ?? p?.description,
        table: s.tablePath ?? p?.table,
        extends: p?.extends,
        connection: s.connection ?? p?.connection,
        primaryKey: s.primaryKey ?? p?.primaryKey,
        file: s.file ?? (p ? path : undefined),
        line: s.line ?? p?.line,
        endLine: own ? p?.endLine : undefined,
        fields,
        joins,
        imported: !own,
      }
    })
    return { from: 'compiled', sources, queries: compiled.queries.map((q) => ({ ...q, ...pickQuery(parsed, q.name) })) }
  }
  return {
    from: 'read',
    sources: (parsed?.sources ?? []).map((s) => ({
      name: s.name,
      description: s.description,
      table: s.table,
      extends: s.extends,
      connection: s.connection,
      primaryKey: s.primaryKey,
      file: path,
      line: s.line,
      endLine: s.endLine,
      fields: s.fields.map((f) => ({ name: f.name, kind: f.kind, description: f.description, line: f.line, file: path, definition: f.definition })),
      joins: s.joins.map((j) => ({ name: j.name, relationship: j.kind, source: j.target, on: j.on ?? (j.with ? `with ${j.with}` : undefined), line: j.line, file: path })),
    })),
    queries: (parsed?.queries ?? []).map((q) => ({ name: q.name, line: q.line, expr: q.expr })),
  }
}

function pickQuery(parsed: MalloyModel | undefined, name: string) {
  const q = parsed?.queries.find((x) => x.name === name)
  return q ? { line: q.line, expr: q.expr } : {}
}

/** A sensible first query for a model: its first named query, a view, or a small group-by. */
export function malloyStarterQuery(model: MalloyViewModel, prefer?: string): string {
  const own = model.sources.filter((s) => !s.imported)
  const src = (prefer && model.sources.find((s) => s.name === prefer)) || own[0] || model.sources[0]
  if (!prefer && model.queries[0]) return `run: ${quote(model.queries[0].name)}`
  if (!src) return model.queries[0] ? `run: ${quote(model.queries[0].name)}` : ''
  const view = src.fields.find((f) => f.kind === 'view')
  if (view) return `run: ${quote(src.name)} -> ${quote(view.name)}`
  const dim = src.fields.find((f) => f.kind === 'dimension' && !f.column) ?? src.fields.find((f) => f.kind === 'dimension' && f.type === 'string')
  const measure = src.fields.find((f) => f.kind === 'measure')
  if (dim && measure) return `run: ${quote(src.name)} -> {\n  group_by: ${quote(dim.name)}\n  aggregate: ${quote(measure.name)}\n  limit: 20\n}`
  if (measure) return `run: ${quote(src.name)} -> {\n  aggregate: ${quote(measure.name)}\n}`
  return `run: ${quote(src.name)} -> {\n  select: *\n  limit: 20\n}`
}

