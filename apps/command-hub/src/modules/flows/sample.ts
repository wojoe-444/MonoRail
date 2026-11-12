import { componentFor, inputsOf, placeholders, valueOf } from './components'
import type { EditorOptions, Flow, FlowDoc, FlowEdge, FlowList, FlowNode, RunSnapshot, Version } from './types'

/**
 * Fictional sample data for the browser dev server (no backend): an
 * in-memory flows store and a pretend runner that walks the graph.
 */

const H = 3_600_000
const now = Date.now()

const n = (id: string, kind: string, x: number, y: number, values: Record<string, string> = {}, title?: string): FlowNode => ({ id, kind, x, y, values, ...(title ? { title } : {}) })
const e = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string): FlowEdge => ({ id, source, sourceHandle, target, targetHandle })

const flows = new Map<string, { flow: Flow; updated: number; history: { oid: string; message: string; time: number; flow: Flow }[] }>()

function put(flow: Flow, updated: number) {
  flows.set(flow.id, { flow, updated, history: [{ oid: 'a'.repeat(40), message: `Flows: new "${flow.name}"`, time: updated - 2 * H, flow: structuredClone(flow) }] })
}

put(
  {
    format: 1,
    id: 'pr-review-crew-1a2b3c',
    name: 'PR review crew',
    description: 'A lead reviewer and a code-reviewer subagent read the branch side by side; you get both views.',
    folder: 'demo-app',
    nodes: [
      n('in', 'chat-input', 0, 120, { text: 'Review the branch feature/garden-beds' }),
      n('prompt', 'prompt', 340, -60, { template: 'You lead a small review crew. Give a short verdict and the three most important fixes.\n\nTask: {task}' }),
      n('lead', 'agent', 700, -330, { model: 'claude-sonnet-5-5' }, 'Lead reviewer'),
      n('reviewer', 'subagent', 700, 200, { subagent: 'sub_code_reviewer' }, 'Code reviewer'),
      n('combine', 'combine', 1080, 120, { sep: '\\n\\n---\\n\\n' }),
      n('out', 'chat-output', 1420, 140),
    ],
    edges: [
      e('e1', 'in', 'message', 'prompt', 'var:task'),
      e('e2', 'prompt', 'text', 'lead', 'input'),
      e('e3', 'in', 'message', 'reviewer', 'input'),
      e('e4', 'lead', 'reply', 'combine', 'a'),
      e('e5', 'reviewer', 'reply', 'combine', 'b'),
      e('e6', 'combine', 'text', 'out', 'input'),
    ],
  },
  now - 2 * H,
)
put(
  {
    format: 1,
    id: 'release-notes-4d5e6f',
    name: 'Release notes writer',
    description: 'Turns a list of merged changes into a plain-language "What\'s new" list.',
    folder: 'demo-app',
    nodes: [
      n('in', 'chat-input', 0, 60),
      n('prompt', 'prompt', 340, 0, { template: 'Rewrite these changes as a short "What\'s new" list for people using the app. No file names.\n\n{changes}' }),
      n('model', 'model', 700, 40, { model: 'claude-haiku-5-5' }),
      n('out', 'chat-output', 1040, 60),
    ],
    edges: [e('e1', 'in', 'message', 'prompt', 'var:changes'), e('e2', 'prompt', 'text', 'model', 'input'), e('e3', 'model', 'text', 'out', 'input')],
  },
  now - 26 * H,
)
put(
  {
    format: 1,
    id: 'two-takes-7a8b9c',
    name: 'Two takes',
    description: 'Two agents answer at once; a model merges their answers into one plan.',
    folder: 'garden-planner',
    nodes: [
      n('in', 'chat-input', 0, 200),
      n('a', 'agent', 360, 0, { instructions: 'Give the cautious, risk-first view.' }, 'Careful planner'),
      n('b', 'agent', 360, 520, { instructions: 'Give the fastest practical path.' }, 'Quick builder'),
      n('prompt', 'prompt', 740, 260, { template: 'Merge these two answers into one plan.\n\nCareful view:\n{careful}\n\nFast view:\n{fast}' }),
      n('model', 'model', 1100, 220, { model: 'claude-sonnet-5-5' }),
      n('out', 'chat-output', 1460, 240),
    ],
    edges: [
      e('e1', 'in', 'message', 'a', 'input'),
      e('e2', 'in', 'message', 'b', 'input'),
      e('e3', 'a', 'reply', 'prompt', 'var:careful'),
      e('e4', 'b', 'reply', 'prompt', 'var:fast'),
      e('e5', 'prompt', 'text', 'model', 'input'),
      e('e6', 'model', 'text', 'out', 'input'),
    ],
  },
  now - 4 * 24 * H,
)

