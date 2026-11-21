import { useEffect, useState, type ReactNode } from 'react'
import { Dialog as D } from 'radix-ui'
import { ArrowRight, Copy, CornerDownRight, Link2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'
import { cn } from '@/lib/utils'

import { trackerApi } from '../api'
import { cycleLabel, dueTone, errorText, estimateLabel, estimateOptions, identifier, isDone, PRIORITY_LABEL, shortDate, when } from '../lib'
import { useTracker } from '../TrackerContext'
import type { Comment, HistoryEntry, Issue, RelationType } from '../types'
import { Avatar, Dot, EntityIcon, PriorityIcon, StatusIcon } from './bits'
import { DatePicker, NONE, Picker, startedFill, useItems } from './Picker'

/** The issue side panel (?issue=ENG-12): the issue on the left, its properties on the right. */
export function IssuePanel() {
  const { openedIssue, openIssue } = useTracker()
  return (
    <D.Root open={!!openedIssue} onOpenChange={(o) => !o && openIssue(undefined)}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content aria-describedby={undefined} className="trk fixed inset-y-0 right-0 z-40 flex w-full max-w-[1040px] flex-col border-l bg-background shadow-elevation-3 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          {openedIssue && <Panel key={openedIssue.id} issue={openedIssue} />}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

function Panel({ issue }: { issue: Issue }) {
  const { snap, idx, openIssue, deleteIssues, toast } = useTracker()
  const ident = identifier(idx, issue)
  const team = idx.team.get(issue.teamId)
  const parent = issue.parentId ? idx.issue.get(issue.parentId) : undefined
  const project = snap.projects.find((p) => p.id === issue.projectId)
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 text-sm">
        <EntityIcon icon={team?.icon} color={team?.color ?? '#999'} size={14} />
        <span className="text-muted-foreground">{team?.name}</span>
        {project && (
          <>
            <span className="text-muted-foreground">›</span>
            <span className="truncate text-muted-foreground">{project.name}</span>
          </>
        )}
        <span className="text-muted-foreground">›</span>
        <D.Title className="font-mono text-sm font-medium">{ident}</D.Title>
        <span className="flex-1" />
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          title="Copy identifier"
          onClick={() => {
            void navigator.clipboard?.writeText(`${ident} ${issue.title}`)
            toast({ text: `Copied ${ident}.` })
          }}
        >
          <Copy />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-destructive"
          title="Delete issue"
          onClick={() => {
            openIssue(undefined)
            void deleteIssues([issue.id])
          }}
        >
          <Trash2 />
        </Button>
        <D.Close asChild>
          <Button size="icon" variant="ghost" className="size-8" aria-label="Close">
            <X />
          </Button>
        </D.Close>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          {parent && (
            <button type="button" onClick={() => openIssue(parent)} className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Sub-issue of <span className="font-mono">{identifier(idx, parent)}</span> {parent.title}
            </button>
          )}
          <TitleEditor issue={issue} />
          <DescriptionEditor issue={issue} />
          <SubIssues issue={issue} />
          <Relations issue={issue} />
          <Activity issue={issue} />
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto border-l bg-muted/30 p-4">
          <Properties issue={issue} />
        </aside>
      </div>
    </>
  )
}

function TitleEditor({ issue }: { issue: Issue }) {
  const { updateIssues } = useTracker()
  const [title, setTitle] = useState(issue.title)
  // oxlint-disable-next-line react/set-state-in-effect -- Resync the title draft when the persisted issue title changes.
  useEffect(() => setTitle(issue.title), [issue.title])
  const save = () => {
    const t = title.trim()
    if (t && t !== issue.title) void updateIssues({ ids: [issue.id], patch: { title: t } })
    else setTitle(issue.title)
  }
  return (
    <textarea
      value={title}
      rows={1}
      onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
      className="field-sizing-content w-full resize-none bg-transparent text-2xl font-semibold tracking-tight outline-none"
      aria-label="Title"
    />
  )
}

function DescriptionEditor({ issue }: { issue: Issue }) {
  const { updateIssues } = useTracker()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(issue.description)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Refresh the description draft only while the editor is closed.
    if (!editing) setText(issue.description)
  }, [issue.description, editing])
  const save = () => {
    setEditing(false)
    if (text !== issue.description) void updateIssues({ ids: [issue.id], patch: { description: text } })
  }
  if (editing)
    return (
      <div className="mt-3">
        <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' && (e.ctrlKey || e.metaKey) ? save() : e.key === 'Escape' && (e.stopPropagation(), setEditing(false), setText(issue.description)))} className="field-sizing-content min-h-32 font-mono text-[13px]" placeholder="Add a description… (Markdown)" />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setText(issue.description))}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save <span className="text-xs opacity-70">Ctrl+Enter</span>
          </Button>
        </div>
      </div>
    )
  return (
    <div role="button" tabIndex={0} onClick={() => setEditing(true)} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)} className="mt-3 min-h-12 cursor-text rounded-md py-1 text-sm hover:bg-accent/40">
      {issue.description.trim() ? <ChatMarkdown text={issue.description} /> : <span className="text-muted-foreground">Add a description…</span>}
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="flex-1" />
        {action}
      </div>
      {children}
    </section>
  )
}

