import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bot, Braces, Copy, GitBranch, Layers, Loader2, MoreHorizontal, Plus, Search, Sparkles, Trash2, Workflow } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { AgentMochi } from '@/components/mochi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { isDesktop } from '@/modules/client'
import { openWiki } from '@/modules/wiki/store'

import { call, errorText } from './api'
import { COMPONENT_BY_KIND, KIND_ICON } from './components'
import { FlowEditor } from './FlowEditor'
import type { EditorOptions, FlowDoc, FlowList, FlowSummary } from './types'

/** The flow open in the editor, kept while the app runs so leaving and coming back resumes it. */
let openFlowId: string | undefined

function ago(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
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
        const Icon = KIND_ICON[k] ?? Bot
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-0.5 w-3 rounded bg-primary/40" />}
            <span className={`grid size-7 place-items-center rounded-md ring-1 ring-foreground/10 ${def?.mochi ? 'bg-highlight-soft text-highlight-soft-foreground' : 'bg-card text-primary'}`} title={def?.title}>
              <Icon className="size-3.5" />
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FlowCard({ flow, onOpen, onCopy, onDelete }: { flow: FlowSummary; onOpen: () => void; onCopy: () => void; onDelete: () => void }) {
  return (
    <Card className="cursor-pointer gap-0 py-0 transition-shadow hover:shadow-elevation-2" onClick={onOpen}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <AgentMochi name={flow.agentName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{flow.name}</div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{flow.error ?? (flow.description || `${flow.steps} steps`)}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="-mt-1 -mr-2 size-8" onClick={(e) => e.stopPropagation()} aria-label={`More for ${flow.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={onCopy} disabled={!!flow.error}><Copy /> Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-destructive"><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <MiniGraph kinds={flow.kinds} />
        <div className="flex flex-wrap items-center gap-1.5">
          {flow.error && <Badge variant="destructive"><AlertTriangle /> Damaged</Badge>}
          {flow.running && <Badge variant="info"><Loader2 className="animate-spin" /> Running</Badge>}
          {flow.folder ? <Badge variant="outline">{flow.folder}</Badge> : !flow.error && <Badge variant="warning">No repo picked</Badge>}
        </div>
        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{flow.steps} steps · {flow.runs7d ?? 0} {flow.runs7d === 1 ? 'run' : 'runs'} this week</span>
          <span>{flow.updated ? ago(flow.updated) : ''}</span>
        </div>
      </CardContent>
    </Card>
  )
}

const TEMPLATE_ICON: Record<string, typeof Bot> = { blank: Workflow, 'basic-prompt': Braces, 'agent-in-repo': Bot, 'draft-review': Layers, 'side-by-side': GitBranch }

export default function FlowsPage() {
  const [openId, setOpenId] = useState<string | undefined>(openFlowId)
  const [list, setList] = useState<FlowList>()
  const [options, setOptions] = useState<EditorOptions>()
  const [error, setError] = useState<string>()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string>()
  const [deleting, setDeleting] = useState<FlowSummary>()

  const open = (id: string | undefined) => {
    openFlowId = id
    setOpenId(id)
  }

  const load = useCallback(() => {
    call<FlowList>('list').then((l) => {
      setList(l)
      setError(undefined)
    }, (e) => setError(errorText(e)))
  }, [])

  useEffect(() => {
    if (openId) return
    load()
    call<EditorOptions>('options').then(setOptions, () => {})
  }, [openId, load])

  const create = async (args: Record<string, unknown>, key: string) => {
    setBusy(key)
    try {
      const doc = await call<FlowDoc>('create', args)
      open(doc.flow.id)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(undefined)
    }
  }

  if (openId) return <FlowEditor flowId={openId} onBack={() => open(undefined)} />

  const flows = (list?.flows ?? []).filter((f) => !q || `${f.name} ${f.description}`.toLowerCase().includes(q.toLowerCase()))
  const firstRepo = options?.repos[0]?.name ?? ''
  return (
    <div className="mx-auto h-full w-full max-w-[96rem] space-y-8 overflow-y-auto p-6 lg:p-8">
      <PageHeader
        eyebrow="Agents"
        title="Flows"
        description="Build an agent as a graph of steps: inputs, agents, your Catalog subagents, model calls and prompts. Try it in the Playground; every save is a version."
        actions={
          <>
            <Button variant="outline" onClick={() => openWiki('guide/agents/flows')}>How flows work</Button>
            <Button onClick={() => void create({ template: 'blank', folder: firstRepo }, 'new')} disabled={!!busy}>
              {busy === 'new' ? <Loader2 className="animate-spin" /> : <Plus />} New flow
            </Button>
          </>
        }
      />
      {!isDesktop() && <div className="rounded-lg bg-info-soft px-4 py-2 text-sm text-info-soft-foreground">Browser preview: sample flows, and runs are pretend. In the desktop app agent steps run as real Chat turns.</div>}
      {error && <div className="rounded-lg bg-destructive-soft px-4 py-2 text-sm text-destructive-soft-foreground">{error}</div>}
      {options && options.repos.length === 0 && (
        <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
          Agent steps work inside one of Chat's allowed repos, and you have none yet. Add one in Chat &gt; Folders, then pick it in a flow's top bar.
        </div>
      )}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Start from a template</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(options?.templates ?? []).filter((t) => t.id !== 'blank').map((t) => {
            const Icon = TEMPLATE_ICON[t.id] ?? Workflow
            return (
              <button key={t.id} type="button" disabled={!!busy} onClick={() => void create({ template: t.id, folder: firstRepo }, t.id)} className="flex items-start gap-3 rounded-[var(--radius)] p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-accent disabled:opacity-60">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">{busy === t.id ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}</span>
                <span>
                  <span className="block text-sm font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.text}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">Your flows <span className="font-normal text-muted-foreground">· {list?.flows.length ?? 0}</span></div>
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flows" className="pl-8" />
          </div>
        </div>
        {list && list.flows.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-[var(--radius)] py-16 text-center ring-1 ring-foreground/10">
            <Workflow className="size-8 text-muted-foreground" />
            <div className="text-sm font-medium">No flows yet</div>
            <p className="max-w-sm text-xs text-muted-foreground">Start from a template above, or a blank flow. Flows are kept in a local git repo in MonoRail's data folder, never in a repo you push.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {flows.map((f) => (
              <FlowCard key={f.id} flow={f} onOpen={() => !f.error && open(f.id)} onCopy={() => void create({ copyOf: f.id }, 'copy')} onDelete={() => setDeleting(f)} />
            ))}
          </div>
        )}
      </section>
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>The flow leaves the list. Its versions stay in the flows repo's history and in your backups.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(undefined)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const f = deleting
                setDeleting(undefined)
                if (f) call('remove', { id: f.id }).then(load, (e) => setError(errorText(e)))
              }}
            >
              <Trash2 /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
