import { useState } from 'react'
import { ExternalLink, Globe, Loader2, Lock } from 'lucide-react'

import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { Avatar } from '../bits'
import type { Comment, IssueDetail } from '../types'

/**
 * Comments on one issue. Private tickets keep them in the local repo; team
 * tickets post real Jira comments, which everyone who can see the ticket
 * reads, so the composer says so every time.
 */
export function Comments({
  issue,
  me,
  busy,
  onAdd,
  onEdit,
  onDelete,
}: {
  issue: IssueDetail
  /** The team Jira account name, shown as who a team comment posts as. */
  me?: string
  /** The action running right now: 'add', or 'edit:<id>' / 'delete:<id>'. */
  busy?: string
  onAdd: (body: string) => Promise<boolean>
  onEdit: (c: Comment, body: string) => Promise<boolean>
  onDelete: (c: Comment) => Promise<boolean>
}) {
  const team = issue.source === 'jira'
  const [body, setBody] = useState('')
  const [focused, setFocused] = useState(false)
  const open = focused || !!body
  const submit = () => void onAdd(body.trim()).then((ok) => ok && (setBody(''), setFocused(false)))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3">
        <Avatar name={team ? (me ?? 'You') : 'You'} size={32} />
        <div className="min-w-0 flex-1">
          <textarea
            rows={open ? 4 : 1}
            placeholder={team ? 'Add a comment for the team…' : 'Add a private comment…'}
            aria-label="Add a comment"
            value={body}
            onFocus={() => setFocused(true)}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && body.trim()) submit()
              if (e.key === 'Escape' && !body) (e.currentTarget.blur(), setFocused(false))
            }}
            className="jp-field"
          />
          {open && <Visibility issue={issue} me={me} />}
          {open && (
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className="jp-btn jp-btn-primary" disabled={busy === 'add' || !body.trim()} onClick={submit}>
                {busy === 'add' && <Loader2 className="animate-spin" />} {team ? 'Post to Jira' : 'Save'}
              </button>
              <button type="button" className="jp-btn jp-btn-subtle" onClick={() => (setBody(''), setFocused(false))}>
                Cancel
              </button>
              <span className="ml-auto text-xs text-(--jp-subtlest)">Ctrl+Enter to {team ? 'post' : 'save'}</span>
            </div>
          )}
        </div>
      </div>

      {issue.comments.length === 0 && (
        <p className="text-(--jp-subtle)">{team ? 'No comments on this ticket yet.' : 'No comments yet. Notes to yourself go here.'}</p>
      )}

      {[...issue.comments].reverse().map((c) => (
        <CommentRow key={c.id} issue={issue} comment={c} busy={busy} onEdit={onEdit} onDelete={onDelete} />
      ))}

      {!!issue.commentsCut && issue.url && (
        <a className="jp-link inline-flex items-center gap-1 self-start text-sm hover:underline" href={issue.url} target="_blank" rel="noreferrer">
          {issue.commentsCut} older {issue.commentsCut === 1 ? 'comment is' : 'comments are'} only shown in Jira <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  )
}

/** Who will read the comment: the whole team (team Jira) or only you (private repo). */
function Visibility({ issue, me }: { issue: IssueDetail; me?: string }) {
  if (issue.source === 'jira') {
    return (
      <p className="mt-2 flex items-start gap-2 rounded-md bg-(--jp-warning-bg) px-2 py-1.5 text-sm text-(--jp-warning-fg)">
        <Globe className="mt-0.5 size-4 shrink-0" />
        <span>
          <b>Visible to your team.</b> This posts a real comment on {issue.key} in Jira{me ? ` as ${me}` : ''}. Everyone who can see the ticket can read it, and
          Jira may email watchers.
        </span>
      </p>
    )
  }
  return (
    <p className="mt-2 flex items-start gap-2 rounded-md bg-(--jp-local-bg) px-2 py-1.5 text-sm text-(--jp-local)">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <span>
        <b>Private.</b> Saved only in your private Tasks repo on this computer. Never sent anywhere.
      </span>
    </p>
  )
}

function CommentRow({
  issue,
  comment: c,
  busy,
  onEdit,
  onDelete,
}: {
  issue: IssueDetail
  comment: Comment
  busy?: string
  onEdit: (c: Comment, body: string) => Promise<boolean>
  onDelete: (c: Comment) => Promise<boolean>
}) {
  const team = issue.source === 'jira'
  const [editing, setEditing] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const save = () => {
    if (editing === undefined) return
    const next = editing.trim()
    if (!next || next === c.body) return setEditing(undefined)
    void onEdit(c, next).then((ok) => ok && setEditing(undefined))
  }

  return (
    <div className="group flex gap-3">
      <Avatar name={c.author} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{c.author}</span>
          <span className="text-xs text-(--jp-subtle)" title={new Date(c.created).toLocaleString()}>
            {formatRelative(c.created)}
          </span>
          {c.updated && (
            <span className="text-xs text-(--jp-subtlest)" title={`Edited ${new Date(c.updated).toLocaleString()}`}>
              (edited)
            </span>
          )}
        </div>

        {editing === undefined ? (
          <p className="mt-1 leading-6 break-words whitespace-pre-wrap">{c.body}</p>
        ) : (
          <div className="mt-1">
            <textarea
              rows={4}
              autoFocus
              aria-label="Edit comment"
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
                if (e.key === 'Escape') setEditing(undefined)
              }}
              className="jp-field"
            />
            {team && <p className="mt-1 text-xs text-(--jp-warning-fg)">Saving updates the comment in Jira for everyone who can see {issue.key}.</p>}
            <div className="mt-2 flex gap-2">
              <button type="button" className="jp-btn jp-btn-primary" disabled={busy === `edit:${c.id}` || !editing.trim()} onClick={save}>
                {busy === `edit:${c.id}` && <Loader2 className="animate-spin" />} {team ? 'Save to Jira' : 'Save'}
              </button>
              <button type="button" className="jp-btn jp-btn-subtle" onClick={() => setEditing(undefined)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {c.mine && editing === undefined && !confirm && (
          <div className="mt-1 flex gap-3 text-sm text-(--jp-subtle)">
            <button type="button" className="jp-focusable rounded-md font-medium outline-none hover:underline" onClick={() => setEditing(c.body)}>
              Edit
            </button>
            <button type="button" className="jp-focusable rounded-md font-medium outline-none hover:underline" onClick={() => setConfirm(true)}>
              Delete
            </button>
          </div>
        )}

        {confirm && (
          <div className={cn('mt-2 flex flex-wrap items-center gap-2 rounded-md bg-(--jp-danger-bg) px-2 py-1.5 text-sm')}>
            <span className="flex-1">
              {team ? 'Delete this comment from Jira? It is removed for everyone on the team.' : 'Delete this comment? It stays in your local repo’s history.'}
            </span>
            <button type="button" className="jp-btn jp-btn-danger h-7" disabled={busy === `delete:${c.id}`} onClick={() => void onDelete(c).then((ok) => !ok && setConfirm(false))}>
              {busy === `delete:${c.id}` && <Loader2 className="animate-spin" />} Delete
            </button>
            <button type="button" className="jp-btn jp-btn-subtle h-7" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
