import { useCallback, useEffect, useState } from 'react'
import { useRepo } from '../RepoContext'
import { api } from '../api'
import type { BackupSchedule, BackupState, BackupUnit } from '../types'
import { formatSize, fullDate, timeAgo } from '../util'

const DEFAULTS: BackupSchedule = { enabled: true, times: 1, unit: 'day', keep: 14, destination: '' }
const UNITS: BackupUnit[] = ['hour', 'day', 'week']

const sameSchedule = (a: BackupSchedule | null, b: BackupSchedule) =>
  !!a && a.enabled === b.enabled && a.times === b.times && a.unit === b.unit && a.keep === b.keep && a.destination === b.destination

/** Scheduled backups for the open repo: X times per hour/day/week into a folder on this machine. */
export default function BackupsPage() {
  const { repo } = useRepo()
  const rp = repo!.path
  const [state, setState] = useState<BackupState | null>(null)
  const [form, setForm] = useState<BackupSchedule>(DEFAULTS)
  const [busy, setBusy] = useState<'save' | 'run' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (resetForm: boolean) => {
    try {
      const s = await api.getBackup(rp)
      setState(s)
      if (resetForm) setForm(s.schedule ?? DEFAULTS)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [rp])

  useEffect(() => {
    void load(true)
    // The scheduler runs in the background; keep the status current while this page is open.
    const t = setInterval(() => void load(false), 30_000)
    return () => clearInterval(t)
  }, [load])

  const act = async (kind: 'save' | 'run' | 'remove', fn: () => Promise<BackupState>, done: string) => {
    setBusy(kind); setError(null); setNotice(null)
    try {
      const s = await fn()
      setState(s)
      if (kind !== 'run') setForm(s.schedule ?? DEFAULTS)
      setNotice(done)
    } catch (e) {
      setError((e as Error).message)
      void load(false)
    } finally {
      setBusy(null)
    }
  }

  const choose = async () => {
    const dir = await api.pickBackupFolder().catch((e: Error) => { setError(e.message); return null })
    if (dir) setForm((f) => ({ ...f, destination: dir }))
  }

  const set = <K extends keyof BackupSchedule>(k: K, v: BackupSchedule[K]) => setForm((f) => ({ ...f, [k]: v }))
  const saved = state?.schedule ?? null
  const dirty = !sameSchedule(saved, form)
  const last = state?.lastResult

  return (
    <div>
      <h2>Backups</h2>
      <p className="muted">
        Copy <strong>{repo!.name}</strong> to another folder on this computer on a schedule, for example a folder that OneDrive already syncs.
        Each backup is one <span className="mono">.bundle</span> file with every branch, tag and commit. Uncommitted changes are not included.
      </p>
      {error && <div className="flash error">{error}</div>}
      {notice && !error && <div className="flash ok">{notice}</div>}

      <div className="box">
        <div className="box-head"><strong>Schedule</strong></div>
        <div className="pad form">
          <label className="check-row">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            Back up automatically
          </label>

          <div className="form-row">
            <span className="form-label">How often</span>
            <span className="inline-fields">
              <input className="num" type="number" min={1} max={24} value={form.times}
                onChange={(e) => set('times', Math.max(1, Math.min(24, Math.trunc(Number(e.target.value)) || 1)))} />
              <span>{form.times === 1 ? 'time' : 'times'} per</span>
              <select value={form.unit} onChange={(e) => set('unit', e.target.value as BackupUnit)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </span>
          </div>

          <div className="form-row">
            <span className="form-label">Save to</span>
            <span className="inline-fields grow">
              <input className="path mono" readOnly placeholder="No folder chosen" value={form.destination} title={form.destination} />
              <button className="btn" onClick={choose}>Choose folder…</button>
            </span>
          </div>
          {form.destination && (
            <div className="form-hint muted small">Backups go in <span className="mono">{form.destination.replace(/[\\/]+$/, '')}/{repo!.name}/</span></div>
          )}

          <div className="form-row">
            <span className="form-label">Keep</span>
            <span className="inline-fields">
              the newest
              <input className="num" type="number" min={1} max={365} value={form.keep}
                onChange={(e) => set('keep', Math.max(1, Math.min(365, Math.trunc(Number(e.target.value)) || 1)))} />
              backups, delete older ones
            </span>
          </div>

          <div className="form-actions">
            <button className="btn primary" disabled={!dirty || !form.destination || !!busy}
              onClick={() => act('save', () => api.saveBackup(rp, form), form.enabled ? 'Saved. Backups will run in Command Hub while it is open, and catch up when it next opens.' : 'Saved. Automatic backups are off.')}>
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button className="btn" disabled={!saved || dirty || !!busy || state?.running}
              title={dirty ? 'Save your changes first' : undefined}
              onClick={() => act('run', () => api.runBackup(rp), 'Backup complete.')}>
              {busy === 'run' || state?.running ? 'Backing up…' : 'Back up now'}
            </button>
            <span className="spacer" />
            {saved && (
              <button className="btn danger" disabled={!!busy}
                onClick={() => act('remove', () => api.removeBackup(rp), 'Backup settings removed. Existing backup files were left in place.')}>
                Remove schedule
              </button>
            )}
          </div>
        </div>
      </div>

      {saved && (
        <div className="box">
          <div className="box-head"><strong>Status</strong></div>
          <div className="pad status-grid">
            <span className="muted">Last backup</span>
            <span>
              {!last ? <span className="muted">None yet</span>
                : last.ok ? <><span className="add">Succeeded</span> <span title={fullDate(last.at)}>{timeAgo(last.at)}</span> · {formatSize(last.size)}</>
                : <><span className="del">Failed</span> <span title={fullDate(last.at)}>{timeAgo(last.at)}</span>: {last.error}</>}
            </span>
            <span className="muted">Next backup</span>
            <span>
              {!saved.enabled ? <span className="muted">Automatic backups are off</span>
                : state?.nextDueAt ? (Date.parse(state.nextDueAt) <= Date.now() ? 'Due now' : <span title={fullDate(state.nextDueAt)}>{timeAgo(state.nextDueAt)}</span>)
                : '—'}
            </span>
          </div>
        </div>
      )}

      {saved && (
        <div className="box">
          <div className="box-head"><strong>Backups in this folder</strong><span className="spacer" /><span className="muted small">{state?.files.length ?? 0}</span></div>
          {state?.files.length ? (
            <table className="files">
              <tbody>
                {state.files.map((f) => (
                  <tr key={f.path}>
                    <td className="name mono" title={f.path}>{f.name}</td>
                    <td className="msg muted">{formatSize(f.size)}</td>
                    <td className="when muted" title={fullDate(f.createdAt)}>{timeAgo(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="pad muted">No backups yet.</div>}
          <div className="pad muted small restore-hint">
            To restore, clone a backup: <span className="mono">git clone "&lt;backup file&gt;" {repo!.name}-restored</span>
          </div>
        </div>
      )}
    </div>
  )
}
