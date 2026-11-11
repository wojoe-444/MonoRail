import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, CircleSlash, Copy, FolderGit2, FolderOpen, Loader2, Lock, MessageSquarePlus, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, User, Users, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { MOCHI_ROLES, AgentMochi, mochiRoleFor } from '@/components/mochi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { isDesktop } from '@/modules/client'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'
import { openInChat } from '@/modules/agent-chat/handoff'

import { createSubagent, getSubagent, openBackups, removeSubagent, updateSubagent, useCatalog } from './api'
import { EDITOR_TOOLS, MODEL_OPTIONS, NAME_RE, POWER_LABEL, TOOL_LABEL, TOOL_PRESETS, cannotDo, humanName, modelInfo, powerOf, toolInfo } from './explain'
import type { CatalogData, Subagent, SubagentDetail, SubagentDraft, SubagentTool } from './types'

type View = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'edit'; id?: string; copyOf?: string }
type ScopeFilter = 'all' | 'user' | 'project' | 'builtin'
type ToolFilter = 'all' | SubagentTool

function ago(ms: number): string {
  const d = Math.round((Date.now() - ms) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

/** Loads one subagent's full text when the explainer or editor needs it. */
function useDetail(id: string | undefined, version: number) {
  const [state, setState] = useState<{ id?: string; detail?: SubagentDetail; error?: string }>({})
  useEffect(() => {
    if (!id) return
    let live = true
    getSubagent(id).then(
      (detail) => live && setState({ id, detail }),
      (e: unknown) => live && setState({ id, error: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      live = false
    }
  }, [id, version])
  return state.id === id ? state : {}
}

export default function CatalogPage() {
  const catalog = useCatalog()
  const [view, setView] = useState<View>({ kind: 'list' })
  const [version, setVersion] = useState(0)
  const [deleting, setDeleting] = useState<SubagentDetail>()
  const [notice, setNotice] = useState<string>()

  const openId = view.kind === 'detail' ? view.id : view.kind === 'edit' ? (view.id ?? view.copyOf) : undefined
  const { detail, error } = useDetail(openId, version)
  const data = catalog.data

  async function save(tool: SubagentTool, draft: SubagentDraft) {
    const id = view.kind === 'edit' && view.id && detail ? await updateSubagent(detail, draft) : await createSubagent(tool, draft)
    await catalog.refresh()
    setVersion((v) => v + 1)
    setView({ kind: 'detail', id })
  }

  async function confirmDelete() {
    if (!deleting) return
    await removeSubagent(deleting.id)
    setNotice(`${humanName(deleting.name)} was deleted. A copy is kept in MonoRail’s backups.`)
    setDeleting(undefined)
    setView({ kind: 'list' })
    await catalog.refresh()
  }

  const waiting = openId && !detail && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {error ? (
        <>
          <AlertTriangle className="size-4 text-destructive" /> {error}
          <Button variant="link" onClick={() => setView({ kind: 'list' })}>
            Back to the catalog
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="size-4 animate-spin" /> Loading…
        </>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-8">
      {view.kind === 'list' && (
        <CatalogList
          data={data}
          loading={catalog.loading}
          fetching={catalog.fetching}
          error={catalog.error?.message}
          notice={notice}
          onDismiss={() => setNotice(undefined)}
          onRefresh={() => void catalog.refresh()}
          onOpen={(id) => {
            setNotice(undefined)
            setView({ kind: 'detail', id })
          }}
          onNew={() => setView({ kind: 'edit' })}
        />
      )}
      {view.kind !== 'list' && waiting}
      {view.kind === 'detail' && detail && (
        <Explainer
          s={detail}
          data={data}
          onBack={() => setView({ kind: 'list' })}
          onEdit={() => setView({ kind: 'edit', id: detail.id })}
          onCopy={() => setView({ kind: 'edit', copyOf: detail.id })}
          onDelete={() => setDeleting(detail)}
        />
      )}
      {view.kind === 'edit' && (!openId || detail) && (
        <Editor
          key={`${view.id ?? ''}:${view.copyOf ?? ''}`}
          base={detail}
          isCopy={!!view.copyOf}
          repos={data?.repos.map((r) => r.name) ?? []}
          taken={(data?.subagents ?? []).filter((s) => s.id !== view.id && s.scope !== 'builtin').map((s) => `${s.tool}/${s.scope === 'user' ? 'user' : s.repo}/${s.name}`)}
          onCancel={() => setView(detail && !view.copyOf ? { kind: 'detail', id: detail.id } : { kind: 'list' })}
          onSave={save}
        />
      )}
      <DeleteDialog s={deleting} onClose={() => setDeleting(undefined)} onConfirm={confirmDelete} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Catalog list

function CatalogList({
  data,
  loading,
  fetching,
  error,
  notice,
  onDismiss,
  onRefresh,
  onOpen,
  onNew,
}: {
  data?: CatalogData
  loading: boolean
  fetching: boolean
  error?: string
  notice?: string
  onDismiss: () => void
  onRefresh: () => void
  onOpen: (id: string) => void
  onNew: () => void
}) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [tool, setTool] = useState<ToolFilter>('all')
  const items = useMemo(() => data?.subagents ?? [], [data])
  const byTool = useMemo(() => items.filter((s) => tool === 'all' || s.tool === tool), [items, tool])
  const count = (sc: ScopeFilter) => byTool.filter((s) => sc === 'all' || s.scope === sc).length
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return byTool
      .filter((s) => (scope === 'all' || s.scope === scope) && (!needle || `${s.name} ${s.description} ${s.repo ?? ''}`.toLowerCase().includes(needle)))
      .sort((a, b) => (a.scope === 'builtin' ? 1 : 0) - (b.scope === 'builtin' ? 1 : 0) || a.name.localeCompare(b.name))
  }, [byTool, q, scope])
  const hasPi = items.some((s) => s.tool === 'pi')

  return (
    <>
      <PageHeader
        eyebrow="Agents"
        title="Agent Catalog"
        description="Every Claude Code and pi subagent on this computer: yours, your repos', and MonoRail's built-in ones. Open one to see what it does."
        actions={
          <>
            {isDesktop() && (
              <Button variant="outline" onClick={onRefresh} disabled={fetching}>
                <RefreshCw className={cn(fetching && 'animate-spin')} /> Refresh
              </Button>
            )}
            <Button onClick={onNew}>
              <Plus /> New subagent
            </Button>
          </>
        }
      />
      {notice && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-soft-foreground">
          <Check className="size-4" /> <span className="flex-1">{notice}</span>
          {isDesktop() && (
            <Button size="sm" variant="outline" onClick={() => void openBackups()}>
              <FolderOpen /> Open backups folder
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-8" aria-label="Dismiss" onClick={onDismiss}>
            <X />
          </Button>
        </div>
      )}
      {hasPi && data && !data.piExtension && <PiExtensionNote />}
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subagents" aria-label="Search subagents" className="w-64 pl-9" />
          </div>
          <Segmented<ToolFilter>
            aria-label="Agent"
            value={tool}
            onChange={setTool}
            options={[
              { value: 'all', label: 'All agents' },
              { value: 'claude', label: 'Claude Code' },
              { value: 'pi', label: 'pi' },
            ]}
          />
          <Segmented<ScopeFilter>
            aria-label="Where"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: `All ${count('all')}` },
              { value: 'user', label: `Yours ${count('user')}` },
              { value: 'project', label: `In repos ${count('project')}` },
              { value: 'builtin', label: `Built in ${count('builtin')}` },
            ]}
          />
        </CardHeader>
        <CardContent className="px-6 py-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Looking for subagents…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">{items.length === 0 ? 'No subagents yet. Create one with New subagent.' : 'Nothing matches that filter.'}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((s) => (
                <SubagentTile key={s.id} s={s} onOpen={() => onOpen(s.id)} />
              ))}
            </div>
          )}
          {data?.truncated && <p className="mt-4 text-xs text-muted-foreground">Showing the first 300 subagents.</p>}
          <p className="mt-6 text-xs text-muted-foreground">
            Looks in <code className="font-mono">~/.claude/agents</code> and <code className="font-mono">~/.pi/agent/agents</code>, and in{' '}
            <code className="font-mono">.claude/agents</code> and <code className="font-mono">.pi/agents</code> of the repos you allowed on the Chat page.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

function PiExtensionNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        pi has no subagents of its own: its <b>subagent extension</b> runs these files. MonoRail did not find it in pi’s extensions or packages, so pi may not use them yet.
      </span>
    </div>
  )
}

