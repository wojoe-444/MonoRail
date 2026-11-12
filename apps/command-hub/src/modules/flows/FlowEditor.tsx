import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './flows.css'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  History,
  Maximize,
  Minus,
  PanelRight,
  Plus,
  Rocket,
  Search,
  Send,
  SquareTerminal,
  X,
} from 'lucide-react'

import { AgentMochi, MochiAvatar } from '@/components/mochi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { CATEGORIES, COMPONENTS, PORT_COLOR, componentFor } from './components'
import { DeployDialog } from './DeployDialog'
import { FlowNode } from './FlowNode'
import { PythonComponentDialog } from './PythonComponentDialog'
import { SAMPLE_EDGES, SAMPLE_NODES, SAMPLE_RUN } from './sample'
import type { CategoryId, FlowNodeData, FlowSummary, PortType } from './types'

const nodeTypes = { component: FlowNode }

function portTypeOf(nodes: Node<FlowNodeData>[], nodeId: string, handle: string | null | undefined): PortType {
  const node = nodes.find((x) => x.id === nodeId)
  if (!node) return 'any'
  return componentFor(node.data.kind).outputs.find((o) => o.id === handle)?.type ?? 'any'
}

function Palette({ onNewPython }: { onNewPython: () => void }) {
  const [open, setOpen] = useState<Set<CategoryId>>(new Set(['agents']))
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search components" className="h-9 pl-8" />
        </div>
      </div>
      <div className="px-4 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Components</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {CATEGORIES.map((cat) => {
          const items = COMPONENTS.filter((c) => c.category === cat.id && (!query || c.title.toLowerCase().includes(query)))
          if (query && items.length === 0) return null
          const isOpen = query ? true : open.has(cat.id)
          const Icon = cat.icon
          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => setOpen((s) => {
                  const next = new Set(s)
                  if (next.has(cat.id)) next.delete(cat.id)
                  else next.add(cat.id)
                  return next
                })}
                className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm hover:bg-accent"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1 text-left">{cat.label}</span>
                {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="mb-1 ml-4 border-l pl-2">
                  {items.map((c) => {
                    const CIcon = c.icon
                    return (
                      <div
                        key={c.kind}
                        draggable
                        title={c.description}
                        className="flex h-9 cursor-grab items-center gap-2.5 rounded-md px-2 text-sm hover:bg-sidebar-accent"
                      >
                        {c.mochi ? <MochiAvatar role={c.mochi} size={20} /> : <CIcon className={cn('size-4', c.runsCode ? 'text-warning-soft-foreground' : 'text-primary')} />}
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
      <div className="border-t p-2">
        <button type="button" onClick={onNewPython} className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-accent">
          <Plus className="size-4" /> New Python component
        </button>
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

type ChatMsg = { from: 'you' | 'flow'; text: string }

function Playground({ step, onSend, onClose, msgs }: { step: number; onSend: (text: string) => void; onClose: () => void; msgs: ChatMsg[] }) {
  const [text, setText] = useState('Review the branch claude/flows-canvas')
  const running = step >= 0 && step < SAMPLE_RUN.length
  const shown = step < 0 ? [] : SAMPLE_RUN.slice(0, Math.min(step + 1, SAMPLE_RUN.length))
  const cost = shown.reduce((s, r) => s + (r.cost ?? 0), 0)
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l bg-card">
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <PanelRight className="size-4 text-muted-foreground" />
        <div className="flex-1 text-sm font-semibold">Playground</div>
        {step >= 0 && <span className="font-mono text-xs text-muted-foreground">${cost.toFixed(3)}</span>}
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose}><X /></Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="grid place-items-center gap-3 py-12 text-center">
            <AgentMochi name="Lead reviewer" size={56} />
            <div className="text-sm font-medium">Try the flow</div>
            <p className="max-w-60 text-xs text-muted-foreground">Your message goes to Chat input. Each step lights up on the canvas as it runs.</p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.from === 'you' ? (
            <div key={i} className="ml-10 rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.text}</div>
          ) : (
            <div key={i} className="flex gap-2">
              <AgentMochi name="Lead reviewer" size={28} />
              <div className="rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-line">{m.text}</div>
            </div>
          ),
        )}
        {shown.length > 0 && (
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium">
              <span>{running ? 'Running…' : 'Finished'} · {shown.length} of {SAMPLE_RUN.length} steps</span>
              <Badge variant={running ? 'info' : 'success'}>{running ? 'Live' : 'Done'}</Badge>
            </div>
            <ol className="divide-y">
              {shown.map((r, i) => {
                const live = running && i === shown.length - 1
                return (
                  <li key={i} className="flex gap-2 px-3 py-2 text-xs">
                    <span className={cn('mt-1 size-2 shrink-0 rounded-full', live ? 'animate-pulse bg-primary' : 'bg-success')} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{r.label}</div>
                      <div className="truncate text-muted-foreground">{r.detail}</div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                      {live ? '…' : r.ms >= 1000 ? `${(r.ms / 1000).toFixed(1)} s` : `${r.ms} ms`}
                      {r.cost !== undefined && !live && <div>${r.cost.toFixed(3)}</div>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="min-h-0 flex-1 resize-none bg-transparent text-sm outline-none" />
          <Button size="icon" className="size-8" disabled={running || !text.trim()} onClick={() => onSend(text)} aria-label="Send"><Send /></Button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">Counts toward your spending limit like any Chat turn.</div>
      </div>
    </aside>
  )
}

function LogsDrawer({ step, onClose }: { step: number; onClose: () => void }) {
  const rows = step < 0 ? [] : SAMPLE_RUN.slice(0, Math.min(step + 1, SAMPLE_RUN.length))
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 h-56 border-t bg-card shadow-elevation-3">
      <div className="flex h-10 items-center gap-2 border-b px-4 text-sm font-semibold">
        <SquareTerminal className="size-4 text-muted-foreground" /> Logs
        <span className="font-normal text-muted-foreground">· last run</span>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose}><X /></Button>
      </div>
      <div className="h-[calc(100%-2.5rem)] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-left text-muted-foreground">
            <tr><th className="px-4 py-1.5 font-medium">Step</th><th className="px-2 font-medium">What happened</th><th className="px-2 text-right font-medium">Time</th><th className="px-4 text-right font-medium">Cost</th></tr>
          </thead>
          <tbody className="divide-y font-mono">
            {rows.map((r, i) => (
              <tr key={i}><td className="px-4 py-1.5 font-sans font-medium">{r.label}</td><td className="truncate px-2 text-muted-foreground">{r.detail}</td><td className="px-2 text-right">{r.ms} ms</td><td className="px-4 text-right">{r.cost !== undefined ? `$${r.cost.toFixed(3)}` : ''}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center font-sans text-muted-foreground">Run the flow to see each step here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const FINAL_REPLY = `Verdict: close, two fixes before merge.

1. FlowEditor re-creates nodeTypes on every render; move it to module scope.
2. The Python step has no timeout; add one.
3. Port colors use raw hex in one place; use the tokens.

Readability: grade 7.2 (target 8).`

function Editor({ flow, onBack, autoPlay }: { flow: FlowSummary; onBack: () => void; autoPlay?: 'playground' | 'running' | 'done' | 'logs' | 'python' | 'deploy' }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(SAMPLE_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(SAMPLE_EDGES)
  const [showPlay, setShowPlay] = useState(autoPlay === 'playground' || autoPlay === 'running' || autoPlay === 'done')
  const [showLogs, setShowLogs] = useState(autoPlay === 'logs')
  const [pyOpen, setPyOpen] = useState(autoPlay === 'python')
  const [deployOpen, setDeployOpen] = useState(autoPlay === 'deploy')
  const [step, setStep] = useState(-1)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const send = useCallback((text: string) => {
    setMsgs([{ from: 'you', text }])
    setStep(0)
  }, [])

  // Plays back the sample run: each step lights its node.
  useEffect(() => {
    if (step < 0) return
    if (step >= SAMPLE_RUN.length) {
      setMsgs((m) => (m.length === 1 ? [...m, { from: 'flow', text: FINAL_REPLY }] : m))
      return
    }
    timer.current = setTimeout(() => setStep((s) => s + 1), 650)
    return () => clearTimeout(timer.current)
  }, [step])

  useEffect(() => {
    if (autoPlay === 'running' || autoPlay === 'done' || autoPlay === 'logs') send('Review the branch claude/flows-canvas')
    if (autoPlay === 'done' || autoPlay === 'logs') setStep(SAMPLE_RUN.length)
  }, [autoPlay, send])

  useEffect(() => {
    const doneIds = new Set(SAMPLE_RUN.slice(0, Math.max(0, step)).map((r) => r.node))
    const live = step >= 0 && step < SAMPLE_RUN.length ? SAMPLE_RUN[step].node : undefined
    setNodes((ns) =>
      ns.map((x) => {
        const status = step < 0 ? 'idle' : x.id === live ? 'running' : doneIds.has(x.id) ? 'done' : 'queued'
        const runs = SAMPLE_RUN.filter((r) => r.node === x.id)
        const ms = runs.reduce((s, r) => s + r.ms, 0)
        const cost = runs.reduce((s, r) => s + (r.cost ?? 0), 0)
        const result = status === 'done' && step >= SAMPLE_RUN.length ? `${ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`}${cost ? ` · $${cost.toFixed(3)}` : ''}` : undefined
        return x.data.status === status && x.data.result === result ? x : { ...x, data: { ...x.data, status, result } }
      }),
    )
  }, [step, setNodes])

  const live = step >= 0 && step < SAMPLE_RUN.length ? SAMPLE_RUN[step].node : undefined
  const styledEdges = useMemo(
    () =>
      edges.map((ed) => {
        const color = PORT_COLOR[portTypeOf(nodes, ed.source, ed.sourceHandle)]
        const animated = !!live && (ed.target === live || ed.source === live)
        return { ...ed, animated, style: { stroke: color, strokeWidth: 2 } }
      }),
    [edges, nodes, live],
  )

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge(c, es)), [setEdges])

  return (
    <div className="flex h-full min-h-[36rem] flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="Back to flows"><ArrowLeft /></Button>
        <AgentMochi name={flow.agentName} size={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{flow.name}</div>
          <div className="text-xs text-muted-foreground">Saved · version 12 · {nodes.length} steps</div>
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" title="Every save is a version you can go back to"><History /> Versions</Button>
        <Button variant={showPlay ? 'soft' : 'outline'} size="sm" onClick={() => setShowPlay((v) => !v)}><PanelRight /> Playground</Button>
        <Button size="sm" onClick={() => setDeployOpen(true)}><Rocket /> Deploy</Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <Palette onNewPython={() => setPyOpen(true)} />
        <div className="relative min-w-0 flex-1 bg-background">
          <ReactFlow
            nodes={nodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.3}
            proOptions={{ hideAttribution: true }}
            className="flows-canvas"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="var(--border)" />
            <ZoomControls />
          </ReactFlow>
          <Button variant="outline" size="sm" className="absolute bottom-4 left-4 z-10 bg-card shadow-elevation-2" onClick={() => setShowLogs((v) => !v)}>
            <SquareTerminal /> Logs
          </Button>
          {showLogs && <LogsDrawer step={step} onClose={() => setShowLogs(false)} />}
        </div>
        {showPlay && <Playground step={step} msgs={msgs} onSend={send} onClose={() => setShowPlay(false)} />}
      </div>
      <PythonComponentDialog open={pyOpen} onOpenChange={setPyOpen} />
      <DeployDialog open={deployOpen} onOpenChange={setDeployOpen} flow={flow} />
    </div>
  )
}

export function FlowEditor(props: { flow: FlowSummary; onBack: () => void; autoPlay?: 'playground' | 'running' | 'done' | 'logs' | 'python' | 'deploy' }) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  )
}