function MiniRow({ issue, children }: { issue: Issue; children?: ReactNode }) {
  const { idx, snap, openIssue } = useTracker()
  const st = idx.state.get(issue.stateId)
  return (
    <div className="group flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent/60">
      <button type="button" onClick={() => openIssue(issue)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {st && <StatusIcon type={st.type} color={st.color} />}
        <span className="font-mono text-xs text-muted-foreground">{identifier(idx, issue)}</span>
        <span className={cn('truncate', isDone(idx, issue) && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{issue.title}</span>
      </button>
      {children}
      <Avatar member={snap.users.find((u) => u.id === issue.assigneeId)} size={16} />
    </div>
  )
}

function SubIssues({ issue }: { issue: Issue }) {
  const { idx, run } = useTracker()
  const subs = [...(idx.children.get(issue.id) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const done = subs.filter((s) => isDone(idx, s)).length
  const add = async () => {
    if (!title.trim()) return setAdding(false)
    const ok = await run(() => trackerApi.createIssue({ teamId: issue.teamId, title: title.trim(), parentId: issue.id, projectId: issue.projectId, cycleId: issue.cycleId }))
    if (ok) setTitle('')
  }
  return (
    <Section
      title={subs.length ? `Sub-issues ${done}/${subs.length}` : 'Sub-issues'}
      action={
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <Plus /> Add
        </Button>
      }
    >
      {subs.map((s) => (
        <MiniRow key={s.id} issue={s} />
      ))}
      {adding && (
        <form onSubmit={(e) => (e.preventDefault(), void add())} className="flex items-center gap-2 px-2">
          <CornerDownRight className="size-4 text-muted-foreground" />
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => !title && setAdding(false)} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setAdding(false))} placeholder="Sub-issue title, Enter to add" className="h-9 flex-1 bg-transparent text-sm outline-none" />
        </form>
      )}
      {!subs.length && !adding && <p className="px-2 text-sm text-muted-foreground">Break this issue into smaller pieces.</p>}
    </Section>
  )
}

const RELATION_LABEL: Record<string, string> = { blocks: 'Blocks', blockedBy: 'Blocked by', related: 'Related', duplicate: 'Duplicate of', duplicatedBy: 'Duplicated by' }

function Relations({ issue }: { issue: Issue }) {
  const { idx, updateIssues } = useTracker()
  const items = useItems()
  const [kind, setKind] = useState<RelationType>('related')
  const rows: { key: string; label: string; other: Issue; remove: () => void }[] = []
  for (const r of issue.relations ?? []) {
    const other = idx.issue.get(r.issueId)
    if (other) rows.push({ key: `o${r.issueId}`, label: RELATION_LABEL[r.type], other, remove: () => void updateIssues({ ids: [issue.id], patch: { relations: issue.relations.filter((x) => x.issueId !== r.issueId) } }) })
  }
  for (const r of idx.incoming.get(issue.id) ?? []) {
    const other = idx.issue.get(r.issueId)
    if (other) rows.push({ key: `i${r.issueId}`, label: RELATION_LABEL[r.type === 'blocks' ? 'blockedBy' : r.type === 'duplicate' ? 'duplicatedBy' : 'related'], other, remove: () => void updateIssues({ ids: [other.id], patch: { relations: other.relations.filter((x) => x.issueId !== issue.id) } }) })
  }
  const exclude = [issue.id, ...rows.map((r) => r.other.id)]
  return (
    <Section
      title="Relations"
      action={
        <div className="flex items-center gap-1">
          <select value={kind} onChange={(e) => setKind(e.target.value as RelationType)} className="h-8 rounded-md border bg-card px-2 text-xs" aria-label="Relation">
            <option value="related">Related to</option>
            <option value="blocks">Blocks</option>
            <option value="duplicate">Duplicate of</option>
          </select>
          <Picker items={items.issue(exclude)} selected={[]} onPick={(v) => void updateIssues({ ids: [issue.id], patch: { relations: [...(issue.relations ?? []), { type: kind, issueId: v }] } })} placeholder="Find an issue…" align="end">
            <Button size="sm" variant="ghost">
              <Link2 /> Link
            </Button>
          </Picker>
        </div>
      }
    >
      {rows.length === 0 && <p className="px-2 text-sm text-muted-foreground">Mark issues that block this one, depend on it or say the same thing.</p>}
      {rows.map((r) => (
        <MiniRow key={r.key} issue={r.other}>
          <span className="shrink-0 text-xs text-muted-foreground">{r.label}</span>
          <button type="button" onClick={r.remove} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent" aria-label="Remove relation">
            <X className="size-3.5" />
          </button>
        </MiniRow>
      ))}
    </Section>
  )
}

// ---------------------------------------------------------------- comments and history

function Activity({ issue }: { issue: Issue }) {
  const { snap, run } = useTracker()
  const [detail, setDetail] = useState<{ comments: Comment[]; history: HistoryEntry[] }>()
  const [error, setError] = useState<string>()
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<string>()
  const load = () =>
    trackerApi.issueDetail(issue.id).then(
      (d) => (setDetail(d), setError(undefined)),
      (e) => setError(errorText(e)),
    )
  useEffect(() => {
    void load()
    // Reload when the issue changes (a new version means new history).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id, issue.version])
  const send = async (parentId?: string) => {
    if (!body.trim()) return
    const ok = await run(() => trackerApi.save('comment', { issueId: issue.id, body, parentId: parentId ?? null }).then(() => true))
    if (ok) {
      setBody('')
      setReplyTo(undefined)
      void load()
    }
  }
  type Item = { at: number; kind: 'comment'; c: Comment } | { at: number; kind: 'change'; h: HistoryEntry }
  const items: Item[] = [...(detail?.comments ?? []).filter((c) => !c.parentId).map((c) => ({ at: c.createdAt, kind: 'comment' as const, c })), ...(detail?.history ?? []).map((h) => ({ at: h.at, kind: 'change' as const, h }))].sort((a, b) => a.at - b.at)
  const creator = snap.users.find((u) => u.id === issue.creatorId)
  return (
    <Section title="Activity">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!detail && !error && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      <ol className="flex flex-col gap-3">
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar member={creator} size={16} /> {creator?.name ?? 'Someone'} created the issue · {when(issue.createdAt)}
        </li>
        {items.map((it) =>
          it.kind === 'change' ? (
            <li key={`h${it.at}${it.h.field}`} className="flex items-center gap-2 pl-0.5 text-xs text-muted-foreground">
              <ArrowRight className="size-3" /> <ChangeText h={it.h} /> · {when(it.at)}
            </li>
          ) : (
            <li key={it.c.id}>
              <CommentCard c={it.c} replies={(detail?.comments ?? []).filter((r) => r.parentId === it.c.id)} onChanged={load} onReply={() => setReplyTo(it.c.id)} />
              {replyTo === it.c.id && <Composer value={body} onChange={setBody} onSend={() => void send(it.c.id)} onCancel={() => setReplyTo(undefined)} placeholder="Reply…" />}
            </li>
          ),
        )}
      </ol>
      {!replyTo && <Composer value={body} onChange={setBody} onSend={() => void send()} placeholder="Leave a comment… (Markdown, Ctrl+Enter to send)" />}
    </Section>
  )
}

function Composer({ value, onChange, onSend, onCancel, placeholder }: { value: string; onChange: (v: string) => void; onSend: () => void; onCancel?: () => void; placeholder: string }) {
  return (
    <div className="mt-3 rounded-lg border bg-card p-2">
      <textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && (e.preventDefault(), onSend())} placeholder={placeholder} className="field-sizing-content min-h-12 w-full resize-none bg-transparent text-sm outline-none" />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" disabled={!value.trim()} onClick={onSend}>
          Comment
        </Button>
      </div>
    </div>
  )
}

function CommentCard({ c, replies, onChanged, onReply, reply }: { c: Comment; replies: Comment[]; onChanged: () => void; onReply?: () => void; reply?: boolean }) {
  const { snap, run } = useTracker()
  const author = snap.users.find((u) => u.id === c.userId)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(c.body)
  return (
    <div className={cn('rounded-lg bg-card ring-1 ring-foreground/10', reply ? 'mt-2 ml-6' : '')}>
      <div className="group flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground">
        <Avatar member={author} size={16} />
        <span className="font-medium text-foreground">{author?.name ?? 'Someone'}</span>
        <span>{when(c.createdAt)}</span>
        {c.editedAt && <span>(edited)</span>}
        <span className="flex-1" />
        {!reply && onReply && (
          <button type="button" onClick={onReply} className="opacity-0 group-hover:opacity-100 hover:text-foreground">
            Reply
          </button>
        )}
        <button type="button" onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 hover:text-foreground" aria-label="Edit comment">
          <Pencil className="size-3" />
        </button>
        <button type="button" onClick={() => void run(() => trackerApi.remove('comment', c.id)).then(onChanged)} className="opacity-0 group-hover:opacity-100 hover:text-destructive" aria-label="Delete comment">
          <Trash2 className="size-3" />
        </button>
      </div>
      <div className="px-3 pt-1 pb-2 text-sm">
        {editing ? (
          <div>
            <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} className="field-sizing-content" />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setText(c.body))}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void run(() => trackerApi.save('comment', { id: c.id, body: text })).then(() => (setEditing(false), onChanged()))}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <ChatMarkdown text={c.body} />
        )}
      </div>
      {replies.map((r) => (
        <div key={r.id} className="px-3 pb-2">
          <CommentCard c={r} replies={[]} onChanged={onChanged} reply />
        </div>
      ))}
    </div>
  )
}

