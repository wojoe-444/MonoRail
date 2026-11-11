import { useEffect, useState } from 'react'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { invokeModule, isDesktop } from '@/modules/client'

import { sampleSystemPrompts } from './sample'
import type { PromptAgent, PromptMode, SystemPrompts } from './types'

const MAX_PROMPT = 20_000

const AGENTS: { value: PromptAgent; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'pi', label: 'pi' },
  { value: 'coordinator', label: 'Coordinator' },
]

const PLACEHOLDER: Record<PromptAgent, string> = {
  claude: 'For example: Answer in British English. Run the tests before you say a change is done.',
  pi: 'For example: Keep answers short and show file paths in full.',
  coordinator: 'For example: Prefer my MonoRail repo when a task could go to more than one chat.',
}

/**
 * The user's own system prompt per agent. Saved in the module's data folder
 * (system-prompts.json) and added to every turn of that agent by the backend,
 * so turns the coordinator starts get them too.
 */
export function SystemPromptsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const desktop = isDesktop()
  const [saved, setSaved] = useState<SystemPrompts | undefined>(desktop ? undefined : sampleSystemPrompts)
  const [draft, setDraft] = useState<SystemPrompts | undefined>(desktop ? undefined : sampleSystemPrompts)
  const [agent, setAgent] = useState<PromptAgent>('claude')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open || !desktop) return
    let live = true
    invokeModule<SystemPrompts>('agent-chat', 'getSystemPrompts').then(
      (p) => {
        if (!live) return
        setError(undefined)
        setSaved(p)
        setDraft(p)
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [open, desktop])

  const entry = draft?.[agent]
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved)
  const tooLong = !!draft && Object.values(draft).some((p) => p.text.length > MAX_PROMPT)

  function update(patch: Partial<{ mode: PromptMode; text: string }>) {
    setDraft((d) => (d ? { ...d, [agent]: { ...d[agent], ...patch } } : d))
  }

  async function save() {
    if (!draft) return
    if (!desktop) {
      setSaved(draft)
      onOpenChange(false)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const next = await invokeModule<SystemPrompts>('agent-chat', 'setSystemPrompts', { prompts: draft })
      setSaved(next)
      setDraft(next)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>System prompts</DialogTitle>
          <DialogDescription>
            Your own instructions for each agent, sent with every message to it. They never change what an agent is
            allowed to do: Ask, Agent and the allowed folders still apply.
          </DialogDescription>
        </DialogHeader>

        {!draft && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}

        {draft && entry && (
          <div className="flex flex-col gap-4">
            <Segmented
              aria-label="Agent"
              value={agent}
              onChange={setAgent}
              options={AGENTS.map((a) => ({ ...a, label: draft[a.value].text.trim() ? `${a.label} •` : a.label }))}
              className="self-start"
            />

            <div className="flex flex-col gap-2">
              <Label>How it is used</Label>
              {agent === 'coordinator' ? (
                <p className="text-sm text-muted-foreground">
                  Added after your coordinator subagent&apos;s own instructions. To change those, edit{' '}
                  <span className="font-mono text-xs">~/.claude/agents/coordinator.md</span>.
                </p>
              ) : (
                <Segmented
                  aria-label="How the prompt is used"
                  value={entry.mode}
                  onChange={(mode) => update({ mode })}
                  options={[
                    { value: 'append', label: 'Add to the built-in prompt' },
                    { value: 'replace', label: 'Replace it' },
                  ]}
                  className="self-start"
                />
              )}
            </div>

            {agent === 'claude' && entry.mode === 'replace' && (
              <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Replacing drops Claude Code&apos;s built-in instructions on how to use its tools, stay safe in your
                  repo and format answers. Claude may use tools badly or ignore CLAUDE.md conventions. Adding is safer
                  unless you mean to start from scratch.
                </span>
              </div>
            )}
            {agent === 'pi' && entry.mode === 'replace' && (
              <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Replacing swaps pi&apos;s opening instructions for yours. pi still lists its tools and reads AGENTS.md,
                  but its own guidance on working in a repo is gone.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="system-prompt-text">Prompt</Label>
                <span className={entry.text.length > MAX_PROMPT ? 'text-xs text-destructive' : 'text-xs text-muted-foreground tabular-nums'}>
                  {entry.text.length.toLocaleString()} / {MAX_PROMPT.toLocaleString()}
                </span>
              </div>
              <Textarea
                id="system-prompt-text"
                className="min-h-48 font-mono text-xs"
                value={entry.text}
                placeholder={PLACEHOLDER[agent]}
                onChange={(e) => update({ text: e.target.value })}
              />
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {agent === 'pi'
                ? 'Used from the next message on, in new and continued chats. Leave it empty to use pi as it is.'
                : 'Used from the next new chat. A chat that already started may keep the prompt it began with. Leave it empty to use Claude Code as it is.'}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!dirty || tooLong || busy}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
