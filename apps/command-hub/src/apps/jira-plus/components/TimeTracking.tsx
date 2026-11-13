import { useEffect, useState } from 'react'
import { Clock, Loader2, Plus, Trash2 } from 'lucide-react'

import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { errorText, jiraApi } from '../api'
import { Avatar, Lozenge, PriorityIcon, TypeIcon } from '../bits'
import { formatDuration, parseDuration } from '../time'
import type { IssueDetail, Worklog } from '../types'
import { ErrorNote, Field, Modal } from './Modal'

/** The Time tracking row in Details: logged here, the total with child issues, and "Log time". */
export function TimeSummary({ issue, disabled, onLog }: { issue: IssueDetail; disabled: boolean; onLog: () => void }) {
  const { spentSeconds, totalSeconds } = issue.timeTracking
  const fromChildren = totalSeconds - spentSeconds
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={cn('font-mono whitespace-nowrap tabular-nums', !spentSeconds && 'text-(--jp-subtle)')}>
          {spentSeconds ? formatDuration(spentSeconds) : 'None'}
        </span>
        <span className="text-(--jp-subtle)">logged</span>
        <button type="button" className="jp-btn jp-btn-subtle ml-auto h-7 px-2" disabled={disabled} onClick={onLog}>
          <Clock /> Log time
        </button>
      </div>
      {fromChildren > 0 && (
        <div className="text-xs text-(--jp-subtle)">
          <span className="font-mono font-semibold text-(--jp-text) tabular-nums">{formatDuration(totalSeconds)}</span> with child issues
        </div>
      )}
    </div>
  )
}

function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Log time": how long, when it started, and what was done. */
export function LogTimeDialog({ issue, open, onClose, onLogged }: { issue?: IssueDetail; open: boolean; onClose: () => void; onLogged: () => void }) {
  const [spent, setSpent] = useState('')
  const [started, setStarted] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setSpent('')
    setComment('')
    setError(undefined)
    setStarted(localInputValue(new Date()))
  }, [open])

  const seconds = parseDuration(spent)
  const bad = spent.trim() !== '' && seconds === undefined

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!issue || !seconds) return
    setBusy(true)
    setError(undefined)
    try {
      await jiraApi().logWork({ source: issue.source, key: issue.key, seconds, started: new Date(started).toISOString(), comment })
      onLogged()
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log time on ${issue?.key ?? ''}`}
      description={issue?.source === 'jira' ? 'Adds a worklog to the ticket in your team Jira.' : 'Saved with the ticket in your private local repo.'}
      width={520}
      footer={
        <>
          <button type="button" className="jp-btn jp-btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="jp-log" className="jp-btn jp-btn-primary" disabled={busy || !seconds}>
            {busy && <Loader2 className="animate-spin" />} Log {seconds ? formatDuration(seconds) : 'time'}
          </button>
        </>
      }
    >
      <form id="jp-log" onSubmit={submit}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field id="jp-l-spent" label="Time spent" required hint={bad ? <span className="text-(--jp-danger)">Try 2h 30m, 45m or 1.5</span> : 'Like 2h 30m, 45m or 1d (8h)'}>
            <input id="jp-l-spent" autoFocus className="jp-field font-mono" placeholder="2h 30m" value={spent} onChange={(e) => setSpent(e.target.value)} />
          </Field>
          <Field id="jp-l-started" label="Started" required>
            <input id="jp-l-started" type="datetime-local" className="jp-field" value={started} onChange={(e) => setStarted(e.target.value)} />
          </Field>
        </div>
        <Field id="jp-l-comment" label="What did you work on?">
          <textarea id="jp-l-comment" rows={3} className="jp-field" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
      </form>
    </Modal>
  )
}

/** The Work log tab in Activity. */
export function WorklogList({ issue, onDelete, busy }: { issue: IssueDetail; onDelete: (w: Worklog) => void; busy: boolean }) {
  if (!issue.worklogs.length) return <p className="text-(--jp-subtle)">No time logged yet.</p>
  return (
    <ol className="flex flex-col gap-4">
      {issue.worklogs.map((w) => (
        <li key={w.id} className="group flex gap-3">
          <Avatar name={w.author} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{w.author}</span>
              <span>
                logged <span className="font-mono font-semibold tabular-nums">{formatDuration(w.seconds)}</span>
              </span>
              <span className="text-xs text-(--jp-subtle)" title={new Date(w.started).toLocaleString()}>
                {formatRelative(w.started)}
              </span>
              <button
                type="button"
                disabled={busy}
                className="jp-btn jp-btn-subtle ml-auto size-7 px-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Delete this time log"
                title="Delete this time log"
                onClick={() => onDelete(w)}
              >
                <Trash2 />
              </button>
            </div>
            {w.comment && <p className="mt-1 leading-6 break-words whitespace-pre-wrap">{w.comment}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Child issues under the description: progress, one row each, and "Add child issue". */
export function ChildIssues({ issue, onOpen, onAdd, onAddSubtask }: { issue: IssueDetail; onOpen: (key: string) => void; onAdd: () => void; onAddSubtask?: () => void }) {
  const kids = issue.children
  const done = kids.filter((c) => c.statusCategory === 'done').length
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-semibold">Child issues</h2>
        {onAddSubtask && <button type="button" className="jp-btn jp-btn-subtle ml-auto h-7 px-2" onClick={onAddSubtask}><Plus /> Add subtask</button>}
        <button type="button" className={cn("jp-btn jp-btn-subtle h-7 px-2", !onAddSubtask && "ml-auto")} onClick={onAdd}>
          <Plus /> Add child issue
        </button>
      </div>
      {kids.length === 0 ? null : (
        <>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-(--jp-hover)" role="progressbar" aria-valuemin={0} aria-valuemax={kids.length} aria-valuenow={done}>
              <div className="h-full rounded-full bg-(--jp-lz-done-fg)" style={{ width: `${(done / kids.length) * 100}%` }} />
            </div>
            <span className="text-xs whitespace-nowrap text-(--jp-subtle)">
              {done} of {kids.length} done
            </span>
          </div>
          <ul className="overflow-hidden rounded-[3px] border border-(--jp-border)">
            {kids.map((c) => (
              <li key={c.key} className="border-b border-(--jp-border) last:border-b-0">
                <button type="button" onClick={() => onOpen(c.key)} className="jp-focusable flex h-10 w-full items-center gap-2 px-3 text-left outline-none hover:bg-(--jp-hover)">
                  <TypeIcon type={c.type} />
                  <span className={cn('text-xs font-semibold whitespace-nowrap text-(--jp-link)', c.statusCategory === 'done' && 'line-through')}>{c.key}</span>
                  <span className="min-w-0 flex-1 truncate">{c.summary}</span>
                  {!!c.timeSpentSeconds && <span className="font-mono text-xs text-(--jp-subtle) tabular-nums">{formatDuration(c.timeSpentSeconds)}</span>}
                  <PriorityIcon priority={c.priority} />
                  <Lozenge status={c.status} category={c.statusCategory} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
