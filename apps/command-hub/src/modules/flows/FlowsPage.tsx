import { useState } from 'react'
import { Bot, Braces, FileUp, GitBranch, Globe, MessagesSquare, Plug, Plus, Repeat, Search, ShieldAlert, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { AgentMochi } from '@/components/mochi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { COMPONENT_BY_KIND } from './components'
import { FlowEditor } from './FlowEditor'
import { SAMPLE_FLOWS } from './sample'
import type { FlowSummary } from './types'

type Preview = 'playground' | 'running' | 'done' | 'logs' | 'python' | 'deploy'

function ago(ms: number): string {
  const h = Math.round((Date.now() - ms) / 3_600_000)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** A tiny left-to-right sketch of the flow's steps. */
function MiniGraph({ kinds }: { kinds: string[] }) {
  return (
    <div className="flex h-16 items-center gap-1.5 overflow-hidden rounded-lg bg-muted/50 px-3 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:12px_12px]">
      {kinds.map((k, i) => {
        const def = COMPONENT_BY_KIND.get(k)
        const Icon = def?.icon ?? Bot
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-0.5 w-3 rounded bg-primary/40" />}
            <span className={`grid size-7 place-items-center rounded-md ring-1 ring-foreground/10 ${def?.runsCode ? 'bg-warning-soft text-warning-soft-foreground' : def?.mochi ? 'bg-highlight-soft text-highlight-soft-foreground' : 'bg-card text-primary'}`} title={def?.title}>
              <Icon className="size-3.5" />
            </span>
          </div>
        )
      })}
    </div>
  )
}

const DEPLOY_LABEL = { mcp: { label: 'MCP tool', icon: Plug }, api: { label: 'Local API', icon: Globe }, chat: { label: 'In Chat', icon: MessagesSquare } } as const

function FlowCard({ flow, onOpen }: { flow: FlowSummary; onOpen: () => void }) {
  return (
    <Card className="cursor-pointer gap-0 py-0 transition-shadow hover:shadow-elevation-2" onClick={onOpen}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <AgentMochi name={flow.agentName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{flow.name}</div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{flow.description}</p>
          </div>
        </div>
        <MiniGraph kinds={flow.kinds} />
        <div className="flex flex-wrap items-center gap-1.5">
          {flow.deployed.map((d) => {
            const I = DEPLOY_LABEL[d].icon
            return <Badge key={d} variant="primary"><I /> {DEPLOY_LABEL[d].label}</Badge>
          })}
          {flow.usesPython && <Badge variant="warning"><ShieldAlert /> Python</Badge>}
          {flow.deployed.length === 0 && <Badge variant="outline">Not deployed</Badge>}
        </div>
        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{flow.nodes} steps · {flow.runs7d} runs this week</span>
          <span>{ago(flow.updated)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

const TEMPLATES = [
  { title: 'Basic prompt', text: 'Chat input, a prompt and one model call.', icon: Braces },
  { title: 'Agent with helpers', text: 'A lead agent that calls subagents as tools.', icon: Bot },
  { title: 'Route by topic', text: 'A model picks the branch, each branch its own agent.', icon: GitBranch },
  { title: 'Draft and check loop', text: 'Write, review, repeat until it passes.', icon: Repeat },
]

export default function FlowsPage() {
  const [preview] = useState<Preview | undefined>(() => (sessionStorage.getItem('flows.preview') as Preview | null) ?? undefined)
  const [open, setOpen] = useState<FlowSummary | undefined>(() => (preview ? SAMPLE_FLOWS[0] : undefined))
  const [q, setQ] = useState('')

  if (open) return <FlowEditor flow={open} onBack={() => setOpen(undefined)} autoPlay={preview} />

  const flows = SAMPLE_FLOWS.filter((f) => !q || `${f.name} ${f.description}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mx-auto h-full w-full max-w-[96rem] space-y-8 overflow-y-auto p-6 lg:p-8">
      <PageHeader
        eyebrow="Agents"
        title="Flows"
        description="Build agents as a graph of steps: inputs, agents, subagents, tools, Python and branches. Run them here, from Chat, or as an MCP tool."
        actions={
          <>
            <Button variant="outline"><FileUp /> Import</Button>
            <Button onClick={() => setOpen(SAMPLE_FLOWS[0])}><Plus /> New flow</Button>
          </>
        }
      />
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Start from a template</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button key={t.title} type="button" className="flex items-start gap-3 rounded-[var(--radius)] p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-accent">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground"><t.icon className="size-4" /></span>
              <span>
                <span className="block text-sm font-medium">{t.title}</span>
                <span className="block text-xs text-muted-foreground">{t.text}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">Your flows <span className="font-normal text-muted-foreground">· {SAMPLE_FLOWS.length}</span></div>
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flows" className="pl-8" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {flows.map((f) => <FlowCard key={f.id} flow={f} onOpen={() => setOpen(f)} />)}
        </div>
      </section>
    </div>
  )
}
