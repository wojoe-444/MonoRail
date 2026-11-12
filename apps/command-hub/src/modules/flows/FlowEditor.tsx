import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './flows.css'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, History, Loader2, Maximize, Minus, PanelRight, Plus, RotateCcw, Search, Send, Square, SquareTerminal, X } from 'lucide-react'

import { AgentMochi, MochiAvatar } from '@/components/mochi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'

import { call, errorText } from './api'
import { CATEGORIES, CATEGORY_ICON, COMPONENTS, KIND_ICON, PORT_COLOR, canConnect, componentFor, inputsOf } from './components'
import { EditorContext, type EditorContextValue } from './context'
import { FlowNode, type FlowNodeData } from './FlowNode'
import type { EditorOptions, Flow, FlowDoc, PortType, RunSnapshot, RunStep, Version } from './types'

const nodeTypes = { component: FlowNode }
const DRAG_TYPE = 'application/x-monorail-flow-step'
const SAVE_AFTER_MS = 700

type RFNode = Node<FlowNodeData>

const toRF = (flow: Flow): { nodes: RFNode[]; edges: Edge[] } => ({
  nodes: flow.nodes.map((n) => ({ id: n.id, type: 'component', position: { x: n.x, y: n.y }, data: { kind: n.kind, title: n.title, values: n.values } })),
  edges: flow.edges.map((e) => ({ ...e })),
})

const fromRF = (base: Flow, nodes: RFNode[], edges: Edge[]): Flow => ({
  ...base,
  nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, x: Math.round(n.position.x), y: Math.round(n.position.y), ...(n.data.title ? { title: n.data.title } : {}), values: n.data.values })),
  edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? '', target: e.target, targetHandle: e.targetHandle ?? '' })),
})

function outType(nodes: RFNode[], nodeId: string, handle?: string | null): PortType {
  const n = nodes.find((x) => x.id === nodeId)
  return (n && componentFor(n.data.kind).outputs.find((o) => o.id === handle)?.type) ?? 'any'
}

function newId(prefix: string, taken: Set<string>) {
  for (let i = 1; ; i++) if (!taken.has(`${prefix}${i}`)) return `${prefix}${i}`
}

function Palette() {
  const [open, setOpen] = useState<Set<string>>(new Set(CATEGORIES.map((c) => c.id)))
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search steps" className="h-9 pl-8" />
        </div>
      </div>
      <div className="px-4 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Drag onto the canvas</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {CATEGORIES.map((cat) => {
          const items = COMPONENTS.filter((c) => c.category === cat.id && (!query || `${c.title} ${c.description}`.toLowerCase().includes(query)))
          if (items.length === 0) return null
          const isOpen = query ? true : open.has(cat.id)
          const Icon = CATEGORY_ICON[cat.id]
          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() =>
                  setOpen((s) => {
                    const next = new Set(s)
                    if (next.has(cat.id)) next.delete(cat.id)
                    else next.add(cat.id)
                    return next
                  })
                }
                className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm hover:bg-accent"
              >
                {Icon && <Icon className="size-4 text-muted-foreground" />}
                <span className="flex-1 text-left">{cat.label}</span>
                {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="mb-1 ml-4 border-l pl-2">
                  {items.map((c) => {
                    const CIcon = KIND_ICON[c.kind]
                    return (
                      <div
                        key={c.kind}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DRAG_TYPE, c.kind)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        title={c.description}
                        className="flex h-9 cursor-grab items-center gap-2.5 rounded-md px-2 text-sm hover:bg-sidebar-accent active:cursor-grabbing"
                      >
                        {c.mochi ? <MochiAvatar role={c.mochi} size={20} /> : CIcon && <CIcon className="size-4 text-primary" />}
                        <span className="truncate">{c.title}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="border-t p-3 text-[11px] leading-relaxed text-muted-foreground">
        Connect a dot on the right of a step to a dot on the left of another. Select a step or a line and press Delete to remove it.
      </div>
    </aside>
  )
}

function ZoomControls() {
  const rf = useReactFlow()
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setZoom(rf.getZoom()), 300)
    return () => clearInterval(t)
  }, [rf])
  return (
    <div className="absolute right-4 bottom-4 z-10 flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-elevation-2">
      <Button size="icon" variant="ghost" className="size-7" onClick={() => rf.zoomOut()} title="Zoom out"><Minus /></Button>
      <span className="w-12 text-center font-mono text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
      <Button size="icon" variant="ghost" className="size-7" onClick={() => rf.zoomIn()} title="Zoom in"><Plus /></Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button size="icon" variant="ghost" className="size-7" onClick={() => rf.fitView({ padding: 0.15 })} title="Fit to screen"><Maximize /></Button>
    </div>
  )
}

