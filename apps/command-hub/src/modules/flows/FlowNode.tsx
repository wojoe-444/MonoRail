import { memo, useState } from 'react'
import { Handle, Position, useEdges, type Node, type NodeProps } from '@xyflow/react'
import { AlertCircle, Check, Loader2, Lock, MinusCircle } from 'lucide-react'

import { AgentMochi, MochiAvatar } from '@/components/mochi'
import { cn } from '@/lib/utils'

import { KIND_ICON, PORT_COLOR, PORT_LABEL, componentFor, placeholders, valueOf } from './components'
import { useEditor } from './context'
import type { EditorOptions, Field, FlowNode as FlowNodeT, PortType } from './types'

export type FlowNodeData = Pick<FlowNodeT, 'kind' | 'title' | 'values'> & Record<string, unknown>

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

const FIXED_LABEL: Record<string, string> = { claude: 'Claude', pi: 'pi', ask: 'Ask (read only)', agent: 'Agent (normal rules)' }

function optionsFor(field: Field, values: Record<string, string>, kind: string, options?: EditorOptions): { value: string; label: string }[] {
  if (field.options) return field.options.map((o) => ({ value: o, label: FIXED_LABEL[o] ?? o }))
  if (field.optionsFrom === 'models') {
    const sdk = kind === 'agent' && (values.sdk ?? 'claude') === 'pi' ? 'pi' : 'claude'
    return (options?.models[sdk] ?? [{ id: 'default', label: 'Default' }]).map((m) => ({ value: m.id, label: m.label }))
  }
  if (field.optionsFrom === 'repos') return [{ value: '', label: "The flow's repo" }, ...(options?.repos ?? []).map((r) => ({ value: r.name, label: r.name }))]
  if (field.optionsFrom === 'subagents')
    return [{ value: '', label: 'Pick a subagent…' }, ...(options?.subagents ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.tool === 'pi' ? 'pi' : 'Claude Code'}${s.repo ? ` · ${s.repo}` : ''}` }))]
  return []
}

const inputCls = 'nodrag nowheel w-full rounded-md border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'

function FieldRow({ nodeId, kind, field, values, connected }: { nodeId: string; kind: string; field: Field; values: Record<string, string>; connected: boolean }) {
  const { options, setValue } = useEditor()
  const value = valueOf({ kind, values }, field.id)
  const set = (v: string) => setValue(nodeId, field.id, v)
  let control
  if (connected) {
    control = (
      <div className="flex h-8 items-center justify-between rounded-md border border-dashed bg-muted/50 px-2.5 text-xs text-muted-foreground">
        Receiving input
        <Lock className="size-3" />
      </div>
    )
  } else if (field.kind === 'textarea') {
    control = <textarea value={value} onChange={(e) => set(e.target.value)} rows={3} placeholder={field.port ? 'Type or connect…' : ''} className={cn(inputCls, 'resize-y py-1.5 leading-relaxed')} />
  } else if (field.kind === 'select') {
    const opts = optionsFor(field, values, kind, options)
    const known = opts.some((o) => o.value === value)
    control = (
      <select value={value} onChange={(e) => set(e.target.value)} className={cn(inputCls, 'h-8')}>
        {!known && <option value={value}>{value ? `${value} (not found)` : '—'}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  } else {
    control = <input value={value} onChange={(e) => set(e.target.value)} placeholder={field.port ? 'Type or connect…' : ''} className={cn(inputCls, 'h-8', field.id === 'sep' && 'font-mono')} />
  }
  return (
    <div className="relative px-4 py-1.5">
      {field.port && <PortDot type={field.port} side="left" id={field.id} />}
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-foreground/80" title={field.hint}>
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </div>
      {control}
    </div>
  )
}

const STATUS_RING: Record<string, string> = {
  running: 'ring-2 ring-primary shadow-elevation-3',
  done: 'ring-1 ring-success/60',
  failed: 'ring-2 ring-destructive',
  stopped: 'ring-2 ring-warning',
  queued: 'opacity-70',
  skipped: 'opacity-50',
}

function money(n?: number) {
  return n === undefined ? '' : ` · $${n.toFixed(3)}`
}

function ms(a?: number, b?: number) {
  if (!a || !b) return ''
  const d = b - a
  return d >= 1000 ? `${(d / 1000).toFixed(1)} s` : `${d} ms`
}

export const FlowNode = memo(function FlowNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const def = componentFor(data.kind)
  const { stepOf, setTitle } = useEditor()
  const edges = useEdges()
  const connected = new Set(edges.filter((e) => e.target === id).map((e) => e.targetHandle))
  const Icon = KIND_ICON[data.kind]
  const step = stepOf(id)
  const status = step?.status
  const title = data.title || def.title
  const [editing, setEditing] = useState(false)
  const vars = data.kind === 'prompt' ? placeholders(valueOf(data, 'template')) : []
  return (
    <div className={cn('w-[280px] rounded-[var(--radius)] bg-card text-card-foreground ring-1 ring-foreground/10 transition-shadow', selected && 'ring-2 ring-primary/70', status && STATUS_RING[status])}>
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        {def.mochi ? (
          data.title ? <AgentMochi name={data.title} size={36} /> : <MochiAvatar role={def.mochi} size={36} />
        ) : (
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">{Icon && <Icon className="size-4.5" />}</div>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              defaultValue={data.title ?? ''}
              placeholder={def.title}
              maxLength={80}
              onBlur={(e) => {
                setTitle(id, e.target.value)
                setEditing(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setEditing(false)
              }}
              className={cn(inputCls, 'h-7 text-sm font-semibold')}
            />
          ) : (
            <div className="truncate text-sm font-semibold" title="Double-click to rename" onDoubleClick={() => setEditing(true)}>
              {title}
            </div>
          )}
          <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{data.title && data.title !== def.title ? def.title : def.description}</div>
        </div>
        <div className="-mr-1 grid size-7 shrink-0 place-items-center">
          {status === 'running' ? <Loader2 className="size-3.5 animate-spin text-primary" /> : status === 'done' ? <Check className="size-3.5 text-success" /> : status === 'failed' ? <AlertCircle className="size-3.5 text-destructive" /> : status === 'stopped' || status === 'skipped' ? <MinusCircle className="size-3.5 text-muted-foreground" /> : null}
        </div>
      </div>
      {(def.fields.length > 0 || vars.length > 0) && (
        <div className="border-t py-2">
          {def.fields.map((f) => (
            <FieldRow key={f.id} nodeId={id} kind={data.kind} field={f} values={data.values} connected={connected.has(f.id)} />
          ))}
          {vars.map((v) => (
            <div key={v} className="relative flex h-8 items-center justify-between px-4 text-xs">
              <PortDot type="any" side="left" id={`var:${v}`} />
              <span className="font-mono">{`{${v}}`}</span>
              <span className="text-muted-foreground">{connected.has(`var:${v}`) ? 'Receiving input' : 'Not connected: empty'}</span>
            </div>
          ))}
        </div>
      )}
      {def.outputs.length > 0 && (
        <div className={cn('border-t bg-muted/40 py-1.5', !step?.endedAt && 'rounded-b-[var(--radius)]')}>
          {def.outputs.map((o) => (
            <div key={o.id} className="relative flex h-8 items-center justify-end gap-2 px-4 text-xs font-medium">
              <span className="text-[10px] font-normal tracking-wide text-muted-foreground uppercase">{PORT_LABEL[o.type]}</span>
              {o.label}
              <PortDot type={o.type} side="right" id={o.id} />
            </div>
          ))}
        </div>
      )}
      {step?.endedAt && (step.status === 'done' || step.status === 'failed') && (
        <div className={cn('border-t px-4 py-1.5 font-mono text-[11px]', step.status === 'failed' ? 'text-destructive' : 'text-success-soft-foreground')} title={step.error}>
          {step.status === 'failed' ? 'Failed' : ms(step.startedAt, step.endedAt)}
          {step.status === 'done' && money(step.costUsd)}
          {step.tools > 0 && ` · ${step.tools} tool calls`}
        </div>
      )}
    </div>
  )
})
