import { useEffect, useMemo, useState } from 'react'
import { useAsync, useRepo } from '../RepoContext'
import { api } from '../api'
import { jiraApi } from '../../jira-plus/api'
import { openInJiraPlus } from '../../jira-plus/handoff'
import type { Issue as JiraIssue } from '../../jira-plus/types'
import type { LinkedTask } from '../types'
import { TaskIcon } from '../components/Icons'
import { timeAgo } from '../util'

const STATE_CLASS: Record<string, string> = { todo: 'task-todo', in_progress: 'task-progress', done: 'task-done' }

/**
 * Jira+ tasks linked to this repo, by its folder or its github.com remote.
 * Jira+ keeps the links (in its own data folder); nothing is written to the
 * repo, to Jira or to GitHub. A task opens in Jira+.
 */
export default function TasksPage() {
  const { repo } = useRepo()
  const rp = repo!.path
  const [tasks, setTasks] = useState<LinkedTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    api.linkedTasks(rp).then((t) => live && setTasks(t), (e: Error) => live && setError(e.message))
    return () => { live = false }
  }, [rp])

  async function run(fn: () => Promise<LinkedTask[]>) {
    setBusy(true)
    setError(null)
    try {
      setTasks(await fn())
      setPicking(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <span className="muted">Jira+ tasks linked to <strong>{repo!.name}</strong>. Links are kept in MonoRail on this computer; nothing is written to the repo, Jira or GitHub.</span>
        <span className="spacer" />
        {!picking && <button className="btn primary" onClick={() => setPicking(true)}>Link a task</button>}
      </div>
      {error && <div className="flash error">{error}</div>}
      {picking && <TaskPicker busy={busy} linked={tasks ?? []} onPick={(t) => run(() => api.linkTask(rp, t.source, t.key))} onCancel={() => setPicking(false)} />}
      <div className="box">
        <div className="box-head"><TaskIcon /> <strong>{tasks ? `${tasks.length} linked task${tasks.length === 1 ? '' : 's'}` : 'Linked tasks'}</strong></div>
        {tasks === null && !error && <div className="pad muted">Loading…</div>}
        {tasks?.length === 0 && (
          <div className="pad muted center">No tasks are linked to this repository yet. Link one here, or from a task&apos;s Repositories in Jira+.</div>
        )}
        {tasks?.map((t) => (
          <div key={`${t.source}:${t.key}`} className="issue-row">
            <span className={STATE_CLASS[t.statusCategory ?? ''] ?? 'muted'}><TaskIcon /></span>
            <div className="grow-input">
              <button className="link-btn issue-title" onClick={() => openInJiraPlus(t.source, t.key)} title="Open in Jira+">
                {t.summary ?? t.key}
              </button>
              <div className="muted small">
                <span className="mono">{t.key}</span>
                {t.status && <> · {t.status}</>}
                {t.projectName && <> · {t.projectName}</>}
                <span className="badge">{t.source === 'local' ? 'Jira+ local' : 'Team Jira'}</span>
                <span> · linked {timeAgo(t.linkedAt)}</span>
                {t.error && <span className="task-error"> · {t.error}</span>}
              </div>
            </div>
            <button className="btn" disabled={busy} onClick={() => void run(() => api.unlinkTask(rp, t))} title="Remove this link (the task itself is kept)">Unlink</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pick a Jira+ task to link: your local tickets and the team Jira tickets Jira+ shows. */
function TaskPicker({ busy, linked, onPick, onCancel }: { busy: boolean; linked: LinkedTask[]; onPick: (t: JiraIssue) => void; onCancel: () => void }) {
  const all = useAsync(() => jiraApi().listIssues({ source: 'all' }), [])
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const taken = new Set(linked.map((t) => `${t.source}:${t.key}`))
    const query = q.trim().toLowerCase()
    return (all.data ?? [])
      .filter((i) => !taken.has(`${i.source}:${i.key}`))
      .filter((i) => !query || i.key.toLowerCase().includes(query) || i.summary.toLowerCase().includes(query))
      .slice(0, 50)
  }, [all.data, linked, q])

  return (
    <div className="box">
      <div className="box-head">
        <input
          autoFocus
          className="text-input grow-input"
          placeholder="Find a task by key or summary"
          aria-label="Find a task"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        />
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
      {all.loading && <div className="pad muted">Loading tasks from Jira+…</div>}
      {all.error && <div className="flash error">{all.error}</div>}
      {!all.loading && rows.length === 0 && <div className="pad muted">{q ? `No task matches "${q}".` : 'No tasks to link. Create one in Jira+ first.'}</div>}
      <div className="task-pick-list">
        {rows.map((i) => (
          <button key={`${i.source}:${i.key}`} className="task-pick" disabled={busy} onClick={() => onPick(i)}>
            <span className="mono muted">{i.key}</span>
            <span className="ellipsis grow-input">{i.summary}</span>
            <span className="muted small">{i.status}</span>
            <span className="badge">{i.source === 'local' ? 'Jira+ local' : 'Team Jira'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