const dur = (s: RunStep) => (s.startedAt && s.endedAt ? s.endedAt - s.startedAt : undefined)
const fmtMs = (v?: number) => (v === undefined ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`)

type ChatMsg = { from: 'you'; text: string } | { from: 'flow'; run: RunSnapshot }

function Playground({ name, msgs, run, busy, onSend, onStop, onClose }: { name: string; msgs: ChatMsg[]; run?: RunSnapshot; busy: boolean; onSend: (text: string) => void; onStop: () => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const running = run?.status === 'running'
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [msgs, run])
  const send = () => {
    if (!text.trim() || running || busy) return
    onSend(text)
    setText('')
  }
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l bg-card">
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <PanelRight className="size-4 text-muted-foreground" />
        <div className="flex-1 text-sm font-semibold">Playground</div>
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label="Close the Playground"><X /></Button>
      </div>
      <div ref={list} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="grid place-items-center gap-3 py-12 text-center">
            <AgentMochi name={name} size={56} />
            <div className="text-sm font-medium">Try the flow</div>
            <p className="max-w-64 text-xs text-muted-foreground">Your message goes to Chat input. Each step lights up on the canvas while it runs; agent steps are Chat turns in your repo.</p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.from === 'you' ? (
            <div key={i} className="ml-10 rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{m.text}</div>
          ) : (
            <RunCard key={i} name={name} run={m.run} />
          ),
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder="Message the flow"
            className="min-h-0 flex-1 resize-none bg-transparent text-sm outline-none"
          />
          {running ? (
            <Button size="icon" variant="outline" className="size-8" onClick={onStop} aria-label="Stop"><Square /></Button>
          ) : (
            <Button size="icon" className="size-8" disabled={busy || !text.trim()} onClick={send} aria-label="Send">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">Agent steps count toward your spending limit like any Chat turn.</div>
      </div>
    </aside>
  )
}

function RunCard({ name, run }: { name: string; run: RunSnapshot }) {
  const running = run.status === 'running'
  const doneSteps = run.steps.filter((s) => s.status === 'done').length
  return (
    <div className="space-y-2">
      {run.reply !== undefined && (
        <div className="flex gap-2">
          <AgentMochi name={name} size={28} />
          <div className="min-w-0 rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
            <ChatMarkdown text={run.reply || '(empty reply)'} />
            {run.details && <div className="mt-2 border-t pt-2 text-xs text-muted-foreground"><ChatMarkdown text={run.details} /></div>}
          </div>
        </div>
      )}
      {run.error && (
        <div className="flex gap-2 rounded-lg bg-destructive-soft p-3 text-xs text-destructive-soft-foreground">
          <AlertTriangle className="size-4 shrink-0" /> {run.error}
        </div>
      )}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium">
          <span>
            {running ? 'Running' : run.status === 'done' ? 'Finished' : run.status === 'stopped' ? 'Stopped' : 'Failed'} · {doneSteps} of {run.steps.length} steps{run.costUsd > 0 ? ` · $${run.costUsd.toFixed(3)}` : ''}
          </span>
          <Badge variant={running ? 'info' : run.status === 'done' ? 'success' : 'warning'}>{running ? 'Live' : run.status === 'done' ? 'Done' : run.status.replace('_', ' ')}</Badge>
        </div>
        <ol className="divide-y">
          {run.steps
            .filter((s) => s.status !== 'queued' || running)
            .map((s) => (
              <li key={s.nodeId} className="flex gap-2 px-3 py-2 text-xs">
                <span className={cn('mt-1 size-2 shrink-0 rounded-full', s.status === 'running' ? 'animate-pulse bg-primary' : s.status === 'done' ? 'bg-success' : s.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground/40')} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.label}</div>
                  <div className="truncate text-muted-foreground" title={s.error ?? s.output}>
                    {s.error ?? (s.status === 'running' ? (s.tools ? `Working · ${s.tools} tool calls` : 'Working…') : s.output || s.status)}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {fmtMs(dur(s))}
                  {s.costUsd !== undefined && <div>${s.costUsd.toFixed(3)}</div>}
                </div>
              </li>
            ))}
        </ol>
      </div>
    </div>
  )
}

function LogsDrawer({ run, onClose }: { run?: RunSnapshot; onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 h-60 border-t bg-card shadow-elevation-3">
      <div className="flex h-10 items-center gap-2 border-b px-4 text-sm font-semibold">
        <SquareTerminal className="size-4 text-muted-foreground" /> Logs
        <span className="font-normal text-muted-foreground">· {run ? `run started ${new Date(run.startedAt).toLocaleTimeString()}` : 'no run yet'}</span>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label="Close logs"><X /></Button>
      </div>
      <div className="h-[calc(100%-2.5rem)] overflow-y-auto">
        <table className="w-full table-fixed text-xs">
          <thead className="sticky top-0 bg-card text-left text-muted-foreground">
            <tr>
              <th className="w-48 px-4 py-1.5 font-medium">Step</th>
              <th className="w-24 px-2 font-medium">Status</th>
              <th className="px-2 font-medium">Output (first 600 characters)</th>
              <th className="w-20 px-2 text-right font-medium">Time</th>
              <th className="w-20 px-4 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {run?.steps.map((s) => (
              <tr key={s.nodeId}>
                <td className="truncate px-4 py-1.5 font-medium">{s.label}</td>
                <td className="px-2">{s.status}</td>
                <td className={cn('truncate px-2 font-mono', s.error ? 'text-destructive' : 'text-muted-foreground')} title={s.error ?? s.output}>{s.error ?? s.output ?? ''}</td>
                <td className="px-2 text-right font-mono">{fmtMs(dur(s))}</td>
                <td className="px-4 text-right font-mono">{s.costUsd !== undefined ? `$${s.costUsd.toFixed(3)}` : ''}</td>
              </tr>
            ))}
            {!run && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Run the flow from the Playground to see each step here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VersionsDialog({ flowId, open, onOpenChange, onRestore }: { flowId: string; open: boolean; onOpenChange: (v: boolean) => void; onRestore: (flow: Flow) => void }) {
  const [versions, setVersions] = useState<Version[]>()
  const [picked, setPicked] = useState<{ oid: string; flow?: Flow; error?: string }>()
  useEffect(() => {
    if (!open) return
    let live = true
    setVersions(undefined)
    setPicked(undefined)
    call('flush', {})
      .then(() => call<Version[]>('history', { id: flowId }))
      .then((v) => live && setVersions(v), () => live && setVersions([]))
    return () => {
      live = false
    }
  }, [open, flowId])
  const pick = (oid: string) => {
    setPicked({ oid })
    call<{ flow: Flow }>('version', { id: flowId, oid }).then(
      (r) => setPicked({ oid, flow: r.flow }),
      (e) => setPicked({ oid, error: errorText(e) }),
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Versions</DialogTitle>
          <DialogDescription>Every save is kept in the flow's local history. Bringing one back keeps the newer versions too.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {!versions && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {versions?.map((v, i) => (
            <button key={v.oid} type="button" onClick={() => pick(v.oid)} className={cn('flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent', picked?.oid === v.oid && 'bg-primary-soft')}>
              <History className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{v.message.replace(/^Flows: /, '')}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{i === 0 ? 'Current · ' : ''}{new Date(v.time).toLocaleString()}</span>
            </button>
          ))}
        </div>
        {picked?.flow && (
          <div className="text-xs text-muted-foreground">
            “{picked.flow.name}” · {picked.flow.nodes.length} steps · {picked.flow.edges.length} connections
          </div>
        )}
        {picked?.error && <div className="text-xs text-destructive">{picked.error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!picked?.flow || picked.oid === versions?.[0]?.oid} onClick={() => picked?.flow && onRestore(picked.flow)}>
            <RotateCcw /> Bring this version back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type SaveState = { kind: 'saved' } | { kind: 'saving' } | { kind: 'error'; message: string }

function Editor({ doc, options, onBack }: { doc: FlowDoc; options?: EditorOptions; onBack: () => void }) {
  const initial = useMemo(() => toRF(doc.flow), [doc])
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const [meta, setMeta] = useState({ name: doc.flow.name, folder: doc.flow.folder })
  const [save, setSave] = useState<SaveState>({ kind: 'saved' })
  const [showPlay, setShowPlay] = useState(true)
  const [showLogs, setShowLogs] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [run, setRun] = useState<RunSnapshot>()
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [starting, setStarting] = useState(false)
  const rf = useReactFlow()
  const dirty = useRef(false)
  const saving = useRef<Promise<unknown>>(Promise.resolve())
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const first = useRef(true)

  const current = useCallback(() => fromRF({ ...doc.flow, ...meta }, nodes, edges), [doc.flow, meta, nodes, edges])
  const latest = useRef(current)
  useLayoutEffect(() => {
    latest.current = current
  }, [current])

  const saveNow = useCallback(() => {
    clearTimeout(timer.current)
    if (!dirty.current) return saving.current
    dirty.current = false
    setSave({ kind: 'saving' })
    const flow = latest.current()
    saving.current = saving.current
      .catch(() => {})
      .then(() => call<FlowDoc>('save', { id: flow.id, flow }))
      .then(
        () => setSave({ kind: 'saved' }),
        (e) => {
          dirty.current = true
          setSave({ kind: 'error', message: errorText(e) })
          throw e
        },
      )
    return saving.current
  }, [])

  // Any change to the graph, a step's place, the name or the repo saves after
  // a short pause (a run's live status is not part of the flow).
  const signature = useMemo(() => JSON.stringify(current()), [current])
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void saveNow().catch(() => {}), SAVE_AFTER_MS)
  }, [signature, saveNow])

  // Leaving the editor saves what is left and commits it as a version.
  useEffect(
    () => () => {
      void saveNow()
        .catch(() => {})
        .then(() => call('flush', {}))
        .catch(() => {})
    },
    [saveNow],
  )

  /** The live run, also kept in its chat bubble so it stays after the next run starts. */
  const applyRun = useCallback((snap: RunSnapshot) => {
    setRun(snap)
    setMsgs((m) => m.map((x) => (x.from === 'flow' && x.run.id === snap.id ? { from: 'flow', run: snap } : x)))
  }, [])

  // Follow a run: poll until it ends.
  useEffect(() => {
    if (!run || run.status !== 'running') return
    const t = setTimeout(() => {
      call<RunSnapshot>('pollRun', { runId: run.id }).then(applyRun, (e) => applyRun({ ...run, status: 'failed', error: errorText(e) }))
    }, 600)
    return () => clearTimeout(t)
  }, [run, applyRun])

  // A run that was going when the page was left is picked up again.
  useEffect(() => {
    call<{ runId?: string }>('runningRun', { id: doc.flow.id })
      .then(async (r) => {
        if (!r.runId) return
        const snap = await call<RunSnapshot>('pollRun', { runId: r.runId })
        setRun(snap)
        setMsgs([{ from: 'flow', run: snap }])
      })
      .catch(() => {})
  }, [doc.flow.id])

  const send = useCallback(
    async (text: string) => {
      setStarting(true)
      setMsgs((m) => [...m, { from: 'you', text }])
      try {
        await saveNow()
        const { runId } = await call<{ runId: string }>('run', { id: doc.flow.id, input: text })
        const snap = await call<RunSnapshot>('pollRun', { runId })
        setRun(snap)
        setMsgs((m) => [...m, { from: 'flow', run: snap }])
      } catch (e) {
        const failed: RunSnapshot = { id: `failed-${Date.now()}`, flowId: doc.flow.id, status: 'failed', startedAt: Date.now(), error: errorText(e), costUsd: 0, steps: [] }
        setMsgs((m) => [...m, { from: 'flow', run: failed }])
      } finally {
        setStarting(false)
      }
    },
    [doc.flow.id, saveNow],
  )


  const stepOf = useCallback((nodeId: string) => run?.steps.find((s) => s.nodeId === nodeId), [run])
  const ctx = useMemo<EditorContextValue>(
    () => ({
      options,
      stepOf,
      setValue: (nodeId, field, value) => setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, values: { ...n.data.values, [field]: value } } } : n))),
      setTitle: (nodeId, title) => setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, title: title.trim() || undefined } } : n))),
    }),
    [options, stepOf, setNodes],
  )

  // A placeholder removed from a prompt drops the edges that fed it.
  useEffect(() => {
    setEdges((es) => {
      const keep = es.filter((e) => {
        const t = nodes.find((n) => n.id === e.target)
        return t && inputsOf(t.data).some((p) => p.id === e.targetHandle)
      })
      return keep.length === es.length ? es : keep
    })
  }, [nodes, setEdges])

  const isValidConnection = useCallback<IsValidConnection>(
    (c) => {
      if (c.source === c.target) return false
      const target = nodes.find((n) => n.id === c.target)
      const inp = target && inputsOf(target.data).find((p) => p.id === c.targetHandle)
      if (!inp) return false
      return canConnect(outType(nodes, c.source, c.sourceHandle), inp.type)
    },
    [nodes],
  )

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((es) => {
        const ids = new Set(es.map((e) => e.id))
        return addEdge({ ...c, id: newId('e', ids) }, es)
      }),
    [setEdges],
  )

  const onDrop = useCallback(
    (e: DragEvent) => {
      const kind = e.dataTransfer.getData(DRAG_TYPE)
      if (!kind) return
      e.preventDefault()
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setNodes((ns) => {
        const id = newId(kind.replace(/[^a-z]/g, '').slice(0, 8) || 'step', new Set(ns.map((n) => n.id)))
        return [...ns, { id, type: 'component', position: { x: pos.x - 140, y: pos.y - 40 }, data: { kind, values: {} }, selected: true }]
      })
    },
    [rf, setNodes],
  )

  const live = run?.status === 'running' ? new Set(run.steps.filter((s) => s.status === 'running').map((s) => s.nodeId)) : new Set<string>()
  const styledEdges = edges.map((ed) => ({ ...ed, animated: live.has(ed.target), style: { stroke: PORT_COLOR[outType(nodes, ed.source, ed.sourceHandle)], strokeWidth: 2 } }))

  const restore = (flow: Flow) => {
    const rfFlow = toRF(flow)
    setNodes(rfFlow.nodes)
    setEdges(rfFlow.edges)
    setMeta({ name: flow.name, folder: flow.folder })
    setShowVersions(false)
  }

  const repos = options?.repos ?? []
  const agentName = nodes.find((n) => n.data.kind === 'agent' || n.data.kind === 'subagent')?.data.title ?? meta.name
  const needsRepo = !meta.folder && nodes.some((n) => ['agent', 'subagent', 'model'].includes(n.data.kind) && !n.data.values.folder)

  return (
    <EditorContext.Provider value={ctx}>
      <div className="flex h-full min-h-[36rem] flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
          <Button size="icon" variant="ghost" onClick={onBack} aria-label="Back to flows"><ArrowLeft /></Button>
          <AgentMochi name={agentName} size={32} />
          <div className="min-w-0">
            <input
              value={meta.name}
              onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value.slice(0, 120) }))}
              aria-label="Flow name"
              className="w-72 max-w-full truncate rounded-md bg-transparent px-1 text-sm font-semibold outline-none hover:bg-accent focus:bg-accent"
            />
            <div className="px-1 text-xs text-muted-foreground">
              {save.kind === 'saving' ? 'Saving…' : save.kind === 'error' ? <span className="text-destructive" title={save.message}>Not saved: {save.message}</span> : 'Saved'} · {nodes.length} steps
            </div>
          </div>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Repo
            <select
              value={meta.folder}
              onChange={(e) => setMeta((m) => ({ ...m, folder: e.target.value }))}
              className={cn('h-8 rounded-md border bg-background px-2 text-sm text-foreground', needsRepo && 'border-warning ring-2 ring-warning/30')}
              title="Agent steps run inside this repo unless a step picks its own. Only Chat's allowed repos are listed."
            >
              <option value="">{repos.length ? 'Pick a repo…' : 'No allowed repos yet'}</option>
              {meta.folder && !repos.some((r) => r.name === meta.folder) && <option value={meta.folder}>{meta.folder} (not allowed now)</option>}
              {repos.map((r) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </label>
          <Button variant="ghost" size="sm" onClick={() => setShowVersions(true)}><History /> Versions</Button>
          <Button variant={showPlay ? 'soft' : 'outline'} size="sm" onClick={() => setShowPlay((v) => !v)}><PanelRight /> Playground</Button>
        </div>
        <div className="flex min-h-0 flex-1">
          <Palette />
          <div className="relative min-w-0 flex-1 bg-background" onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DRAG_TYPE)) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }
          }} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes}
              edges={styledEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              nodeTypes={nodeTypes}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
              minZoom={0.25}
              proOptions={{ hideAttribution: true }}
              className="flows-canvas"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="var(--border)" />
              <ZoomControls />
            </ReactFlow>
            <Button variant="outline" size="sm" className="absolute bottom-4 left-4 z-10 bg-card shadow-elevation-2" onClick={() => setShowLogs((v) => !v)}>
              <SquareTerminal /> Logs
            </Button>
            {showLogs && <LogsDrawer run={run} onClose={() => setShowLogs(false)} />}
          </div>
          {showPlay && (
            <Playground
              name={agentName}
              msgs={msgs}
              run={run}
              busy={starting}
              onSend={(t) => void send(t)}
              onStop={() => run && void call('stopRun', { runId: run.id }).then(() => call<RunSnapshot>('pollRun', { runId: run.id })).then(applyRun).catch(() => {})}
              onClose={() => setShowPlay(false)}
            />
          )}
        </div>
        <VersionsDialog flowId={doc.flow.id} open={showVersions} onOpenChange={setShowVersions} onRestore={restore} />
      </div>
    </EditorContext.Provider>
  )
}

export function FlowEditor({ flowId, onBack }: { flowId: string; onBack: () => void }) {
  const [doc, setDoc] = useState<FlowDoc>()
  const [options, setOptions] = useState<EditorOptions>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    call<FlowDoc>('get', { id: flowId }).then((d) => live && setDoc(d), (e) => live && setError(errorText(e)))
    call<EditorOptions>('options').then((o) => live && setOptions(o), () => {})
    return () => {
      live = false
    }
  }, [flowId])
  if (error)
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="space-y-3">
          <AlertTriangle className="mx-auto size-8 text-warning" />
          <div className="text-sm">{error}</div>
          <Button variant="outline" onClick={onBack}><ArrowLeft /> Back to flows</Button>
        </div>
      </div>
    )
  if (!doc) return <div className="grid h-full place-items-center text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
  return (
    <ReactFlowProvider>
      <Editor doc={doc} options={options} onBack={onBack} />
    </ReactFlowProvider>
  )
}
