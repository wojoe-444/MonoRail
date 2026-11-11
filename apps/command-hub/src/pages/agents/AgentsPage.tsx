import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Bot,
  FlaskConical,
  FolderGit2,
  GitBranch,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Smile,
  Sparkles,
  Wrench,
} from 'lucide-react'

import { Sparkline } from '@/components/charts/Sparkline'
import { StatTile } from '@/components/charts/StatTile'
import { PageHeader } from '@/components/layout/PageHeader'
import { AgentMochi } from '@/components/mochi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { formatUSD } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'
import { openInChat } from '@/modules/agent-chat/handoff'
import { SOURCE_LABEL, type SessionSource } from '@/modules/agent-chat/types'
import { isDesktop, useModuleQuery } from '@/modules/client'

import { MochiCrewDialog } from './MochiCrewDialog'
import { sampleDetail, sampleOverview } from './sample'
import type { AgentDefinition, AgentsOverview, DefinitionDetail, RecentSession, SessionState } from './types'

type KindFilter = 'all' | 'subagent' | 'skill'

function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const stateMeta: Record<Exclude<SessionState, 'idle'>, { label: string; variant: 'success' | 'info' }> = {
  running: { label: 'Running in MonoRail', variant: 'success' },
  active: { label: 'Active', variant: 'info' },
}

const KIND_LABEL = { subagent: 'Subagent', skill: 'Skill' } as const

export function AgentsPage() {
  const desktop = isDesktop()
  const query = useModuleQuery<AgentsOverview>('agents', 'getOverview')
  const sample = useMemo(() => (desktop ? undefined : sampleOverview()), [desktop])
  const data = desktop ? query.data : sample
  const [openDef, setOpenDef] = useState<AgentDefinition>()
  const [crewOpen, setCrewOpen] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Workspace"
        title="Agents"
        description="Your agent definitions, who is working right now, and the latest Claude Code and pi sessions in your repos."
        actions={
          <>
            {!desktop && (
              <Badge variant="info">
                <FlaskConical /> Sample data
              </Badge>
            )}
            {desktop && (
              <Button variant="outline" onClick={() => void query.refresh()} disabled={query.fetching}>
                {query.fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Refresh
              </Button>
            )}
            <Button variant="outline" onClick={() => setCrewOpen(true)}>
              <Smile />
              Characters
            </Button>
            <Button onClick={() => openInChat({ newChat: {} })}>
              <MessageSquarePlus />
              New chat
            </Button>
          </>
        }
      />

      {desktop && query.error && !data && (
        <Card className="border border-destructive/30 ring-0">
          <CardContent className="text-sm text-destructive-soft-foreground">Could not load the overview: {query.error.message}</CardContent>
        </Card>
      )}

      <KpiRow data={data} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <RecentCard data={data} loading={desktop && query.loading} className="xl:col-span-2" />
        <QuickLaunchCard data={data} />
      </section>

      <DefinitionsCard data={data} loading={desktop && query.loading} onOpen={setOpenDef} />

      <MochiCrewDialog open={crewOpen} onOpenChange={setCrewOpen} />
      <DefinitionDialog def={openDef} repos={data?.repos ?? []} onClose={() => setOpenDef(undefined)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPIs

function KpiRow({ data }: { data?: AgentsOverview }) {
  const a = data?.activity
  const perDay = a?.days.map((d) => d.claude + d.pi) ?? []
  const defs = data?.definitions ?? []
  const subagents = defs.filter((d) => d.kind === 'subagent').length
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        hero
        label="Active now"
        value={a ? String(a.activeNow) : '–'}
        hint={a ? (a.runningTurns ? `${a.runningTurns} running in MonoRail` : 'Sessions busy in the last 3 min') : undefined}
      />
      <StatTile
        label="Sessions"
        value={a ? `${a.week}${a.weekCapped ? '+' : ''}` : '–'}
        hint={a ? `Last 7 days · ${a.today} today${a.weekCapped ? ' · newest 60 chats only' : ''}` : undefined}
        trend={perDay.length > 1 ? <Sparkline data={perDay} className="text-primary" /> : undefined}
      />
      <StatTile
        label="Definitions"
        value={data ? String(defs.length) : '–'}
        hint={data ? `${subagents} subagents · ${defs.length - subagents} skills` : undefined}
      />
      <StatTile
        label="Spend (7 days)"
        value={data?.cost ? formatUSD(data.cost.total) : '–'}
        hint={data ? (data.cost ? `From Claude Stats${data.cost.stale ? ' · stale' : ''}` : 'Open Claude Stats to build it') : undefined}
        trend={data?.cost ? <Sparkline data={data.cost.days.map((d) => d.cost)} className="text-highlight" /> : undefined}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Recent sessions

function SourceTile({ source }: { source: SessionSource }) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold',
        source === 'claude' ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-highlight/15 text-foreground',
      )}
      title={SOURCE_LABEL[source]}
    >
      {source === 'claude' ? <Bot className="size-5" /> : 'pi'}
    </div>
  )
}