function ChangeText({ h }: { h: HistoryEntry }) {
  const { snap, idx } = useTracker()
  const name = (field: string, v: unknown): string => {
    if (v == null || (Array.isArray(v) && !v.length)) return 'none'
    switch (field) {
      case 'stateId':
        return idx.state.get(String(v))?.name ?? 'a removed status'
      case 'priority':
        return PRIORITY_LABEL[Number(v)]
      case 'assigneeId':
        return snap.users.find((u) => u.id === v)?.name ?? 'someone removed'
      case 'projectId':
        return snap.projects.find((p) => p.id === v)?.name ?? 'a removed project'
      case 'projectMilestoneId':
        return snap.milestones.find((m) => m.id === v)?.name ?? 'a removed milestone'
      case 'cycleId': {
        const c = snap.cycles.find((x) => x.id === v)
        return c ? cycleLabel(c) : 'a removed cycle'
      }
      case 'teamId':
        return idx.team.get(String(v))?.name ?? 'a removed team'
      case 'parentId': {
        const p = idx.issue.get(String(v))
        return p ? identifier(idx, p) : 'a removed issue'
      }
      case 'labelIds':
        return (v as string[]).map((l) => snap.labels.find((x) => x.id === l)?.name ?? '?').join(', ')
      case 'dueDate':
        return shortDate(String(v))
      case 'relations':
        return `${(v as unknown[]).length} linked`
      default:
        return String(v)
    }
  }
  const FIELD: Record<string, string> = { stateId: 'status', priority: 'priority', assigneeId: 'assignee', projectId: 'project', projectMilestoneId: 'milestone', cycleId: 'cycle', teamId: 'team', parentId: 'parent', labelIds: 'labels', dueDate: 'due date', estimate: 'estimate', relations: 'relations' }
  if (h.field === 'title') return <span>renamed it to “{String(h.to)}”</span>
  if (h.field === 'description') return <span>edited the description</span>
  if (h.field === 'deleted') return <span>{h.to ? 'deleted' : 'restored'} the issue</span>
  return (
    <span>
      changed {FIELD[h.field] ?? h.field} from <b className="font-medium">{name(h.field, h.from)}</b> to <b className="font-medium">{name(h.field, h.to)}</b>
    </span>
  )
}