function ScopeBadge({ s }: { s: Subagent }) {
  if (s.scope === 'builtin')
    return (
      <Badge variant="primary">
        <Lock /> Built in
      </Badge>
    )
  if (s.scope === 'user')
    return (
      <Badge variant="secondary">
        <User /> Yours
      </Badge>
    )
  return (
    <Badge variant="secondary">
      <FolderGit2 /> {s.repo}
    </Badge>
  )
}

function SubagentTile({ s, onOpen }: { s: Subagent; onOpen: () => void }) {
  const power = POWER_LABEL[powerOf(s.tools, s.tool)]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full flex-col gap-3 rounded-xl p-4 text-left ring-1 ring-foreground/10 transition-shadow outline-none hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <AgentMochi name={s.name} description={s.description} size={56} className="-my-1 -ml-1" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{humanName(s.name)}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{s.name}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ScopeBadge s={s} />
          <Badge variant="outline">{TOOL_LABEL[s.tool]}</Badge>
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{s.description || 'No description.'}</p>
      <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={power.variant}>{power.label}</Badge>
        {s.problem ? (
          <Badge variant="destructive">
            <AlertTriangle /> Skipped
          </Badge>
        ) : (
          <span className="truncate">{modelInfo(s.model).label}</span>
        )}
        <span className="ml-auto shrink-0">{s.scope === 'builtin' ? 'Ships with MonoRail' : `Edited ${ago(s.updatedAt)}`}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Explainer

function Explainer({ s, data, onBack, onEdit, onCopy, onDelete }: { s: SubagentDetail; data?: CatalogData; onBack: () => void; onEdit: () => void; onCopy: () => void; onDelete: () => void }) {
  const role = mochiRoleFor(s.name, s.description)
  const power = powerOf(s.tools, s.tool)
  const model = modelInfo(s.model)
  const cannot = cannotDo(s.tools, s.tool)
  const builtin = s.scope === 'builtin'
  const pi = s.tool === 'pi'
  const tools = s.tools ? [...new Map(s.tools.map((t) => [toolInfo(t, s.tool).label, toolInfo(t, s.tool)])).values()] : []
  const repoPath = s.scope === 'project' ? data?.repos.find((r) => r.name === s.repo)?.path : data?.repos[0]?.path

  function useInChat() {
    openInChat({ newChat: { repo: repoPath, sdk: s.tool, prompt: pi ? `Use ${s.name} to ` : `Use the ${s.name} subagent to ` } })
  }

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft /> Agent Catalog
        </Button>
      </div>

      {/* Hero */}
      <Card className="py-0">
        <CardContent className="flex flex-wrap items-center gap-6 px-6 py-6">
          <AgentMochi name={s.name} description={s.description} size={112} className="-my-2" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-primary uppercase">
              {MOCHI_ROLES[role].label} · {TOOL_LABEL[s.tool]} subagent
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{humanName(s.name)}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{s.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <ScopeBadge s={s} />
              <Badge variant={POWER_LABEL[power].variant}>{POWER_LABEL[power].label}</Badge>
              <Badge variant="outline">{model.label}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            {!builtin && (
              <Button variant="outline" onClick={useInChat} disabled={!repoPath} title={repoPath ? undefined : 'Allow a repo on the Chat page first'}>
                <MessageSquarePlus /> Use in a new chat
              </Button>
            )}
            {builtin ? (
              <Button onClick={onCopy}>
                <Copy /> Make my own copy
              </Button>
            ) : (
              <Button onClick={onEdit}>
                <Pencil /> Edit
              </Button>
            )}
            {!builtin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onCopy}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {s.problem && (
        <div className="flex items-start gap-3 rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {s.problem} Edit it to fix that.
        </div>
      )}
      {pi && data && !data.piExtension && <PiExtensionNote />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>{pi ? 'When pi uses it' : 'When Claude uses it'}</CardTitle>
              <CardDescription>{pi ? 'pi’s subagent tool reads the description above to pick a subagent' : 'Claude reads the description above and calls this subagent when a task fits'}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6 py-5 text-sm">
              {pi ? (
                <p>
                  In pi {s.scope === 'project' ? <>chats in <b>{s.repo}</b></> : 'chats on this computer'}, the subagent tool can hand a job to <b>{humanName(s.name)}</b>. It runs as a separate pi process with
                  its own fresh context and hands back the result.
                  {s.scope === 'project' && ' Subagents that live in a repo run only after you confirm them, unless pi trusts the repo.'}
                </p>
              ) : (
                <p>
                  In any Claude Code chat {s.scope === 'project' ? <>in <b>{s.repo}</b></> : s.scope === 'builtin' ? 'started from MonoRail’s Coordinator' : 'on this computer'}, Claude can hand a job to{' '}
                  <b>{humanName(s.name)}</b> on its own when the job matches. It works in its own fresh context and hands back a summary, so the main chat stays short.
                </p>
              )}
              <p className="text-muted-foreground">{pi ? 'Ask for it by name:' : 'You can also ask for it by name:'}</p>
              <div className="rounded-lg bg-muted/60 px-4 py-3 font-mono text-xs">{pi ? `Use ${s.name} to …` : `Use the ${s.name} subagent to …`}</div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>What it can do</CardTitle>
              <CardDescription>{POWER_LABEL[power].detail}</CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              {s.tools ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {tools.map((t) => (
                    <div key={t.label} className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-lg',
                          t.power === 'read' ? 'bg-success-soft text-success-soft-foreground' : t.power === 'write' ? 'bg-info-soft text-info-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground',
                        )}
                      >
                        <t.icon className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : pi ? (
                <p className="text-sm">
                  This subagent has no tool list, so it gets <b>pi’s default tools</b>: read, edit, write and bash, which runs commands. Give it a tool list in Edit to limit it.
                </p>
              ) : (
                <p className="text-sm">
                  This subagent has no tool list, so it can use <b>every tool</b> the chat that calls it has, including running commands. Give it a tool list in Edit to limit it.
                </p>
              )}
              {cannot.length > 0 && (
                <div className="mt-5 border-t pt-4">
                  <div className="mb-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">It cannot</div>
                  <div className="flex flex-wrap gap-2">
                    {cannot.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                        <CircleSlash className="size-3.5 text-muted-foreground" /> {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Its instructions</CardTitle>
              <CardDescription>What it is told every time it starts, written by {builtin ? 'MonoRail' : 'you'}</CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5 text-sm">
              {s.prompt.trim() ? <ChatMarkdown text={s.prompt} /> : <span className="text-muted-foreground">No instructions below the header.</span>}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-2">
              <dl className="divide-y text-sm">
                <Fact label="Runs in" value={TOOL_LABEL[s.tool]} hint={pi ? 'Through pi’s subagent extension.' : undefined} />
                <Fact label="Model" value={model.label} hint={pi && !s.model ? 'Uses the model pi is set to.' : model.detail} />
                <Fact
                  label="Who gets it"
                  value={s.scope === 'user' ? 'Only you, in every repo' : s.scope === 'project' ? `Everyone working in ${s.repo}` : 'MonoRail’s Coordinator'}
                  hint={s.scope === 'project' ? 'It lives in the repo, so it is shared when the repo is pushed.' : s.scope === 'user' ? 'It lives in your home folder.' : 'Used only when you have no coordinator of your own.'}
                  icon={s.scope === 'project' ? Users : User}
                />
                <Fact label="Where it lives" value={<span className="font-mono text-xs">{s.location}</span>} />
                <Fact label="Last edited" value={builtin ? 'Ships with MonoRail' : ago(s.updatedAt)} />
                {s.extraFields.length > 0 && <Fact label="Other settings in the file" value={<span className="font-mono text-xs">{s.extraFields.join(', ')}</span>} hint="Kept as they are when you edit here." />}
              </dl>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Its character</CardTitle>
              <CardDescription>Picked from its name, so you can spot it in a chat</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4 px-6 py-5">
              <AgentMochi name={s.name} description={s.description} size={64} />
              <div className="text-sm">
                <div className="font-medium">{MOCHI_ROLES[role].label}</div>
                <div className="text-muted-foreground">{MOCHI_ROLES[role].story}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Fact({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon?: typeof User }) {
  return (
    <div className="py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor

function presetOf(tool: SubagentTool, tools: string[] | null): string {
  const key = (t: string[] | null) => (t ? [...t].sort().join(',') : '*')
  return TOOL_PRESETS[tool].find((p) => key(p.tools) === key(tools))?.id ?? 'custom'
}

function Editor({
  base,
  isCopy,
  repos,
  taken,
  onCancel,
  onSave,
}: {
  base?: SubagentDetail
  isCopy: boolean
  repos: string[]
  taken: string[]
  onCancel: () => void
  onSave: (tool: SubagentTool, d: SubagentDraft) => Promise<void>
}) {
  const builtinCopy = isCopy && base?.scope === 'builtin'
  const [tool, setTool] = useState<SubagentTool>(base?.tool ?? 'claude')
  const [draft, setDraft] = useState<SubagentDraft>(() => ({
    name: base ? (isCopy && !builtinCopy ? `${base.name}-copy` : base.name) : '',
    description: base?.description ?? '',
    model: base?.model ?? (tool === 'claude' ? 'inherit' : ''),
    tools: base ? (base.tools ?? null) : TOOL_PRESETS.claude[0].tools,
    prompt: base?.prompt ?? '',
    saveTo: base?.scope === 'project' && base.repo && repos.includes(base.repo) ? base.repo : 'user',
  }))
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const set = (patch: Partial<SubagentDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const preset = presetOf(tool, draft.tools)
  const editing = !!base && !isCopy
  const nameError = !draft.name ? undefined : !NAME_RE.test(draft.name) ? 'Use lowercase letters, numbers and hyphens, starting with a letter.' : !editing && taken.includes(`${tool}/${draft.saveTo}/${draft.name}`) ? 'There is already a subagent with this name there.' : undefined
  const ok = !!draft.name && !nameError && draft.description.trim().length > 0 && draft.prompt.trim().length > 0 && (draft.tools === null || draft.tools.length > 0)
  const piDir = (where: string) => (where === 'user' ? '~/.pi/agent/agents' : '.pi/agents')
  const claudeDir = (where: string) => (where === 'user' ? '~/.claude/agents' : '.claude/agents')
  const dir = (where: string) => (tool === 'pi' ? piDir(where) : claudeDir(where))
  const modelChoices = draft.model && !MODEL_OPTIONS.some((m) => m.id === draft.model) ? [...MODEL_OPTIONS, { id: draft.model, label: draft.model, detail: 'A specific model id.' }] : MODEL_OPTIONS

  function switchTool(next: SubagentTool) {
    setTool(next)
    set({ tools: TOOL_PRESETS[next][0].tools, model: next === 'claude' ? 'inherit' : '' })
  }

  function toggleTool(t: string) {
    const cur = draft.tools ?? [...EDITOR_TOOLS[tool]]
    set({ tools: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] })
  }

  async function submit() {
    setBusy(true)
    setSaveError(undefined)
    try {
      await onSave(tool, draft)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
      setBusy(false)
    }
  }

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onCancel}>
          <ArrowLeft /> {base && !builtinCopy ? humanName(base.name) : 'Agent Catalog'}
        </Button>
      </div>
      <PageHeader
        eyebrow="Agent Catalog"
        title={editing ? `Edit ${humanName(base.name)}` : builtinCopy ? 'Your own coordinator' : isCopy && base ? `Copy of ${humanName(base.name)}` : 'New subagent'}
        description={
          builtinCopy
            ? 'Saved as ~/.claude/agents/coordinator.md. Once it exists, the Coordinator uses yours instead of the built-in one.'
            : 'Saved as a Markdown file the agent reads. Before an existing file is changed or deleted, MonoRail keeps a backup copy in its data folder.'
        }
        actions={
          <>
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button disabled={!ok || busy} onClick={() => void submit()}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />} {editing ? 'Save changes' : 'Create subagent'}
            </Button>
          </>
        }
      />
      {saveError && (
        <div className="flex items-start gap-3 rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {saveError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-6 py-5">
              {!editing && !builtinCopy && (
                <div className="flex flex-col gap-2">
                  <Label>Runs in</Label>
                  <Segmented<SubagentTool>
                    aria-label="Runs in"
                    value={tool}
                    onChange={switchTool}
                    options={[
                      { value: 'claude', label: 'Claude Code' },
                      { value: 'pi', label: 'pi' },
                    ]}
                  />
                  {tool === 'pi' && <p className="text-xs text-muted-foreground">pi runs subagents through its subagent extension.</p>}
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sa-name">Name</Label>
                  <Input id="sa-name" value={draft.name} onChange={(e) => set({ name: e.target.value.toLowerCase() })} placeholder="code-reviewer" className="font-mono" disabled={editing || builtinCopy} />
                  <p className={cn('text-xs', nameError ? 'text-destructive' : 'text-muted-foreground')}>{nameError ?? (editing ? 'Duplicate it to use another name.' : 'Lowercase, with hyphens. Also the file name.')}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sa-where">Save to</Label>
                  <NativeSelect id="sa-where" value={draft.saveTo} onChange={(e) => set({ saveTo: e.target.value })} disabled={editing || builtinCopy}>
                    <option value="user">Just me, every repo ({dir('user')})</option>
                    {repos.map((r) => (
                      <option key={r} value={r}>
                        Repo {r} ({dir(r)})
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-xs text-muted-foreground">A repo’s subagents are shared with everyone who works in it.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-desc">{tool === 'pi' ? 'When should pi use it?' : 'When should Claude use it?'}</Label>
                <Textarea id="sa-desc" rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Reviews a diff for bugs before a PR goes up. Use it after finishing a change." />
                <p className="text-xs text-muted-foreground">The agent reads this to decide when to call it. Say what it does and when.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Instructions</CardTitle>
              <CardDescription>What it is told every time it starts. Markdown.</CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <Textarea rows={14} value={draft.prompt} onChange={(e) => set({ prompt: e.target.value })} className="font-mono text-xs" placeholder={'You are a careful code reviewer.\n\n1. Read the diff.\n2. List bugs, most severe first.'} />
              {base && base.extraFields.length > 0 && !isCopy && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Other settings in the file are kept as they are: <span className="font-mono">{base.extraFields.join(', ')}</span>.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>What it may do</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-6 py-5">
              {TOOL_PRESETS[tool].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set({ tools: p.tools })}
                  className={cn('rounded-lg px-3 py-2.5 text-left ring-1 transition-colors', preset === p.id ? 'bg-primary-soft ring-primary/40' : 'ring-foreground/10 hover:bg-accent')}
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.detail}</div>
                </button>
              ))}
              <div className={cn('mt-2 rounded-lg px-3 py-2.5 ring-1', preset === 'custom' ? 'bg-primary-soft ring-primary/40' : 'ring-foreground/10')}>
                <div className="mb-2 text-sm font-medium">Pick tools</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {EDITOR_TOOLS[tool].map((t) => {
                    const info = toolInfo(t, tool)
                    const on = draft.tools === null ? tool === 'claude' || ['read', 'edit', 'write', 'bash'].includes(t) : draft.tools.includes(t)
                    return (
                      <label key={t} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={on} onChange={() => toggleTool(t)} className="accent-[var(--primary)]" />
                        <info.icon className="size-3.5 text-muted-foreground" /> {info.label}
                      </label>
                    )
                  })}
                </div>
                {draft.tools?.some((t) => !EDITOR_TOOLS[tool].includes(t)) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Also kept: <span className="font-mono">{draft.tools.filter((t) => !EDITOR_TOOLS[tool].includes(t)).join(', ')}</span>
                  </p>
                )}
                {draft.tools?.length === 0 && <p className="mt-2 text-xs text-destructive">Pick at least one tool.</p>}
              </div>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Model</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-6 py-5">
              {tool === 'claude' ? (
                <>
                  <NativeSelect value={draft.model || 'inherit'} onChange={(e) => set({ model: e.target.value })}>
                    {modelChoices.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-xs text-muted-foreground">{modelInfo(draft.model).detail}</p>
                </>
              ) : (
                <>
                  <Input value={draft.model} onChange={(e) => set({ model: e.target.value.trim() })} placeholder="Same as pi" className="font-mono" aria-label="Model id" />
                  <p className="text-xs text-muted-foreground">A pi model id such as claude-haiku-5-5, or leave it empty to use pi’s current model.</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="flex items-center gap-4 px-6 py-5">
              {draft.name ? (
                <AgentMochi name={draft.name} description={draft.description} size={64} />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Sparkles className="size-6" />
                </div>
              )}
              <div className="text-sm">
                <div className="font-medium">{draft.name ? MOCHI_ROLES[mochiRoleFor(draft.name, draft.description)].label : 'Its character'}</div>
                <div className="text-xs text-muted-foreground">Picked from the name and description as you type.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Delete

function DeleteDialog({ s, onClose, onConfirm }: { s?: SubagentDetail; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  async function run() {
    setBusy(true)
    setError(undefined)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {s && (
          <>
            <DialogHeader>
              <DialogTitle>Delete {humanName(s.name)}?</DialogTitle>
              <DialogDescription>
                {TOOL_LABEL[s.tool]} will stop using it. The file <span className="font-mono">{s.location}</span>
                {s.repo ? ` in ${s.repo}` : ''} is removed, and a copy is kept in MonoRail’s backups so you can bring it back.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void run()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