function RecentCard({ data, loading, className }: { data?: AgentsOverview; loading: boolean; className?: string }) {
  const recent = data?.recent ?? []
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>Claude Code and pi, newest first, in your allowed repos</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => navigate('/agents/chat')}>
            Open Chat
            <ArrowRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading session logs…
          </div>
        ) : recent.length === 0 ? (
          <EmptyRecent data={data} />
        ) : (
          <ul className="divide-y">
            {recent.map((s) => (
              <RecentRow key={s.id} s={s} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function RecentRow({ s }: { s: RecentSession }) {
  const meta = s.state === 'idle' ? undefined : stateMeta[s.state]
  return (
    <li>
      <button
        type="button"
        onClick={() => openInChat({ open: s.id })}
        className="flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <SourceTile source={s.source} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{s.title || 'Untitled session'}</span>
            {meta && (
              <Badge variant={meta.variant}>
                {s.state === 'running' && <Loader2 className="animate-spin" />}
                {meta.label}
              </Badge>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
            <span className="truncate">{s.repo}</span>
            {s.branch && (
              <>
                <span aria-hidden>·</span>
                <GitBranch className="size-3.5 shrink-0" />
                <span className="truncate font-mono text-xs">{s.branch}</span>
              </>
            )}
            {s.model && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate font-mono text-xs">{s.model}</span>
              </>
            )}
          </div>
        </div>
        <div className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">{ago(s.updatedAt)}</div>
      </button>
    </li>
  )
}

function EmptyRecent({ data }: { data?: AgentsOverview }) {
  const noSources = data && data.sources.every((s) => !s.found)
  const noRepos = data && data.folders.repoCount === 0
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="font-medium">No sessions yet</div>
      <p className="max-w-sm text-sm text-muted-foreground">
        {noSources
          ? 'No Claude Code or pi logs were found on this machine.'
          : noRepos
            ? 'No allowed repos yet. Add your Repos folder or a repo in Chat > Folders.'
            : 'Sessions in your allowed repos will show up here. Start one with New chat.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick launch

function QuickLaunchCard({ data }: { data?: AgentsOverview }) {
  const repos = data?.repos ?? []
  const [repoPick, setRepo] = useState<string>()
  const repo = repoPick ?? repos[0]?.path
  const [sdk, setSdk] = useState<SessionSource>(() => (localStorage.getItem('commandHub.agentChat.sdk') === 'pi' ? 'pi' : 'claude'))
  const [prompt, setPrompt] = useState('')
  const sdkInfo = data?.sdks.find((s) => s.id === sdk)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Quick launch</CardTitle>
        <CardDescription>Start a chat in a repo. You review the prompt in Chat before it is sent.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ql-repo">Repo</Label>
          <NativeSelect id="ql-repo" value={repo ?? ''} onChange={(e) => setRepo(e.target.value)} disabled={!repos.length}>
            {repos.length === 0 && <option value="">No allowed repos</option>}
            {repos.map((r) => (
              <option key={r.path} value={r.path}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Agent</Label>
          <Segmented<SessionSource>
            aria-label="Agent"
            value={sdk}
            onChange={setSdk}
            className="w-full [&>button]:flex-1"
            options={(['claude', 'pi'] as const).map((id) => {
              const s = data?.sdks.find((x) => x.id === id)
              return { value: id, label: SOURCE_LABEL[id], disabled: s ? !s.ready : false, title: s?.reason }
            })}
          />
          {sdkInfo && !sdkInfo.ready && <p className="text-xs text-warning-soft-foreground">{sdkInfo.reason}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ql-prompt">Prompt (optional)</Label>
          <Textarea
            id="ql-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should the agent do?"
            className="resize-none"
          />
        </div>
        <Button disabled={!repo} onClick={() => openInChat({ newChat: { repo, sdk, prompt: prompt.trim() || undefined } })}>
          <MessageSquarePlus />
          Open in Chat
        </Button>
        {repos.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Busy repos</span>
            <ul className="flex flex-col">
              {repos.slice(0, 4).map((r) => (
                <li key={r.path}>
                  <button
                    type="button"
                    onClick={() => openInChat({ newChat: { repo: r.path, sdk } })}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
                    title={`New chat in ${r.name}`}
                  >
                    <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {r.sessions ? `${r.sessions} chat${r.sessions === 1 ? '' : 's'} · ${ago(r.lastAt)}` : 'no chats yet'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Definitions

function DefinitionsCard({ data, loading, onOpen }: { data?: AgentsOverview; loading: boolean; onOpen: (d: AgentDefinition) => void }) {
  const [kind, setKind] = useState<KindFilter>('all')
  const [q, setQ] = useState('')
  const defs = useMemo(() => data?.definitions ?? [], [data])
  const counts = useMemo(() => ({ all: defs.length, subagent: defs.filter((d) => d.kind === 'subagent').length, skill: defs.filter((d) => d.kind === 'skill').length }), [defs])
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return defs.filter((d) => (kind === 'all' || d.kind === kind) && (!needle || `${d.name} ${d.description} ${d.repo ?? ''} ${d.model ?? ''}`.toLowerCase().includes(needle)))
  }, [defs, kind, q])

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Agent definitions</CardTitle>
        <CardDescription>Claude Code subagents and skills, and pi subagents and skills, from your home folder and your allowed repos</CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search definitions" aria-label="Search definitions" className="w-56 pl-9" />
          </div>
          <Segmented<KindFilter>
            aria-label="Kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: `All ${counts.all}` },
              { value: 'subagent', label: `Subagents ${counts.subagent}` },
              { value: 'skill', label: `Skills ${counts.skill}` },
            ]}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="px-6 py-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Looking for definitions…
          </div>
        ) : defs.length === 0 ? (
          <EmptyDefinitions />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing matches that filter.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((d) => (
              <DefinitionTile key={d.id} d={d} onOpen={() => onOpen(d)} />
            ))}
          </div>
        )}
        {data?.definitionsTruncated && <p className="mt-4 text-xs text-muted-foreground">Showing the first 400 definitions.</p>}
      </CardContent>
    </Card>
  )
}

function DefinitionTile({ d, onOpen }: { d: AgentDefinition; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full flex-col gap-3 rounded-xl p-4 text-left ring-1 ring-foreground/10 transition-shadow outline-none hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        {d.kind === 'subagent' ? (
          <AgentMochi name={d.name} description={d.description} size={48} className="-my-1 -ml-1" />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info-soft-foreground">
            <Sparkles className="size-4.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-semibold">{d.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant={d.kind === 'subagent' ? 'primary' : 'info'}>{KIND_LABEL[d.kind]}</Badge>
            <Badge variant="outline">{SOURCE_LABEL[d.tool]}</Badge>
            <Badge variant="secondary">{d.scope === 'user' ? 'User' : d.repo}</Badge>
          </div>
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{d.description || 'No description.'}</p>
      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
        {d.model && <span className="font-mono">{d.model}</span>}
        {d.tools && (
          <span className="inline-flex items-center gap-1">
            <Wrench className="size-3.5" /> {d.tools.length} tool{d.tools.length === 1 ? '' : 's'}
          </span>
        )}
        <span className="ml-auto">Edited {ago(d.updatedAt)}</span>
      </div>
    </button>
  )
}

function EmptyDefinitions() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <BookOpen className="size-6" />
      </div>
      <div className="font-medium">No agent definitions found</div>
      <p className="max-w-md text-sm text-muted-foreground">
        Claude Code subagents live in <code className="font-mono text-xs">~/.claude/agents</code> or a repo's{' '}
        <code className="font-mono text-xs">.claude/agents</code>, skills in <code className="font-mono text-xs">.claude/skills</code>, and pi
        skills in <code className="font-mono text-xs">~/.pi/agent/skills</code> or <code className="font-mono text-xs">.pi/skills</code>, and pi
        subagents in <code className="font-mono text-xs">~/.pi/agent/agents</code> or <code className="font-mono text-xs">.pi/agents</code>.
      </p>
    </div>
  )
}

function DefinitionDialog({ def, repos, onClose }: { def?: AgentDefinition; repos: AgentsOverview['repos']; onClose: () => void }) {
  const desktop = isDesktop()
  const detail = useModuleQuery<DefinitionDetail>('agents', 'getDefinition', { id: def?.id }, { enabled: desktop && !!def })
  const shown = desktop ? (detail.data?.id === def?.id ? detail.data : undefined) : sampleDetail
  const repoPath = def?.scope === 'project' ? repos.find((r) => r.name === def.repo)?.path : repos[0]?.path

  function useInChat() {
    if (!def) return
    const prompt = def.kind === 'subagent' ? `Use the ${def.name} subagent to ` : `Use the ${def.name} skill to `
    onClose()
    openInChat({ newChat: { repo: repoPath, sdk: def.tool, prompt } })
  }

  return (
    <Dialog open={!!def} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {def && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono">{def.name}</DialogTitle>
              <DialogDescription>
                {KIND_LABEL[def.kind]} for {SOURCE_LABEL[def.tool]} · <span className="font-mono">{def.location}</span>
                {def.repo ? ` in ${def.repo}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              {def.description && <p className="text-sm">{def.description}</p>}
              {(def.model || def.tools) && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {def.model && (
                    <>
                      <dt className="text-muted-foreground">Model</dt>
                      <dd className="font-mono">{def.model}</dd>
                    </>
                  )}
                  {def.tools && (
                    <>
                      <dt className="text-muted-foreground">Tools</dt>
                      <dd className="font-mono">{def.tools.join(', ')}</dd>
                    </>
                  )}
                </dl>
              )}
              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                {desktop && detail.error ? (
                  <span className="text-destructive-soft-foreground">{detail.error.message}</span>
                ) : shown ? (
                  shown.body ? <ChatMarkdown text={shown.body} /> : <span className="text-muted-foreground">No instructions below the header.</span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={useInChat} disabled={!repoPath}>
                <MessageSquarePlus /> Use in a new chat
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AgentsPage