// ---------------------------------------------------------------- properties

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
const propBtn = 'flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent'

function Properties({ issue }: { issue: Issue }) {
  const { snap, idx, updateIssues } = useTracker()
  const items = useItems()
  const set = (patch: Partial<Issue>) => void updateIssues({ ids: [issue.id], patch })
  const st = idx.state.get(issue.stateId)
  const team = idx.team.get(issue.teamId)
  const assignee = snap.users.find((u) => u.id === issue.assigneeId)
  const project = snap.projects.find((p) => p.id === issue.projectId)
  const milestone = snap.milestones.find((m) => m.id === issue.projectMilestoneId)
  const cycle = snap.cycles.find((c) => c.id === issue.cycleId)
  const labels = issue.labelIds.map((l) => snap.labels.find((x) => x.id === l)).filter((l) => !!l)
  const tone = dueTone(issue.dueDate, isDone(idx, issue))
  const states = snap.states.filter((s) => s.teamId === issue.teamId).sort((a, b) => a.position - b.position)
  const triage = st?.type === 'triage'
  return (
    <div className="flex flex-col gap-0.5">
      {triage && <TriageActions issue={issue} />}
      <Prop label="Status">
        <Picker items={items.status(issue.teamId)} selected={[issue.stateId]} onPick={(v) => set({ stateId: v })}>
          <button type="button" className={propBtn}>
            {st && <StatusIcon type={st.type} color={st.color} fill={startedFill(states, st.id)} />}
            {st?.name}
          </button>
        </Picker>
      </Prop>
      <Prop label="Priority">
        <Picker items={items.priority()} selected={[String(issue.priority)]} onPick={(v) => set({ priority: Number(v) })}>
          <button type="button" className={propBtn}>
            <PriorityIcon priority={issue.priority} className="text-muted-foreground" />
            {PRIORITY_LABEL[issue.priority]}
          </button>
        </Picker>
      </Prop>
      <Prop label="Assignee">
        <Picker items={items.member()} selected={[issue.assigneeId ?? NONE]} onPick={(v) => set({ assigneeId: v === NONE ? null : v })}>
          <button type="button" className={propBtn}>
            <Avatar member={assignee} size={16} />
            <span className={cn('truncate', !assignee && 'text-muted-foreground')}>{assignee?.name ?? 'Unassigned'}</span>
          </button>
        </Picker>
      </Prop>
      <Prop label="Labels">
        <Picker items={items.label(issue.teamId)} selected={issue.labelIds} multi onPick={(v) => void updateIssues(issue.labelIds.includes(v) ? { ids: [issue.id], removeLabelIds: [v] } : { ids: [issue.id], addLabelIds: [v] })}>
          <button type="button" className={cn(propBtn, 'h-auto min-h-8 flex-wrap py-1')}>
            {labels.length ? (
              labels.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-2 text-xs">
                  <Dot color={l.color} />
                  {l.name}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">Add labels</span>
            )}
          </button>
        </Picker>
      </Prop>
      {estimateOptions(team).length > 0 && (
        <Prop label="Estimate">
          <Picker items={items.estimate(issue.teamId)} selected={[issue.estimate == null ? NONE : String(issue.estimate)]} onPick={(v) => set({ estimate: v === NONE ? null : Number(v) })}>
            <button type="button" className={cn(propBtn, issue.estimate == null && 'text-muted-foreground')}>
              {estimateLabel(team, issue.estimate)}
            </button>
          </Picker>
        </Prop>
      )}
      <Prop label="Due date">
        <DatePicker value={issue.dueDate} onChange={(v) => set({ dueDate: v })}>
          <button type="button" className={cn(propBtn, !issue.dueDate && 'text-muted-foreground', tone === 'overdue' && 'text-destructive')}>
            {issue.dueDate ? shortDate(issue.dueDate) : 'Set due date'}
          </button>
        </DatePicker>
      </Prop>
      <div className="my-3 border-t" />
      <Prop label="Project">
        <Picker items={items.project()} selected={[issue.projectId ?? NONE]} onPick={(v) => set({ projectId: v === NONE ? null : v })}>
          <button type="button" className={propBtn}>
            {project ? <EntityIcon icon={project.icon} color={project.color} size={14} /> : null}
            <span className={cn('truncate', !project && 'text-muted-foreground')}>{project?.name ?? 'Add to project'}</span>
          </button>
        </Picker>
      </Prop>
      {project && (
        <Prop label="Milestone">
          <Picker items={items.milestone(project.id)} selected={[issue.projectMilestoneId ?? NONE]} onPick={(v) => set({ projectMilestoneId: v === NONE ? null : v })}>
            <button type="button" className={cn(propBtn, !milestone && 'text-muted-foreground')}>
              {milestone?.name ?? 'No milestone'}
            </button>
          </Picker>
        </Prop>
      )}
      {team?.cyclesEnabled && (
        <Prop label="Cycle">
          <Picker items={items.cycle(issue.teamId)} selected={[issue.cycleId ?? NONE]} onPick={(v) => set({ cycleId: v === NONE ? null : v })}>
            <button type="button" className={cn(propBtn, !cycle && 'text-muted-foreground')}>
              {cycle ? cycleLabel(cycle) : 'Add to cycle'}
            </button>
          </Picker>
        </Prop>
      )}
      <Prop label="Parent">
        <Picker items={[{ value: NONE, label: 'No parent' }, ...items.issue([issue.id, ...(idx.children.get(issue.id) ?? []).map((c) => c.id)])]} selected={[issue.parentId ?? NONE]} onPick={(v) => set({ parentId: v === NONE ? null : v })} placeholder="Find a parent issue…">
          <button type="button" className={cn(propBtn, !issue.parentId && 'text-muted-foreground')}>
            {issue.parentId && idx.issue.get(issue.parentId) ? identifier(idx, idx.issue.get(issue.parentId)!) : 'Set parent'}
          </button>
        </Picker>
      </Prop>
      <Prop label="Team">
        <Picker items={items.team()} selected={[issue.teamId]} onPick={(v) => v !== issue.teamId && set({ teamId: v })} placeholder="Move to team…">
          <button type="button" className={propBtn}>
            <EntityIcon icon={team?.icon} color={team?.color ?? '#999'} size={14} />
            {team?.name}
          </button>
        </Picker>
      </Prop>
      <div className="mt-4 text-xs text-muted-foreground">
        Created {when(issue.createdAt)} · updated {when(issue.updatedAt)}
        {issue.previousIdentifiers?.length ? <div>Was {issue.previousIdentifiers.join(', ')}</div> : null}
      </div>
    </div>
  )
}