const OPTIONS: EditorOptions = {
  repos: [{ name: 'demo-app' }, { name: 'garden-planner' }],
  subagents: [
    { id: 'sub_code_reviewer', name: 'code-reviewer', tool: 'claude', scope: 'user', description: 'Line-by-line review of a change.' },
    { id: 'sub_researcher', name: 'researcher', tool: 'claude', scope: 'project', repo: 'demo-app', description: 'Finds facts in the repo and the docs.' },
    { id: 'sub_scout', name: 'scout', tool: 'pi', scope: 'user', description: 'Quick look around a codebase.' },
  ],
  models: {
    claude: [
      { id: 'default', label: 'Default' },
      { id: 'claude-opus-5-5', label: 'Opus 5.5' },
      { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
      { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
    ],
    pi: [{ id: 'default', label: 'Default' }],
  },
  sdks: [
    { id: 'claude', ready: true },
    { id: 'pi', ready: false, reason: 'pi is not installed in this sample.' },
  ],
  templates: [
    { id: 'blank', title: 'Blank flow', text: 'An empty canvas with a Chat input and a Chat output.' },
    { id: 'basic-prompt', title: 'Basic prompt', text: 'Chat input, a prompt template and one model call.' },
    { id: 'agent-in-repo', title: 'Agent in a repo', text: 'One agent that reads your repo and answers.' },
    { id: 'draft-review', title: 'Draft and review', text: 'A writer drafts, a reviewer checks the draft, you get both.' },
    { id: 'side-by-side', title: 'Two takes side by side', text: 'Two agents answer at once; a model merges their answers.' },
  ],
}

const runs = new Map<string, RunSnapshot>()

const SAMPLE_REPLIES: Record<string, string> = {
  agent: 'Verdict: close. Fix the empty-state copy, add a test for bed resizing, and drop the unused import in BedGrid.',
  subagent: 'Found 4 issues: a missing null check in plantSpacing(), two unclear names, and a test that never awaits.',
  model: 'A short, merged answer from the model.',
}

function summary(flow: Flow, updated: number) {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    folder: flow.folder,
    kinds: flow.nodes.map((x) => x.kind).slice(0, 12),
    steps: flow.nodes.length,
    agentName: flow.nodes.find((x) => x.kind === 'agent' || x.kind === 'subagent')?.title ?? flow.name,
    updated,
    runs7d: flow.id.startsWith('pr') ? 9 : flow.id.startsWith('release') ? 3 : 0,
  }
}

function order(flow: Flow): string[] {
  const indeg = new Map(flow.nodes.map((x) => [x.id, 0]))
  for (const ed of flow.edges) indeg.set(ed.target, (indeg.get(ed.target) ?? 0) + 1)
  const q = flow.nodes.filter((x) => indeg.get(x.id) === 0).map((x) => x.id)
  const out: string[] = []
  while (q.length) {
    const id = q.shift()!
    out.push(id)
    for (const ed of flow.edges) if (ed.source === id) {
      indeg.set(ed.target, indeg.get(ed.target)! - 1)
      if (indeg.get(ed.target) === 0) q.push(ed.target)
    }
  }
  return out
}

function startSampleRun(flow: Flow, input: string): string {
  const id = `run-${Math.random().toString(36).slice(2)}`
  const ord = order(flow)
  const run: RunSnapshot = {
    id,
    flowId: flow.id,
    status: 'running',
    startedAt: Date.now(),
    costUsd: 0,
    steps: ord.map((nid) => {
      const node = flow.nodes.find((x) => x.id === nid)!
      return { nodeId: nid, kind: node.kind, label: node.title ?? componentFor(node.kind).title, status: 'queued', tools: 0 }
    }),
  }
  runs.set(id, run)
  const outputs = new Map<string, string>()
  let i = 0
  const tick = () => {
    const r = runs.get(id)
    if (!r || r.status !== 'running') return
    if (i > 0) {
      const prev = r.steps[i - 1]
      const node = flow.nodes.find((x) => x.id === prev.nodeId)!
      const ins: Record<string, string> = {}
      for (const ed of flow.edges) if (ed.target === node.id && outputs.has(ed.source)) ins[ed.targetHandle] = outputs.get(ed.source)!
      let out = ''
      if (node.kind === 'chat-input') out = input || valueOf(node, 'text')
      else if (node.kind === 'text-input') out = valueOf(node, 'text')
      else if (node.kind === 'prompt') out = placeholders(valueOf(node, 'template')).reduce((t, v) => t.replaceAll(`{${v}}`, ins[`var:${v}`] ?? ''), valueOf(node, 'template'))
      else if (node.kind === 'combine') out = [ins.a, ins.b].filter(Boolean).join('\n\n---\n\n')
      else if (node.kind === 'chat-output') {
        r.reply = ins.input ?? ''
        out = ''
      } else {
        out = SAMPLE_REPLIES[node.kind] ?? 'Done.'
        prev.costUsd = node.kind === 'model' ? 0.004 : 0.031
        prev.tools = node.kind === 'model' ? 0 : 5
      }
      outputs.set(node.id, out)
      prev.status = 'done'
      prev.endedAt = Date.now()
      prev.output = out.slice(0, 600)
      r.costUsd = r.steps.reduce((s, x) => s + (x.costUsd ?? 0), 0)
    }
    if (i >= r.steps.length) {
      r.status = 'done'
      r.endedAt = Date.now()
      return
    }
    r.steps[i].status = 'running'
    r.steps[i].startedAt = Date.now()
    const slow = ['agent', 'subagent', 'model'].includes(r.steps[i].kind)
    i++
    setTimeout(tick, slow ? 1400 : 300)
  }
  setTimeout(tick, 200)
  return id
}

const clone = <T,>(v: T): T => structuredClone(v)

export async function sampleInvoke<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const id = args.id as string
  const entry = id ? flows.get(id) : undefined
  const r = (v: unknown) => clone(v) as T
  switch (method) {
    case 'list': {
      const list: FlowList = { flows: [...flows.values()].map((f) => summary(f.flow, f.updated)).sort((a, b) => b.updated - a.updated), pending: 0 }
      return r(list)
    }
    case 'get': {
      if (!entry) throw new Error('That flow no longer exists.')
      return r({ flow: entry.flow, updated: entry.updated, committed: true } satisfies FlowDoc)
    }
    case 'create': {
      const base = args.copyOf ? flows.get(args.copyOf as string)?.flow : undefined
      const t = String(args.template ?? 'blank')
      const fid = `flow-${Math.random().toString(16).slice(2, 8)}`
      const flow: Flow = base
        ? { ...clone(base), id: fid, name: `${base.name} (copy)` }
        : {
            format: 1,
            id: fid,
            name: OPTIONS.templates.find((x) => x.id === t)?.title ?? 'New flow',
            description: '',
            folder: String(args.folder ?? ''),
            nodes: [n('in', 'chat-input', 0, 80), n('out', 'chat-output', 520, 80)],
            edges: [e('e1', 'in', 'message', 'out', 'input')],
          }
      put(flow, Date.now())
      return r({ flow, updated: Date.now(), committed: true })
    }
    case 'save': {
      if (!entry) throw new Error('That flow no longer exists.')
      const flow = { ...(args.flow as Flow), id }
      // Drop edges to placeholders that no longer exist, like the backend does.
      flow.edges = flow.edges.filter((ed) => {
        const t = flow.nodes.find((x) => x.id === ed.target)
        return t && inputsOf(t).some((p) => p.id === ed.targetHandle)
      })
      entry.flow = flow
      entry.updated = Date.now()
      return r({ flow, updated: entry.updated, committed: false })
    }
    case 'flush': {
      for (const f of flows.values()) {
        const last = f.history[0]
        if (JSON.stringify(last.flow) !== JSON.stringify(f.flow)) f.history.unshift({ oid: Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40), message: `Flows: "${f.flow.name}"`, time: Date.now(), flow: clone(f.flow) })
      }
      return r({ committed: true })
    }
    case 'remove':
      flows.delete(id)
      return r({ removed: true })
    case 'history':
      return r((entry?.history ?? []).map(({ flow: _f, ...v }) => v) satisfies Version[])
    case 'version': {
      const v = entry?.history.find((h) => h.oid === args.oid)
      if (!v) throw new Error('Unknown version')
      return r({ flow: v.flow })
    }
    case 'options':
      return r(OPTIONS)
    case 'run': {
      if (!entry) throw new Error('That flow no longer exists.')
      return r({ runId: startSampleRun(entry.flow, String(args.input ?? '')) })
    }
    case 'pollRun': {
      const run = runs.get(args.runId as string)
      if (!run) throw new Error('That run is no longer available.')
      return r(run)
    }
    case 'stopRun': {
      const run = runs.get(args.runId as string)
      if (run && run.status === 'running') {
        run.status = 'stopped'
        run.endedAt = Date.now()
        for (const s of run.steps) if (s.status === 'running') s.status = 'stopped'
        else if (s.status === 'queued') s.status = 'skipped'
      }
      return r({ stopped: true })
    }
    case 'runningRun':
      return r({ runId: undefined })
    default:
      throw new Error(`Unknown method ${method}`)
  }
}
