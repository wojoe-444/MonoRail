import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { api } from '../api'
import MarkdownEditor from '../components/MarkdownEditor'
import { issueLink, issuesLink } from '../links'

export default function NewIssuePage() {
  const { repo } = useRepo()
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const i = await api.createIssue(repo!.path, title, body)
      nav(issueLink(i.number), { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="issue-new">
      <h2>New issue</h2>
      {error && <div className="flash error">{error}</div>}
      <div className="box pad issue-form">
        <label className="field-label" htmlFor="issue-title">Title</label>
        <input id="issue-title" className="text-input" autoFocus maxLength={256} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) void submit() }} />
        <label className="field-label">Description</label>
        <MarkdownEditor value={body} onChange={setBody} placeholder="Add a description (Markdown works)" onSubmit={() => title.trim() && void submit()} />
        <div className="form-actions">
          <span className="spacer" />
          <Link className="btn" to={issuesLink()}>Cancel</Link>
          <button className="btn primary" disabled={!title.trim() || busy} onClick={() => void submit()}>{busy ? 'Creating…' : 'Create issue'}</button>
        </div>
      </div>
    </div>
  )
}
