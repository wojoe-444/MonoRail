import { useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { MOCHI_ROLES, AgentMochi, mochiRoleFor } from '@/components/mochi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { EDITOR_TOOLS, MODEL_OPTIONS, NAME_RE, TOOL_PRESETS, humanName, modelInfo, toolInfo } from './explain'
import type { SubagentDetail, SubagentDraft, SubagentTool } from './types'

function presetOf(tool: SubagentTool, tools: string[] | null): string {
  const key = (t: string[] | null) => (t ? [...t].sort().join(',') : '*')
  return TOOL_PRESETS[tool].find((p) => key(p.tools) === key(tools))?.id ?? 'custom'
}

export function SubagentEditor({
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
  const editingBuiltin = !isCopy && base?.scope === 'builtin'
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
          <ArrowLeft /> {base && !builtinCopy ? humanName(base.name) : 'Template Catalog'}
        </Button>
      </div>
      <PageHeader
        eyebrow="Template Catalog"
        title={editing ? `Edit ${humanName(base.name)}` : builtinCopy ? (base.name === 'coordinator' ? 'Your own coordinator' : `Add ${humanName(base.name)} to Claude Code`) : isCopy && base ? `Copy of ${humanName(base.name)}` : 'New template'}
        description={
          builtinCopy
            ? base.name === 'coordinator'
              ? 'Saved as ~/.claude/agents/coordinator.md. Once it exists, the Coordinator uses yours instead of the built-in one.'
              : `Saved as ~/.claude/agents/${base.name}.md, where it is yours: change anything before saving, or later.`
            : editingBuiltin ? 'Changes are saved in your MonoRail profile. You can restore the shipped default at any time.' : 'Saved as a Markdown file the agent reads. Before an existing file is changed or deleted, MonoRail keeps a backup copy in its data folder.'
        }
        actions={
          <>
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button disabled={!ok || busy} onClick={() => void submit()}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />} {editing ? 'Save changes' : builtinCopy ? 'Add template' : 'Create template'}
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
                  <p className="text-xs text-muted-foreground">This creates a subagent definition. It does not automatically run when a pull request is opened. OpenAI Agents SDK subagents are not supported here yet.</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sa-name">Name</Label>
                  <Input id="sa-name" value={draft.name} onChange={(e) => set({ name: e.target.value.toLowerCase() })} placeholder="code-reviewer" className="font-mono" disabled={editing || builtinCopy} />
                  <p className={cn('text-xs', nameError ? 'text-destructive' : 'text-muted-foreground')}>{nameError ?? (editingBuiltin ? 'The built-in template name stays the same.' : editing ? 'Duplicate it to use another name.' : 'Lowercase, with hyphens. Also the file name.')}</p>
                </div>
                {!editingBuiltin && <div className="flex flex-col gap-2">
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
                </div>}
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
              {editingBuiltin && base?.name === 'coordinator' && <CardDescription>MonoRail limits the Coordinator to its delegation and chat tools, even if other tools are listed here.</CardDescription>}
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
