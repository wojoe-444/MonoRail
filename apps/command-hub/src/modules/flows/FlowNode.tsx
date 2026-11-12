import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node, useEdges } from '@xyflow/react'
import { Check, ChevronsUpDown, Loader2, Lock, Maximize2, Play, ShieldAlert, Hourglass } from 'lucide-react'

import { MochiAvatar, AgentMochi } from '@/components/mochi'
import { cn } from '@/lib/utils'

import { PORT_COLOR, PORT_LABEL, componentFor } from './components'
import type { Field, FlowNodeData, PortType } from './types'

function PortDot({ type, side, id }: { type: PortType; side: 'left' | 'right'; id: string }) {
  return (
    <Handle
      id={id}
      type={side === 'left' ? 'target' : 'source'}
      position={side === 'left' ? Position.Left : Position.Right}
      title={PORT_LABEL[type]}
      className="flow-port"
      style={{ background: PORT_COLOR[type], [side]: -6 }}
    />
  )
}

function FieldRow({ field, value, connected }: { field: Field; value: unknown; connected: boolean }) {
  const shown = value ?? field.value
  return (
    <div className="relative px-4 py-1.5">
      {field.port && <PortDot type={field.port} side="left" id={field.id} />}
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-foreground/80">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </div>
      {connected ? (
        <div className="flex h-8 items-center justify-between rounded-md border border-dashed bg-muted/50 px-2.5 text-xs text-muted-foreground">
          Receiving input
          <Lock className="size-3" />
        </div>
      ) : field.kind === 'textarea' ? (
        <div className="line-clamp-3 rounded-md border bg-background px-2.5 py-1.5 text-xs leading-relaxed text-foreground/90">
          {String(shown ?? '') || <span className="text-muted-foreground">Type or connect…</span>}
        </div>
      ) : field.kind === 'select' ? (
        <div className="flex h-8 items-center justify-between rounded-md border bg-background px-2.5 text-xs">
          <span className="truncate">{String(shown ?? '')}</span>
          <ChevronsUpDown className="size-3 text-muted-foreground" />
        </div>
      ) : (
        <div className="flex h-8 items-center justify-between rounded-md border bg-background px-2.5 text-xs">
          <span className={cn('truncate', shown === undefined || shown === '' ? 'text-muted-foreground' : 'font-mono')}>
            {shown === undefined || shown === '' ? (field.port ? 'Type or connect…' : 'Empty') : String(shown)}
          </span>
          {field.kind === 'text' && !field.port && <Maximize2 className="size-3 text-muted-foreground" />}
        </div>
      )}
    </div>
  )
}

const STATUS_RING: Record<string, string> = {
  running: 'ring-2 ring-primary shadow-elevation-3',
  done: 'ring-1 ring-success/60',
  error: 'ring-2 ring-destructive',
  waiting: 'ring-2 ring-warning',
  queued: 'opacity-70',
}

export const FlowNode = memo(function FlowNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const def = componentFor(data.kind)
  const edges = useEdges()
  const connected = new Set(edges.filter((e) => e.target === id).map((e) => e.targetHandle))
  const Icon = def.icon
  const status = data.status ?? 'idle'
  return (
    <div
      className={cn(
        'w-[280px] rounded-[var(--radius)] bg-card text-card-foreground ring-1 ring-foreground/10 transition-shadow',
        selected && 'ring-2 ring-primary/70',
        STATUS_RING[status],
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        {def.mochi ? (
          data.agentName ? <AgentMochi name={data.agentName} size={36} /> : <MochiAvatar role={def.mochi} size={36} />
        ) : (
          <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg', def.runsCode ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
            <Icon className="size-4.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-semibold">{data.title ?? def.title}</div>
            {def.runsCode && <ShieldAlert className="size-3.5 shrink-0 text-warning-soft-foreground" aria-label="Runs code on this PC" />}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{def.description}</div>
        </div>
        <button type="button" className="nodrag -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Run up to this step">
          {status === 'running' ? <Loader2 className="size-3.5 animate-spin text-primary" /> : status === 'waiting' ? <Hourglass className="size-3.5 text-warning-soft-foreground" /> : status === 'done' ? <Check className="size-3.5 text-success" /> : <Play className="size-3.5" />}
        </button>
      </div>
      {def.fields.length > 0 && (
        <div className="border-t py-2">
          {def.fields.map((f) => (
            <FieldRow key={f.id} field={f} value={data.values[f.id]} connected={connected.has(f.id)} />
          ))}
        </div>
      )}
      {def.outputs.length > 0 && (
        <div className="rounded-b-[var(--radius)] border-t bg-muted/40 py-1.5">
          {def.outputs.map((o) => (
            <div key={o.id} className="relative flex h-8 items-center justify-end gap-2 px-4 text-xs font-medium">
              <span className="text-[10px] font-normal tracking-wide text-muted-foreground uppercase">{PORT_LABEL[o.type]}</span>
              {o.label}
              <PortDot type={o.type} side="right" id={o.id} />
            </div>
          ))}
        </div>
      )}
      {data.result && (
        <div className="border-t px-4 py-1.5 font-mono text-[11px] text-success-soft-foreground">{data.result}</div>
      )}
    </div>
  )
})
