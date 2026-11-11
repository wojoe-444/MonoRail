import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { navigate } from '@/lib/router'
import { useAsync, useRepo } from '../RepoContext'
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
  // Off on every new issue: an issue goes to GitHub only when it is turned on for that issue.
  const [onGitHub, setOnGitHub] = useState(false)
  const target = useAsync(() => api.githubTarget(repo!.path), [repo!.path])
  const gh = target.data

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const i = await api.createIssue(repo!.path, title, body, onGitHub && !!gh?.repo && gh.connected)
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
        {gh?.repo && (
          <div className="issue-gh-toggle">
            <label className="check-row normal">
              <input type="checkbox" checked={onGitHub} disabled={!gh.connected || busy} onChange={(e) => setOnGitHub(e.target.checked)} />
              <span>Also create it on GitHub in <strong>{gh.repo}</strong></span>
            </label>
            <div className="small muted settings-hint">
              {!gh.connected
                ? <>Set up GitHub on the <button className="link-btn" onClick={() => navigate('/connections')}>Connections</button> page to use this.</>
                : onGitHub
                  ? 'Everyone who watches the repository on GitHub will see it. Later edits and comments here stay local.'
                  : 'Off: the issue stays in this repository on this computer, and nobody else sees it.'}
            </div>
          </div>
        )}
        <div className="form-actions">
          <span className="spacer" />
          <Link className="btn" to={issuesLink()}>Cancel</Link>
          <button className="btn primary" disabled={!title.trim() || busy} onClick={() => void submit()}>{busy ? 'Creating…' : onGitHub && gh?.connected && gh.repo ? 'Create on GitHub' : 'Create issue'}</button>
        </div>
      </div>
    </div>
  )
}
