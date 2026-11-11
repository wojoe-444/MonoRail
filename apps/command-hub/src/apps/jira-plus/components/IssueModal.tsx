import { useEffect, useState } from 'react'
import { Dialog as D } from 'radix-ui'
import { ChevronDown, ExternalLink, GitCommitHorizontal, Loader2, Trash2, X } from 'lucide-react'

import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { errorText, jiraApi } from '../api'
import { Avatar, LocalChip, Lozenge, PriorityIcon, ProjectAvatar, TypeIcon } from '../bits'
import { useJira } from '../JiraContext'
import type { IssueDetail, IssueFields } from '../types'
import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu'
import { ErrorNote } from './Modal'

/** The issue view: Jira's large modal with the ticket on the left and Details on the right. */
export function IssueModal() {
  const { selected, closeIssue, refresh, priorities, projects } = useJira()
  const [issue, setIssue] = useState<IssueDetail>()
  const [types, setTypes] = useState<string[]>([])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()

  useEffect(() => {
    if (!selected) return
    let live = true
    setIssue(undefined)
    setError(undefined)
    jiraApi()
      .getIssue(selected)
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
  }, [selected])

  async function run(label: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (!issue) return false
    setBusy(label)
    setError(undefined)
    try {
      await fn()
      setIssue(await jiraApi().getIssue({ source: issue.source, key: issue.key }))
      void refresh()
      return true
    } catch (e) {
      setError(errorText(e))
      return false
    } finally {
      setBusy(undefined)
    }
  }

  const update = (fields: IssueFields) => {
    if (issue) void run('update', () => jiraApi().updateIssue({ source: issue.source, key: issue.key, fields }))
  }

  const projectKey = selected?.key.split('-')[0] ?? ''
  const project = projects.find((p) => p.source === selected?.source && p.key === projectKey)

  return (
    <D.Root open={!!selected} onOpenChange={(o) => !o && closeIssue()}>
      <D.Portal>
        <D.Overlay className="jp fixed inset-0 z-50 bg-(--jp-blanket) data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content className="jp fixed top-[60px] left-1/2 z-50 flex max-h-[calc(100vh-100px)] w-[calc(100%-48px)] max-w-[1100px] -translate-x-1/2 flex-col rounded-[3px] bg-(--jp-raised) shadow-(--jp-shadow-overlay) outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <D.Title className="sr-only">{issue ? `${issue.key} ${issue.summary}` : (selected?.key ?? 'Issue')}</D.Title>
          <D.Description className="sr-only">Issue details</D.Description>

          {/* Breadcrumb + actions */}
          <div className="flex h-14 shrink-0 items-center gap-2 px-6">
            <ProjectAvatar projectKey={projectKey} size={16} />
            <span className="truncate text-(--jp-subtle)">{project?.name ?? projectKey}</span>
            <span className="text-(--jp-subtlest)">/</span>
            {issue && <TypeIcon type={issue.type} />}
            <span className="text-(--jp-subtle)">{selected?.key}</span>
            {selected?.source === 'local' && <LocalChip className="ml-1" />}
            <div className="ml-auto flex items-center gap-1">
              {busy && <Loader2 className="size-4 animate-spin text-(--jp-subtlest)" />}
              {issue?.url && (
                <a className="jp-btn jp-btn-subtle" href={issue.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open in Jira
                </a>
              )}
              {issue?.source === 'local' && <DeleteButton issue={issue} onDeleted={() => { void refresh(); closeIssue() }} onError={setError} />}
              <D.Close className="jp-btn jp-btn-subtle size-8 px-0" aria-label="Close">
                <X />
              </D.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
            <ErrorNote error={error} />
            {!issue && !error && (
              <div className="flex items-center gap-2 py-8 text-(--jp-subtle)">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}
            {issue && (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex min-w-0 flex-col gap-6">
                  <SummaryEditor value={issue.summary} disabled={!!busy} onSave={(summary) => update({ summary })} />
                  <DescriptionEditor value={issue.description} disabled={!!busy} onSave={(description) => update({ description })} />
                  <Activity
                    issue={issue}
                    busy={busy === 'comment'}
                    onComment={(body) => run('comment', () => jiraApi().addComment({ source: issue.source, key: issue.key, body }))}
                  />
                </div>

                <aside className="flex flex-col gap-4">
                  <StatusButton
                    issue={issue}
                    disabled={!!busy}
                    onPick={(transitionId) => void run('status', () => jiraApi().transitionIssue({ source: issue.source, key: issue.key, transitionId }))}
                  />
                  <div className="rounded-[3px] border border-(--jp-border)">
                    <div className="border-b border-(--jp-border) px-4 py-3 font-semibold">Details</div>
                    <dl className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4">
                      <DetailRow label="Assignee">
                        <Person name={issue.assignee} />
                      </DetailRow>
                      <DetailRow label="Reporter">
                        <Person name={issue.reporter} />
                      </DetailRow>
                      <DetailRow label="Labels">
                        <LabelsEditor value={issue.labels} disabled={!!busy} onSave={(labels) => update({ labels })} />
                      </DetailRow>
                      <DetailRow label="Priority">
                        <div className="flex items-center gap-1">
                          <PriorityIcon priority={issue.priority} />
                          <InlineSelect
                            value={issue.priority}
                            options={priorities.includes(issue.priority) ? priorities : [issue.priority, ...priorities]}
                            disabled={!!busy}
                            onChange={(priority) => update({ priority })}
                          />
                        </div>
                      </DetailRow>
                      <DetailRow label="Issue type">
                        <div className="flex items-center gap-1">
                          <TypeIcon type={issue.type} />
                          <InlineSelect
                            value={issue.type}
                            options={types.includes(issue.type) ? types : [issue.type, ...types]}
                            disabled={!!busy}
                            onChange={(type) => update({ type })}
                          />
                        </div>
                      </DetailRow>
                    </dl>
                  </div>
                  <div className="px-1 text-xs leading-5 text-(--jp-subtlest)">
                    <div>Created {formatRelative(issue.created)}</div>
                    <div>Updated {formatRelative(issue.updated)}</div>
                    <div>{issue.source === 'local' ? 'Stored in your private local repo' : 'Synced with your team Jira'}</div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm font-semibold text-(--jp-subtle)">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function Person({ name }: { name?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} />
      <span className={cn(!name && 'text-(--jp-subtle)')}>{name ?? 'Unassigned'}</span>
    </span>
  )
}

function InlineSelect({ value, options, disabled, onChange }: { value: string; options: string[]; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="jp-focusable -ml-1 h-8 min-w-0 flex-1 cursor-pointer rounded-[3px] bg-transparent px-1 text-(--jp-text) outline-none hover:bg-(--jp-hover)"
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  )
}

const STATUS_BTN: Record<string, string> = {
  todo: 'bg-(--jp-hover) text-(--jp-text) hover:bg-(--jp-pressed)',
  in_progress: 'bg-(--jp-brand) text-(--jp-brand-fg) hover:bg-(--jp-brand-hover)',
  done: 'bg-(--jp-lz-done-bg) text-(--jp-lz-done-fg) hover:opacity-90',
}

function StatusButton({ issue, disabled, onPick }: { issue: IssueDetail; disabled: boolean; onPick: (id: string) => void }) {
  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled || issue.transitions.length === 0}>
        <button type="button" className={cn('jp-btn w-fit', STATUS_BTN[issue.statusCategory])}>
          {issue.status}
          <ChevronDown />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {issue.transitions.map((t) => (
          <MenuItem key={t.id} onSelect={() => onPick(t.id)}>
            <Lozenge status={t.toStatus} category={t.toCategory} />
            {t.name !== t.toStatus && <span className="text-(--jp-subtle)">{t.name}</span>}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

function SummaryEditor({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState<string>()
  if (draft === undefined) {
    return (
      <h1
        className="-mx-1.5 cursor-text rounded-[3px] px-1.5 py-1 text-2xl leading-8 font-medium hover:bg-(--jp-hover)"
        onClick={() => !disabled && setDraft(value)}
      >
        {value}
      </h1>
    )
  }
  const commit = () => {
    const v = draft.trim()
    setDraft(undefined)
    if (v && v !== value) onSave(v)
  }
  return (
    <input
      autoFocus
      value={draft}
      aria-label="Summary"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          e.stopPropagation()
          setDraft(undefined)
        }
      }}
      className="jp-field text-2xl leading-8 font-medium"
    />
  )
}

function DescriptionEditor({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState<string>()
  return (
    <div>
      <h2 className="mb-2 font-semibold">Description</h2>
      {draft === undefined ? (
        <div
          onClick={() => !disabled && setDraft(value)}
          className={cn(
            '-mx-1.5 min-h-12 cursor-text rounded-[3px] px-1.5 py-1 leading-6 break-words whitespace-pre-wrap hover:bg-(--jp-hover)',
            !value && 'text-(--jp-subtlest)',
          )}
        >
          {value || 'Add a description…'}
        </div>
      ) : (
        <>
          <textarea
            autoFocus
            rows={8}
            value={draft}
            aria-label="Description"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setDraft(undefined)
              }
            }}
            className="jp-field leading-6"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="jp-btn jp-btn-primary"
              onClick={() => {
                if (draft !== value) onSave(draft)
                setDraft(undefined)
              }}
            >
              Save
            </button>
            <button type="button" className="jp-btn jp-btn-subtle" onClick={() => setDraft(undefined)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function LabelsEditor({ value, disabled, onSave }: { value: string[]; disabled: boolean; onSave: (v: string[]) => void }) {
  const [draft, setDraft] = useState<string>()
  if (draft === undefined) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDraft(value.join(', '))}
        className="jp-focusable -ml-1 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-[3px] px-1 text-left outline-none hover:bg-(--jp-hover)"
      >
        {value.length ? (
          value.map((l) => (
            <span key={l} className="rounded-[3px] bg-(--jp-hover) px-1.5 text-xs leading-5">
              {l}
            </span>
          ))
        ) : (
          <span className="text-(--jp-subtle)">None</span>
        )}
      </button>
    )
  }
  const commit = () => {
    // Jira labels can't contain spaces.
    const next = [...new Set(draft.split(',').map((l) => l.trim().replace(/\s+/g, '-')).filter(Boolean))]
    setDraft(undefined)
    if (next.join(',') !== value.join(',')) onSave(next)
  }
  return (
    <input
      autoFocus
      aria-label="Labels"
      value={draft}
      placeholder="label-one, label-two"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          e.stopPropagation()
          setDraft(undefined)
        }
      }}
      className="jp-field h-8 min-h-0 py-0"
    />
  )
}

function Activity({ issue, busy, onComment }: { issue: IssueDetail; busy: boolean; onComment: (body: string) => Promise<boolean> }) {
  const [tab, setTab] = useState<'comments' | 'history'>('comments')
  const [body, setBody] = useState('')
  const [focused, setFocused] = useState(false)
  const submit = () => void onComment(body.trim()).then((ok) => ok && (setBody(''), setFocused(false)))

  return (
    <div>
      <h2 className="mb-2 font-semibold">Activity</h2>
      <div className="mb-4 flex items-center gap-1">
        <span className="mr-1 text-(--jp-subtle)">Show:</span>
        <button type="button" className={cn('jp-btn h-7 px-2', tab === 'comments' && 'jp-btn-selected')} onClick={() => setTab('comments')}>
          Comments
        </button>
        {issue.source === 'local' && (
          <button type="button" className={cn('jp-btn h-7 px-2', tab === 'history' && 'jp-btn-selected')} onClick={() => setTab('history')}>
            History
          </button>
        )}
      </div>

      {tab === 'comments' && (
        <div className="flex flex-col gap-5">
          <div className="flex gap-3">
            <Avatar name="You" size={32} />
            <div className="flex-1">
              <textarea
                rows={focused || body ? 4 : 1}
                placeholder="Add a comment…"
                aria-label="Add a comment"
                value={body}
                onFocus={() => setFocused(true)}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && body.trim()) submit()
                }}
                className="jp-field"
              />
              {(focused || body) && (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="jp-btn jp-btn-primary" disabled={busy || !body.trim()} onClick={submit}>
                    {busy && <Loader2 className="animate-spin" />} Save
                  </button>
                  <button type="button" className="jp-btn jp-btn-subtle" onClick={() => (setBody(''), setFocused(false))}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
          {[...issue.comments].reverse().map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar name={c.author} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{c.author}</span>
                  <span className="text-xs text-(--jp-subtle)">{formatRelative(c.created)}</span>
                </div>
                <p className="mt-1 leading-6 break-words whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <ol className="flex flex-col">
          {issue.history.map((h) => (
            <li key={h.id} className="flex items-start gap-3 border-b border-(--jp-border) py-2 last:border-b-0">
              <GitCommitHorizontal className="mt-0.5 size-4 shrink-0 text-(--jp-subtlest)" />
              <span className="min-w-0 flex-1">{h.text}</span>
              <code className="font-mono text-xs text-(--jp-subtlest)" title="git commit in your private repo">
                {h.id.slice(0, 7)}
              </code>
              <span className="w-20 text-right text-xs whitespace-nowrap text-(--jp-subtle)">{formatRelative(h.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function DeleteButton({ issue, onDeleted, onError }: { issue: IssueDetail; onDeleted: () => void; onError: (e: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <button type="button" className="jp-btn jp-btn-subtle size-8 px-0" aria-label="Delete issue" title="Delete issue" onClick={() => setConfirm(true)}>
        <Trash2 />
      </button>
    )
  }
  return (
    <button
      type="button"
      className="jp-btn jp-btn-danger"
      autoFocus
      onBlur={() => setConfirm(false)}
      onClick={() =>
        jiraApi()
          .deleteIssue({ source: issue.source, key: issue.key })
          .then(onDeleted, (e) => onError(errorText(e)))
      }
    >
      <Trash2 /> Delete {issue.key}?
    </button>
  )
}