function TriageActions({ issue }: { issue: Issue }) {
  const { snap, idx, updateIssues } = useTracker()
  const items = useItems()
  const team = idx.team.get(issue.teamId)
  const canceled = snap.states.filter((s) => s.teamId === issue.teamId && s.type === 'canceled').sort((a, b) => a.position - b.position)
  const duplicate = canceled.find((s) => /duplicate/i.test(s.name)) ?? canceled[0]
  return (
    <div className="mb-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
      <div className="mb-2 font-medium">In triage</div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" onClick={() => team?.defaultStateId && void updateIssues({ ids: [issue.id], patch: { stateId: team.defaultStateId } })}>
          Accept
        </Button>
        <Picker items={items.issue([issue.id])} selected={[]} placeholder="Duplicate of…" onPick={(v) => duplicate && void updateIssues({ ids: [issue.id], patch: { stateId: duplicate.id, relations: [...issue.relations.filter((r) => r.issueId !== v), { type: 'duplicate', issueId: v }] } })}>
          <Button size="sm" variant="outline">
            Duplicate
          </Button>
        </Picker>
        <Button size="sm" variant="outline" onClick={() => canceled[0] && void updateIssues({ ids: [issue.id], patch: { stateId: canceled[0].id } })}>
          Decline
        </Button>
      </div>
    </div>
  )
}
