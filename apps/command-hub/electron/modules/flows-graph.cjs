// Flows: the shape of a flow and the rules of its graph (no Electron, no I/O).
//
// A flow is one JSON document:
//   { format: 1, id, name, description, folder, nodes: [...], edges: [...] }
//   node: { id, kind, x, y, title?, values: { <field id>: string } }
//   edge: { id, source, sourceHandle, target, targetHandle }
// `folder` is the name of one of Chat's allowed repos: where agent steps run
// unless a step names its own. Component kinds, their fields and ports are in
// flows-components.json, shared with the page.

const COMPONENTS_FILE = require('./flows-components.json')

const COMPONENTS = new Map(COMPONENTS_FILE.components.map((c) => [c.kind, c]))
const FORMAT = 1
const LIMITS = Object.freeze({ nodes: 200, edges: 600, name: 120, description: 600, value: 100_000, title: 80, id: 64 })
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const VAR_RE = /\{([A-Za-z_][A-Za-z0-9_]{0,40})\}/g

/** The {placeholders} of a prompt template, in order, once each. */
function placeholders(template) {
  const out = []
  for (const m of String(template ?? '').matchAll(VAR_RE)) if (!out.includes(m[1])) out.push(m[1])
  return out.slice(0, 20)
}

/** Every input port of a node: fields with a port, plus a prompt's placeholders (`var:<name>`). */
function inputsOf(node) {
  const def = COMPONENTS.get(node.kind)
  if (!def) return []
  const ports = def.fields.filter((f) => f.port).map((f) => ({ id: f.id, label: f.label, type: f.port, required: !!f.required }))
  if (node.kind === 'prompt') {
    const template = node.values?.template ?? def.fields.find((f) => f.id === 'template')?.value ?? ''
    for (const v of placeholders(template)) ports.push({ id: `var:${v}`, label: v, type: 'any', required: false })
  }
  return ports
}

function outputsOf(node) {
  return COMPONENTS.get(node.kind)?.outputs ?? []
}

/** Port types that may be joined by an edge. */
function canConnect(from, to) {
  if (from === 'any' || to === 'any') return true
  const text = ['message', 'text']
  return from === to || (text.includes(from) && text.includes(to))
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * A clean copy of a flow from the page (or a file), or an error. Unknown
 * kinds, dangling or mistyped edges and oversized values are refused, so a
 * saved flow is always one the runner understands.
 */
function cleanFlow(raw, { id } = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a flow')
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : []
  const edges = Array.isArray(raw.edges) ? raw.edges : []
  if (nodes.length > LIMITS.nodes) throw new Error(`A flow can have at most ${LIMITS.nodes} steps.`)
  if (edges.length > LIMITS.edges) throw new Error(`A flow can have at most ${LIMITS.edges} connections.`)
  const seen = new Map()
  const outNodes = []
  for (const n of nodes) {
    if (!n || !ID_RE.test(n.id ?? '') || seen.has(n.id)) throw new Error('A step has a missing or repeated id.')
    const def = COMPONENTS.get(n.kind)
    if (!def) throw new Error(`Unknown step type "${String(n.kind).slice(0, 40)}".`)
    const values = {}
    const known = new Set(def.fields.map((f) => f.id))
    for (const [k, v] of Object.entries(n.values ?? {})) {
      if (!known.has(k) || (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')) continue
      const s = String(v)
      if (s.length > LIMITS.value) throw new Error(`"${def.title}" has a value that is too long (100,000 characters at most).`)
      values[k] = s
    }
    const node = {
      id: n.id,
      kind: n.kind,
      x: Number.isFinite(n.x) ? Math.round(n.x) : 0,
      y: Number.isFinite(n.y) ? Math.round(n.y) : 0,
      values,
    }
    const title = str(n.title, LIMITS.title).trim()
    if (title) node.title = title
    seen.set(n.id, node)
    outNodes.push(node)
  }
  const outEdges = []
  const edgeIds = new Set()
  for (const e of edges) {
    if (!e || !ID_RE.test(e.id ?? '') || edgeIds.has(e.id)) throw new Error('A connection has a missing or repeated id.')
    const s = seen.get(e.source)
    const t = seen.get(e.target)
    if (!s || !t || s === t) continue // dangling edges are dropped, not fatal
    const out = outputsOf(s).find((o) => o.id === e.sourceHandle)
    const inp = inputsOf(t).find((i) => i.id === e.targetHandle)
    if (!out || !inp || !canConnect(out.type, inp.type)) continue
    edgeIds.add(e.id)
    outEdges.push({ id: e.id, source: s.id, sourceHandle: out.id, target: t.id, targetHandle: inp.id })
  }
  if (hasCycle(outNodes, outEdges)) throw new Error('This flow has a loop. Loops come in a later version; remove a connection to save.')
  return {
    format: FORMAT,
    id: id ?? str(raw.id, LIMITS.id),
    name: str(raw.name, LIMITS.name).trim() || 'Untitled flow',
    description: str(raw.description, LIMITS.description).trim(),
    folder: str(raw.folder, 400),
    nodes: outNodes,
    edges: outEdges,
  }
}

function hasCycle(nodes, edges) {
  return order(nodes, edges).length !== nodes.length
}

/** Nodes in run order (Kahn's algorithm); a node in a cycle is left out. */
function order(nodes, edges) {
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id)
  const out = []
  while (queue.length) {
    const id = queue.shift()
    out.push(id)
    for (const e of edges) {
      if (e.source !== id) continue
      indeg.set(e.target, indeg.get(e.target) - 1)
      if (indeg.get(e.target) === 0) queue.push(e.target)
    }
  }
  return out
}

/** Problems that stop a run before it starts, as plain sentences. */
function problems(flow) {
  const out = []
  if (flow.nodes.length === 0) out.push('Add some steps first.')
  if (!flow.nodes.some((n) => n.kind === 'chat-output')) out.push('Add a Chat output step for the answer.')
  for (const n of flow.nodes) {
    const def = COMPONENTS.get(n.kind)
    const name = n.title || def.title
    for (const f of def.fields) {
      if (!f.required) continue
      const connected = flow.edges.some((e) => e.target === n.id && e.targetHandle === f.id)
      const own = String(n.values[f.id] ?? '').trim()
      if (!connected && !own) out.push(`${name}: "${f.label}" needs a value or a connection.`)
    }
  }
  return out
}

/** A field's own value, or its default. */
function valueOf(node, fieldId) {
  if (node.values[fieldId] !== undefined) return node.values[fieldId]
  const f = COMPONENTS.get(node.kind)?.fields.find((x) => x.id === fieldId)
  return f?.value === undefined ? '' : String(f.value)
}

/** Fill a template's {placeholders}; unknown ones are left as written. */
function fill(template, vars) {
  return String(template).replace(VAR_RE, (m, name) => (Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m))
}

/** "\n" and "\t" typed as text in a separator mean a newline and a tab. */
function unescape(sep) {
  return String(sep).replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

module.exports = { COMPONENTS, COMPONENTS_FILE, FORMAT, LIMITS, ID_RE, placeholders, inputsOf, outputsOf, canConnect, cleanFlow, order, problems, valueOf, fill, unescape }
