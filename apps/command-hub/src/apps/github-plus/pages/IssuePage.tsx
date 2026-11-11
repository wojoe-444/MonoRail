import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { api } from '../api'
import { Avatar } from '../components/CommitList'
import { IssueClosedIcon, IssueOpenIcon } from '../components/Icons'
import Markdown from '../components/Markdown'
import MarkdownEditor from '../components/MarkdownEditor'
import { issuesLink, newIssueLink } from '../links'
import type { Issue, IssueEvent } from '../types'
import { fullDate, timeAgo } from '../util'

export default function IssuePage() {
  const { repo } = useRepo()
  const rp = repo!.path
  const number = Number(useParams().number)
  const [issue, setIssue] = useState<Issue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState<null | 'comment' | 'state' | 'edit'>(null)
  const [editing, setEditing] = useState<null | 'title' | 'body'>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')

  useEffect(() => {
    let live = true
    setIssue(null); setError(null)
    api.getIssue(rp, number).then((i) => live && setIssue(i), (e: Error) => live && setError(e.message))
    return () => { live = false }
  }, [rp, number])

  const act = async (kind: 'comment' | 'state' | 'edit', fn: () => Promise<Issue>) => {
    setBusy(kind); setError(null)
    try {
      setIssue(await fn())
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }

  if (error && !issue) return <div className="flash error">{error} <Link to={issuesLink()}>Back to issues</Link></div>
  if (!issue) return <div className="pad muted">Loading…</div>

  const open = issue.state === 'open'
  const commentCount = issue.timeline.filter((t) => t.kind === 'comment').length
  const toggle = () => act('state', async () => {
    if (comment.trim()) {
      await api.addIssueComment(rp, number, comment)
      setComment('')
    }
    return api.updateIssue(rp, number, { state: open ? 'closed' : 'open' })
  })
  const send = () => act('comment', () => api.addIssueComment(rp, number, comment)).then((ok) => ok && setComment(''))
  const refName = repo!.defaultRef ?? 'HEAD'

  return (
    <div className="issue-page">
      <div className="issue-header">
        {editing === 'title' ? (
          <div className="issue-title-edit">
            <input className="text-input" autoFocus maxLength={256} value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(null)
                if (e.key === 'Enter' && draftTitle.trim()) void act('edit', () => api.updateIssue(rp, number, { title: draftTitle })).then((ok) => ok && setEditing(null))
              }} />
            <button className="btn" disabled={!draftTitle.trim() || !!busy} onClick={() => void act('edit', () => api.updateIssue(rp, number, { title: draftTitle })).then((ok) => ok && setEditing(null))}>Save</button>
            <button className="link-btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        ) : (
          <div className="issue-title-row">
            <h1>{issue.title} <span className="muted">#{issue.number}</span></h1>
            <span className="spacer" />
            <button className="btn" onClick={() => { setDraftTitle(issue.title); setEditing('title') }}>Edit</button>
            <Link className="btn primary" to={newIssueLink()}>New issue</Link>
          </div>
        )}
        <div className="issue-meta">
          <span className={`state-pill ${issue.state}`}>{open ? <IssueOpenIcon /> : <IssueClosedIcon />} {open ? 'Open' : 'Closed'}</span>
          <span className="muted">
            <strong className="fg">{issue.author}</strong> opened this issue <span title={fullDate(issue.createdAt)}>{timeAgo(issue.createdAt)}</span>
            {' · '}{commentCount} {commentCount === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      </div>
      {error && <div className="flash error">{error}</div>}

      <div className="issue-timeline">
        <div className="comment-box">
          <div className="comment-head">
            <Avatar name={issue.author} /> <strong>{issue.author}</strong> <span className="muted">opened <span title={fullDate(issue.createdAt)}>{timeAgo(issue.createdAt)}</span></span>
            <span className="spacer" />
            {editing !== 'body' && <button className="link-btn small" onClick={() => { setDraftBody(issue.body); setEditing('body') }}>Edit</button>}
          </div>
          {editing === 'body' ? (
            <div className="pad">
              <MarkdownEditor value={draftBody} onChange={setDraftBody} onSubmit={() => void act('edit', () => api.updateIssue(rp, number, { body: draftBody })).then((ok) => ok && setEditing(null))} />
              <div className="form-actions no-rule">
                <span className="spacer" />
                <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn primary" disabled={!!busy} onClick={() => void act('edit', () => api.updateIssue(rp, number, { body: draftBody })).then((ok) => ok && setEditing(null))}>Update</button>
              </div>
            </div>
          ) : (
            <div className="comment-body">{issue.body.trim() ? <Markdown source={issue.body} refName={refName} baseDir="" /> : <span className="muted">No description provided.</span>}</div>
          )}
        </div>

        {issue.timeline.map((t, i) => <TimelineItem key={i} t={t} refName={refName} />)}

        <div className="comment-box composer">
          <div className="comment-head"><strong>Add a comment</strong></div>
          <div className="pad">
            <MarkdownEditor value={comment} onChange={setComment} placeholder="Leave a comment (Markdown works, Ctrl+Enter to send)" rows={5} onSubmit={() => comment.trim() && void send()} />
            <div className="form-actions no-rule">
              <span className="spacer" />
              <button className="btn" disabled={!!busy} onClick={() => void toggle()}>
                {open ? <IssueClosedIcon /> : <IssueOpenIcon />}
                {busy === 'state' ? 'Saving…' : open ? (comment.trim() ? 'Close with comment' : 'Close issue') : (comment.trim() ? 'Reopen with comment' : 'Reopen issue')}
              </button>
              <button className="btn primary" disabled={!comment.trim() || !!busy} onClick={() => void send()}>{busy === 'comment' ? 'Saving…' : 'Comment'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ t, refName }: { t: IssueEvent; refName: string }) {
  if (t.kind === 'comment') {
    return (
      <div className="comment-box">
        <div className="comment-head"><Avatar name={t.author} /> <strong>{t.author}</strong> <span className="muted">commented <span title={fullDate(t.at)}>{timeAgo(t.at)}</span></span></div>
        <div className="comment-body"><Markdown source={t.body} refName={refName} baseDir="" /></div>
      </div>
    )
  }
  return (
    <div className="timeline-event">
      <span className={`event-badge ${t.kind}`}>{t.kind === 'closed' ? <IssueClosedIcon /> : <IssueOpenIcon />}</span>
      <span><strong>{t.author}</strong> <span className="muted">{t.kind === 'closed' ? 'closed this' : 'reopened this'} <span title={fullDate(t.at)}>{timeAgo(t.at)}</span></span></span>
    </div>
  )
}
