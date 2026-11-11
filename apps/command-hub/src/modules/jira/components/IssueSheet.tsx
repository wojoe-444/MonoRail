import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ExternalLink, GitCommitHorizontal, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { errorText, jiraApi } from '../api'
import type { Issue, IssueDetail, IssueFields, Source } from '../types'
import { PersonAvatar, PriorityIcon, ProjectAvatar, SectionLabel, StatusBadge, TypeIcon } from './bits'

interface IssueSheetProps {
  target?: { source: Source; key: string }
  projectName?: string
  priorities: string[]
  onClose: () => void
  /** Called after any change so lists can refresh. */
  onChanged: (issue?: Issue) => void
}

/** Ticket detail, docked right: edit fields, move status, comment, see history. */
export function IssueSheet({ target, projectName, priorities, onClose, onChanged }: IssueSheetProps) {
  const [issue, setIssue] = useState<IssueDetail>()
  const [types, setTypes] = useState<string[]>([])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()

  useEffect(() => {
    if (!target) return
    let live = true
    setIssue(undefined)
    setError(undefined)
    jiraApi()
      .getIssue(target)
      .then((i) => {
        if (!live) return
        setIssue(i)
        jiraApi()
          .getIssueTypes({ source: i.source, projectKey: i.projectKey })
          .then((t) => live && setTypes(t), () => live && setTypes([i.type]))
      })
      .catch((e) => live && setError(errorText(e)))
    return () => {
      live = false
    }
  }, [target])

  async function run(label: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (!issue) return false
    setBusy(label)
    setError(undefined)
    try {
      await fn()
      const fresh = await jiraApi().getIssue({ source: issue.source, key: issue.key })
      setIssue(fresh)
      onChanged(fresh)
      return true
    } catch (e) {
      setError(errorText(e))
      return false
    } finally {
      setBusy(undefined)
    }
  }

  const update = (fields: IssueFields) =>
    issue && run('update', () => jiraApi().updateIssue({ source: issue.source, key: issue.key, fields }))

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="overflow-y-auto">
        <DialogTitle className="sr-only">{issue ? `${issue.key} ${issue.summary}` : 'Ticket'}</DialogTitle>
        <DialogDescription className="sr-only">Ticket details</DialogDescription>

        {/* Header: breadcrumb + actions (64px, like the app bar) */}
        <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-popover px-6 pr-14">
          {target && <ProjectAvatar projectKey={target.key.split('-')[0]} size="sm" />}
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">{issue?.projectName ?? projectName ?? target?.key.split('-')[0]}</span>
            <span>/</span>
            {issue && <TypeIcon type={issue.type} />}
            <span className="font-medium text-foreground">{target?.key}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {issue?.url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={issue.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open in Jira
                </a>
              </Button>
            )}
            {issue?.source === 'local' && <DeleteButton issue={issue} onDeleted={() => { onChanged(); onClose() }} onError={setError} />}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {!issue && !error && (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading ticket…
          </div>
        )}

        {issue && (
          <div className="grid grid-cols-1 gap-8 p-6 md:grid-cols-[1fr_220px]">
            <div className="flex min-w-0 flex-col gap-6">
              <SummaryEditor value={issue.summary} disabled={!!busy} onSave={(summary) => update({ summary })} />
              <DescriptionEditor
                value={issue.description}
                disabled={!!busy}
                onSave={(description) => update({ description })}
              />
              <Separator />
              <Comments issue={issue} busy={busy === 'comment'} onAdd={(body) => run('comment', () => jiraApi().addComment({ source: issue.source, key: issue.key, body }))} />
              {issue.source === 'local' && issue.history.length > 0 && <History issue={issue} />}
            </div>

            <aside className="flex flex-col gap-4">
              <StatusMenu issue={issue} disabled={!!busy} onPick={(transitionId) => run('status', () => jiraApi().transitionIssue({ source: issue.source, key: issue.key, transitionId }))} />
              <div className="flex flex-col gap-4 rounded-xl border p-4">
                <Field label="Type">
                  <NativeSelect value={issue.type} disabled={!!busy} onChange={(e) => update({ type: e.target.value })}>
                    {(types.includes(issue.type) ? types : [issue.type, ...types]).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Priority">
                  <div className="flex items-center gap-2">
                    <PriorityIcon priority={issue.priority} />
                    <NativeSelect
                      className="flex-1"
                      value={issue.priority}
                      disabled={!!busy}
                      onChange={(e) => update({ priority: e.target.value })}
                    >
                      {(priorities.includes(issue.priority) ? priorities : [issue.priority, ...priorities]).map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </NativeSelect>
                  </div>
                </Field>
                <Field label="Labels">
                  <LabelsEditor value={issue.labels} disabled={!!busy} onSave={(labels) => update({ labels })} />
                </Field>
                <Field label="Assignee">
                  <Person name={issue.assignee} />
                </Field>
                <Field label="Reporter">
                  <Person name={issue.reporter} />
                </Field>
              </div>
              <dl className="flex flex-col gap-1 px-1 text-xs text-muted-foreground">
                <div>Created {formatRelative(issue.created)}</div>
                <div>Updated {formatRelative(issue.updated)}</div>
                <div>{issue.source === 'local' ? 'Stored in your local repo' : 'Synced with team Jira'}</div>
              </dl>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  )
}

function Person({ name }: { name?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <PersonAvatar name={name} />
      <span className={cn(!name && 'text-muted-foreground')}>{name ?? 'Unassigned'}</span>
    </div>
  )
}

function StatusMenu({ issue, disabled, onPick }: { issue: IssueDetail; disabled: boolean; onPick: (id: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || issue.transitions.length === 0}>
        <Button
          variant={issue.statusCategory === 'done' ? 'soft' : issue.statusCategory === 'in_progress' ? 'default' : 'outline'}
          className="justify-between"
        >
          {issue.status}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {issue.transitions.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => onPick(t.id)}>
            <StatusBadge status={t.toStatus} category={t.toCategory} />
            {t.name !== t.toStatus && <span className="text-xs text-muted-foreground">{t.name}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SummaryEditor({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState<string>()
  if (draft === undefined) {
    return (
      <h2
        className="-mx-2 cursor-text rounded-md px-2 py-1 text-2xl leading-tight font-semibold tracking-tight hover:bg-accent/60"
        onClick={() => !disabled && setDraft(value)}
      >
        {value}
      </h2>
    )
  }
  const commit = () => {
    const v = draft.trim()
    setDraft(undefined)
    if (v && v !== value) onSave(v)
  }
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          e.stopPropagation()
          setDraft(undefined)
        }
      }}
      className="h-11 text-xl font-semibold"
    />
  )
}

function DescriptionEditor({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState<string>()
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Description</SectionLabel>
      {draft === undefined ? (
        <div
          onClick={() => !disabled && setDraft(value)}
          className={cn(
            '-mx-2 min-h-16 cursor-text rounded-md px-2 py-1.5 text-sm leading-relaxed whitespace-pre-wrap hover:bg-accent/60',
            !value && 'text-muted-foreground',
          )}
        >
          {value || 'Add a description…'}
        </div>
      ) : (
        <>
          <Textarea
            autoFocus
            rows={8}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setDraft(undefined)
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (draft !== value) onSave(draft)
                setDraft(undefined)
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(undefined)}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function LabelsEditor({ value, disabled, onSave }: { value: string[]; disabled: boolean; onSave: (v: string[]) => void }) {
  const [draft, setDraft] = useState(value.join(', '))
  useEffect(() => setDraft(value.join(', ')), [value])
  const commit = () => {
    // Jira labels can't contain spaces.
    const next = [...new Set(draft.split(',').map((l) => l.trim().replace(/\s+/g, '-')).filter(Boolean))]
    if (next.join(',') !== value.join(',')) onSave(next)
  }
  return (
    <Input
      value={draft}
      disabled={disabled}
      placeholder="None"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}

function Comments({ issue, busy, onAdd }: { issue: IssueDetail; busy: boolean; onAdd: (body: string) => Promise<boolean> }) {
  const [body, setBody] = useState('')
  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Comments {issue.comments.length > 0 && `· ${issue.comments.length}`}</SectionLabel>
      <div className="flex gap-3">
        <PersonAvatar name="You" className="mt-1" />
        <div className="flex flex-1 flex-col gap-2">
          <Textarea
            rows={2}
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && body.trim()) {
                void onAdd(body.trim()).then((ok) => ok && setBody(''))
              }
            }}
          />
          {body.trim() && (
            <div>
              <Button size="sm" disabled={busy} onClick={() => void onAdd(body.trim()).then((ok) => ok && setBody(''))}>
                {busy && <Loader2 className="animate-spin" />} Comment
              </Button>
            </div>
          )}
        </div>
      </div>
      {[...issue.comments].reverse().map((c) => (
        <div key={c.id} className="flex gap-3">
          <PersonAvatar name={c.author} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-medium">{c.author}</span>
              <span className="text-xs text-muted-foreground">{formatRelative(c.created)}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function History({ issue }: { issue: IssueDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>History</SectionLabel>
      <ol className="flex flex-col">
        {issue.history.map((h) => (
          <li key={h.id} className="flex items-start gap-3 py-1.5 text-sm">
            <GitCommitHorizontal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">{h.text}</span>
            <code className="font-mono text-xs text-muted-foreground">{h.id.slice(0, 7)}</code>
            <span className="w-20 text-right text-xs whitespace-nowrap text-muted-foreground">{formatRelative(h.at)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function DeleteButton({ issue, onDeleted, onError }: { issue: IssueDetail; onDeleted: () => void; onError: (e: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <Button variant="ghost" size="icon" aria-label="Delete ticket" onClick={() => setConfirm(true)}>
        <Trash2 />
      </Button>
    )
  }
  return (
    <Button
      variant="destructive"
      size="sm"
      onBlur={() => setConfirm(false)}
      autoFocus
      onClick={() =>
        jiraApi()
          .deleteIssue({ source: issue.source, key: issue.key })
          .then(onDeleted, (e) => onError(errorText(e)))
      }
    >
      <Trash2 /> Delete {issue.key}?
    </Button>
  )
}
