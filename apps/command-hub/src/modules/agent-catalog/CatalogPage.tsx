import { useMemo, useState } from 'react'
import { ArrowLeft, Check, CircleSlash, Copy, FolderGit2, Lock, MessageSquarePlus, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, User, Users } from 'lucide-react'

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
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'

import { EDITOR_TOOLS, MODEL_OPTIONS, NAME_RE, POWER_LABEL, TOOL_PRESETS, cannotDo, humanName, modelInfo, powerOf, toolInfo } from './explain'
import { sampleDetails } from './sample'
import type { SubagentDetail, SubagentDraft } from './types'

type View = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'edit'; id?: string; copyOf?: string }
type ScopeFilter = 'all' | 'user' | 'project' | 'builtin'

const REPOS = ['demo-app', 'garden-planner', 'notes']

function ago(ms: number): string {
  const d = Math.round((Date.now() - ms) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

export default function CatalogPage() {
  // Prototype: fictional subagents, kept in memory.
  const [items, setItems] = useState<SubagentDetail[]>(() => sampleDetails())
  const [view, setView] = useState<View>({ kind: 'list' })
  const [deleting, setDeleting] = useState<SubagentDetail>()

  const current = view.kind !== 'list' ? items.find((s) => s.id === (view.kind === 'edit' ? (view.id ?? view.copyOf) : view.id)) : undefined

  function save(draft: SubagentDraft, id?: string) {
    const next: SubagentDetail = {
      id: id ?? `sub_${Date.now()}`,
      scope: draft.saveTo === 'user' ? 'user' : 'project',
      repo: draft.saveTo === 'user' ? undefined : draft.saveTo,
      name: draft.name,
      description: draft.description,
      model: draft.model,
      tools: draft.tools ?? undefined,
      prompt: draft.prompt,
      location: draft.saveTo === 'user' ? `~/.claude/agents/${draft.name}.md` : `.claude/agents/${draft.name}.md`,
      updatedAt: Date.now(),
    }
    setItems((all) => (id ? all.map((s) => (s.id === id ? next : s)) : [...all, next]))
    setView({ kind: 'detail', id: next.id })
  }

  return (
    <div className="flex flex-col gap-8">
      {view.kind === 'list' && <CatalogList items={items} onOpen={(id) => setView({ kind: 'detail', id })} onNew={() => setView({ kind: 'edit' })} />}
      {view.kind === 'detail' && current && (
        <Explainer
          s={current}
          onBack={() => setView({ kind: 'list' })}
          onEdit={() => setView({ kind: 'edit', id: current.id })}
          onCopy={() => setView({ kind: 'edit', copyOf: current.id })}
          onDelete={() => setDeleting(current)}
        />
      )}
      {view.kind === 'edit' && (
        <Editor
          base={current}
          isCopy={!!view.copyOf}
          taken={items.filter((s) => s.id !== view.id).map((s) => `${s.scope === 'user' ? 'user' : s.repo}/${s.name}`)}
          onCancel={() => setView(current && !view.copyOf ? { kind: 'detail', id: current.id } : { kind: 'list' })}
          onSave={(d) => save(d, view.copyOf ? undefined : view.id)}
        />
      )}
      <DeleteDialog
        s={deleting}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          setItems((all) => all.filter((s) => s.id !== deleting?.id))
          setDeleting(undefined)
          setView({ kind: 'list' })
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Catalog list

function CatalogList({ items, onOpen, onNew }: { items: SubagentDetail[]; onOpen: (id: string) => void; onNew: () => void }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<ScopeFilter>('all')
  const counts = useMemo(
    () => ({
      all: items.length,
      user: items.filter((s) => s.scope === 'user').length,
      project: items.filter((s) => s.scope === 'project').length,
      builtin: items.filter((s) => s.scope === 'builtin').length,
    }),
    [items],
  )
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items
      .filter((s) => (scope === 'all' || s.scope === scope) && (!needle || `${s.name} ${s.description} ${s.repo ?? ''}`.toLowerCase().includes(needle)))
      .sort((a, b) => (a.scope === 'builtin' ? 1 : 0) - (b.scope === 'builtin' ? 1 : 0) || a.name.localeCompare(b.name))
  }, [items, q, scope])

  return (
    <>
      <PageHeader
        eyebrow="Agents"
        title="Agent Catalog"
        description="Every Claude Code subagent on this computer: yours, your repos', and MonoRail's built-in ones. Open one to see what it does."
        actions={
          <Button onClick={onNew}>
            <Plus /> New subagent
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subagents" aria-label="Search subagents" className="w-64 pl-9" />
          </div>
          <Segmented<ScopeFilter>
            aria-label="Where"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: `All ${counts.all}` },
              { value: 'user', label: `Yours ${counts.user}` },
              { value: 'project', label: `In repos ${counts.project}` },
              { value: 'builtin', label: `Built in ${counts.builtin}` },
            ]}
          />
        </CardHeader>
        <CardContent className="px-6 py-6">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches that filter.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((s) => (
                <SubagentTile key={s.id} s={s} onOpen={() => onOpen(s.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function ScopeBadge({ s }: { s: SubagentDetail }) {
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

function SubagentTile({ s, onOpen }: { s: SubagentDetail; onOpen: () => void }) {
  const power = POWER_LABEL[powerOf(s.tools)]
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
        <ScopeBadge s={s} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{s.description || 'No description.'}</p>
      <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={power.variant}>{power.label}</Badge>
        <span>{modelInfo(s.model).label}</span>
        <span className="ml-auto">{s.scope === 'builtin' ? 'Ships with MonoRail' : `Edited ${ago(s.updatedAt)}`}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Explainer

function Explainer({ s, onBack, onEdit, onCopy, onDelete }: { s: SubagentDetail; onBack: () => void; onEdit: () => void; onCopy: () => void; onDelete: () => void }) {
  const role = mochiRoleFor(s.name, s.description)
  const power = powerOf(s.tools)
  const model = modelInfo(s.model)
  const cannot = cannotDo(s.tools)
  const builtin = s.scope === 'builtin'
  const tools = s.tools ? [...new Map(s.tools.map((t) => [toolInfo(t).label, toolInfo(t)])).values()] : []

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
              {MOCHI_ROLES[role].label} · Subagent
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
            <Button variant="outline">
              <MessageSquarePlus /> Use in a new chat
            </Button>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>When Claude uses it</CardTitle>
              <CardDescription>Claude reads the description above and calls this subagent when a task fits</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6 py-5 text-sm">
              <p>
                In any Claude Code chat {s.scope === 'project' ? <>in <b>{s.repo}</b></> : s.scope === 'builtin' ? 'started from MonoRail’s Coordinator' : 'on this computer'}, Claude can hand a job to{' '}
                <b>{humanName(s.name)}</b> on its own when the job matches. It works in its own fresh context and hands back a summary, so the main chat stays short.
              </p>
              <p className="text-muted-foreground">You can also ask for it by name:</p>
              <div className="rounded-lg bg-muted/60 px-4 py-3 font-mono text-xs">Use the {s.name} subagent to …</div>
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
              <ChatMarkdown text={s.prompt} />
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
                <Fact label="Model" value={model.label} hint={model.detail} />
                <Fact
                  label="Who gets it"
                  value={s.scope === 'user' ? 'Only you, in every repo' : s.scope === 'project' ? `Everyone working in ${s.repo}` : 'MonoRail’s Coordinator'}
                  hint={s.scope === 'project' ? 'It lives in the repo, so it is shared when the repo is pushed.' : s.scope === 'user' ? 'It lives in your home folder.' : 'Used only when you have no coordinator of your own.'}
                  icon={s.scope === 'project' ? Users : User}
                />
                <Fact label="Where it lives" value={<span className="font-mono text-xs">{s.location}</span>} />
                <Fact label="Last edited" value={builtin ? 'Ships with MonoRail' : ago(s.updatedAt)} />
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

function presetOf(tools: string[] | null): string {
  const key = (t: string[] | null) => (t ? [...t].sort().join(',') : '*')
  return TOOL_PRESETS.find((p) => key(p.tools) === key(tools))?.id ?? 'custom'
}

function Editor({ base, isCopy, taken, onCancel, onSave }: { base?: SubagentDetail; isCopy: boolean; taken: string[]; onCancel: () => void; onSave: (d: SubagentDraft) => void }) {
  const [draft, setDraft] = useState<SubagentDraft>(() => ({
    name: base ? (isCopy ? `${base.name}-copy` : base.name) : '',
    description: base?.description ?? '',
    model: base?.model ?? 'inherit',
    tools: base ? (base.tools ?? null) : ['Read', 'Grep', 'Glob'],
    prompt: base?.prompt ?? '',
    saveTo: base?.scope === 'project' && base.repo ? base.repo : 'user',
  }))
  const set = (patch: Partial<SubagentDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const preset = presetOf(draft.tools)
  const nameError = !draft.name ? undefined : !NAME_RE.test(draft.name) ? 'Use lowercase letters, numbers and hyphens, starting with a letter.' : taken.includes(`${draft.saveTo}/${draft.name}`) ? 'There is already a subagent with this name there.' : undefined
  const ok = !!draft.name && !nameError && draft.description.trim().length > 0 && draft.prompt.trim().length > 0
  const editing = base && !isCopy

  function toggleTool(t: string) {
    const cur = draft.tools ?? [...EDITOR_TOOLS]
    set({ tools: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] })
  }

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onCancel}>
          <ArrowLeft /> {editing ? humanName(base.name) : 'Agent Catalog'}
        </Button>
      </div>
      <PageHeader
        eyebrow="Agent Catalog"
        title={editing ? `Edit ${humanName(base.name)}` : isCopy ? `Copy of ${humanName(base!.name)}` : 'New subagent'}
        description="Saved as a Markdown file Claude Code reads. Before an existing file is changed or deleted, MonoRail keeps a backup copy in its data folder."
        actions={
          <>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={!ok} onClick={() => onSave(draft)}>
              <Check /> {editing ? 'Save changes' : 'Create subagent'}
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-6 py-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sa-name">Name</Label>
                  <Input id="sa-name" value={draft.name} onChange={(e) => set({ name: e.target.value.toLowerCase() })} placeholder="code-reviewer" className="font-mono" disabled={!!editing} />
                  <p className={cn('text-xs', nameError ? 'text-destructive' : 'text-muted-foreground')}>{nameError ?? (editing ? 'Duplicate it to use another name.' : 'Lowercase, with hyphens. Also the file name.')}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sa-where">Save to</Label>
                  <NativeSelect id="sa-where" value={draft.saveTo} onChange={(e) => set({ saveTo: e.target.value })} disabled={!!editing}>
                    <option value="user">Just me, every repo (~/.claude/agents)</option>
                    {REPOS.map((r) => (
                      <option key={r} value={r}>
                        Repo {r} (.claude/agents)
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-xs text-muted-foreground">A repo’s subagents are shared with everyone who works in it.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-desc">When should Claude use it?</Label>
                <Textarea id="sa-desc" rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Reviews a diff for bugs before a PR goes up. Use it after finishing a change." />
                <p className="text-xs text-muted-foreground">Claude reads this to decide when to call it. Say what it does and when.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Instructions</CardTitle>
              <CardDescription>What it is told every time it starts. Markdown.</CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <Textarea rows={12} value={draft.prompt} onChange={(e) => set({ prompt: e.target.value })} className="font-mono text-xs" placeholder={'You are a careful code reviewer.\n\n1. Read the diff.\n2. List bugs, most severe first.'} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>What it may do</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-6 py-5">
              {TOOL_PRESETS.map((p) => (
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
                  {EDITOR_TOOLS.map((t) => {
                    const info = toolInfo(t)
                    const on = draft.tools === null || draft.tools.includes(t)
                    return (
                      <label key={t} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={on} onChange={() => toggleTool(t)} className="accent-[var(--primary)]" />
                        <info.icon className="size-3.5 text-muted-foreground" /> {info.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Model</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-6 py-5">
              <NativeSelect value={draft.model} onChange={(e) => set({ model: e.target.value })}>
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">{modelInfo(draft.model).detail}</p>
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

function DeleteDialog({ s, onClose, onConfirm }: { s?: SubagentDetail; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {s && (
          <>
            <DialogHeader>
              <DialogTitle>Delete {humanName(s.name)}?</DialogTitle>
              <DialogDescription>
                Claude Code will stop using it. The file <span className="font-mono">{s.location}</span>
                {s.repo ? ` in ${s.repo}` : ''} is removed, and a copy is kept in MonoRail’s backups so you can bring it back.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onConfirm}>
                <Trash2 /> Delete
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
