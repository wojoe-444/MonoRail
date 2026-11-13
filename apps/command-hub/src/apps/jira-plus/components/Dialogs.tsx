import { useEffect, useState } from 'react'
import { Cloud, ExternalLink, Loader2, Lock } from 'lucide-react'

import { navigate } from '@/lib/router'

import { errorText, jiraApi } from '../api'
import { useJira } from '../JiraContext'
import type { Project } from '../types'
import { ErrorNote, Field, Modal } from './Modal'
import { ParentSelect } from './Parent'

const projectId = (p: Project) => `${p.source}:${p.key}`

/** All three app dialogs, driven by JiraContext.dialog. */
export function Dialogs({ onProjectCreated }: { onProjectCreated: (p: Project) => void }) {
  const { dialog, closeDialog } = useJira()
  return (
    <>
      <CreateIssueModal open={dialog?.kind === 'create' || dialog?.kind === 'create-epic' || dialog?.kind === 'create-subtask'} subtask={dialog?.kind === 'create-subtask'} defaultType={dialog?.kind === 'create-epic' ? 'Epic' : undefined} defaultProject={dialog?.project} defaultParent={dialog?.parent} onClose={closeDialog} />
      <Modal
        open={dialog?.kind === 'project'}
        onClose={closeDialog}
        title="Create a private project"
        description="It works like any other Jira project, but lives in a git repo on this computer and is never sent anywhere."
        width={560}
      >
        {dialog?.kind === 'project' && (
          <ProjectForm
            onCancel={closeDialog}
            onCreated={(p) => {
              closeDialog()
              onProjectCreated(p)
            }}
          />
        )}
      </Modal>
      <ConnectModal open={dialog?.kind === 'connect'} onClose={closeDialog} />
    </>
  )
}

function CreateIssueModal({ open, defaultProject, defaultParent, defaultType, subtask, onClose }: { open: boolean; subtask?: boolean; defaultProject?: Project; defaultParent?: string; defaultType?: string; onClose: () => void }) {
  const { projects, priorities, refresh, openIssue } = useJira()
  const [project, setProject] = useState('')
  const [types, setTypes] = useState<string[]>(['Task'])
  const [type, setType] = useState('Task')
  const [priority, setPriority] = useState('Medium')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [labels, setLabels] = useState('')
  const [parent, setParent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // Default to the open project, else your first private project.
  useEffect(() => {
    if (!open) return
    const first = defaultProject ?? projects.find((p) => p.source === 'local') ?? projects[0]
    setProject(first ? projectId(first) : '')
    setSummary('')
    setDescription('')
    setLabels('')
    setParent(defaultParent ?? '')
    setPriority('Medium')
    setError(undefined)
  }, [open, defaultProject, defaultParent, projects])

  const selected = projects.find((p) => projectId(p) === project)
  const selSource = selected?.source
  const selKey = selected?.key

  useEffect(() => {
    if (!open || !selSource || !selKey) return
    let live = true
    setTypes([])
    setType('')
    setError(undefined)
    jiraApi()
      .getIssueTypes({ source: selSource, projectKey: selKey, subtask })
      .then((t) => {
        if (!live) return
        const list = t
        if (!list.length) setError(subtask ? 'No subtask issue types are available for this project.' : 'No issue types are available for this project.')
        setTypes(list)
        setType(subtask ? (list[0] ?? '') : defaultType ? (list.find((t) => t.toLowerCase() === defaultType.toLowerCase()) ?? '') : (list.includes('Task') ? 'Task' : (list[0] ?? '')))
      })
      .catch(() => { if (live) { setTypes([]); setType(''); setError('Could not load issue types for this project.') } })
    return () => {
      live = false
    }
  }, [open, selSource, selKey, defaultType, subtask])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(undefined)
    try {
      const issue = await jiraApi().createIssue({
        source: selected.source,
        projectKey: selected.key,
        summary,
        description,
        type,
        priority: selected.source === 'local' ? priority : undefined,
        parent: parent || undefined,
        labels: labels
          .split(',')
          .map((l) => l.trim().replace(/\s+/g, '-'))
          .filter(Boolean),
      })
      onClose()
      await refresh()
      openIssue(issue.source, issue.key)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const locals = projects.filter((p) => p.source === 'local')
  const team = projects.filter((p) => p.source === 'jira')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subtask ? 'Create subtask' : defaultType ? 'Create epic' : 'Create issue'}
      width={760}
      footer={
        <>
          <button type="button" className="jp-btn jp-btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="jp-create" className="jp-btn jp-btn-primary" disabled={busy || !summary.trim() || !selected || !type || (subtask && !parent)}>
            {busy && <Loader2 className="animate-spin" />} Create
          </button>
        </>
      }
    >
      <form id="jp-create" onSubmit={submit}>
        <p className="mb-4 text-xs text-(--jp-subtle)">
          Required fields are marked with an asterisk <span className="text-(--jp-danger)">*</span>
        </p>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field id="jp-c-project" label="Project" required>
            <select id="jp-c-project" className="jp-field" value={project} disabled={subtask} onChange={(e) => (setProject(e.target.value), setParent(''))}>
              {locals.length > 0 && (
                <optgroup label="Private (local repo)">
                  {locals.map((p) => (
                    <option key={projectId(p)} value={projectId(p)}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </optgroup>
              )}
              {team.length > 0 && (
                <optgroup label="Team Jira">
                  {team.map((p) => (
                    <option key={projectId(p)} value={projectId(p)}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
          <Field id="jp-c-type" label="Issue type" required>
            <select id="jp-c-type" className="jp-field" value={type} disabled={!!defaultType || (subtask && types.length <= 1)} onChange={(e) => setType(e.target.value)}>
              {!type && <option value="">{error ? 'Issue types unavailable' : types.length ? 'Epic is not available in this project' : 'Loading issue types…'}</option>}
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div
          className="mb-4 flex items-start gap-2 rounded-[3px] px-3 py-2 text-xs"
          style={{ background: selected?.source === 'jira' ? 'var(--jp-info-bg)' : 'var(--jp-local-bg)' }}
        >
          {selected?.source === 'jira' ? (
            <span>This creates a real issue in {selected.name} on your team's Jira, visible to your team.</span>
          ) : (
            <span className="flex items-center gap-1.5 text-(--jp-local)">
              <Lock className="size-3" /> Private: committed to your local repo and never leaves this computer.
            </span>
          )}
        </div>
        <Field id="jp-c-summary" label="Summary" required>
          <input id="jp-c-summary" autoFocus className="jp-field" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field id="jp-c-desc" label="Description">
          <textarea id="jp-c-desc" rows={6} className="jp-field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {selected?.source === 'local' && (
            <Field id="jp-c-priority" label="Priority">
              <select id="jp-c-priority" className="jp-field" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {priorities.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          )}
          <Field id="jp-c-labels" label="Labels" hint="Comma separated">
            <input id="jp-c-labels" className="jp-field" value={labels} onChange={(e) => setLabels(e.target.value)} />
          </Field>
          {selected && (
            <Field id="jp-c-parent" label="Parent" hint="An epic, story or task in this project">
              <ParentSelect id="jp-c-parent" source={selected.source} projectKey={selected.key} value={parent} onChange={setParent} disabled={subtask} />
            </Field>
          )}
        </div>
        <ErrorNote error={error} />
      </form>
    </Modal>
  )
}

function suggestKey(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '')
  return key.replace(/^[0-9]+/, '').slice(0, 6)
}

/** Name + key form for a new private project. Also used by the first-run screen. */
export function ProjectForm({ onCreated, onCancel, submitLabel = 'Create project' }: { onCreated: (p: Project) => void; onCancel?: () => void; submitLabel?: string }) {
  const { refresh } = useJira()
  const [name, setName] = useState('Personal')
  const [key, setKey] = useState('ME')
  const [keyTouched, setKeyTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const p = await jiraApi().createLocalProject({ key, name })
      await refresh()
      onCreated(p)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="pb-4">
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_140px]">
        <Field id="jp-p-name" label="Name" required>
          <input
            id="jp-p-name"
            className="jp-field"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!keyTouched) setKey(suggestKey(e.target.value))
            }}
          />
        </Field>
        <Field id="jp-p-key" label="Key" required hint="Issue prefix, e.g. ME-12">
          <input
            id="jp-p-key"
            className="jp-field"
            value={key}
            maxLength={10}
            onChange={(e) => {
              setKeyTouched(true)
              setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }}
          />
        </Field>
      </div>
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="jp-btn jp-btn-subtle" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="jp-btn jp-btn-primary" disabled={busy || !name.trim() || key.length < 2}>
          {busy && <Loader2 className="animate-spin" />} {submitLabel}
        </button>
      </div>
    </form>
  )
}

function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { overview, refresh } = useJira()
  const connection = overview?.connection
  const [scopeJql, setScopeJql] = useState('')
  const [busy, setBusy] = useState<'save' | 'forget'>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setScopeJql(connection?.scopeJql ?? 'assignee = currentUser()')
    setError(undefined)
  }, [open, connection])

  const connected = !!connection?.connected
  const legacy = connection?.via === 'legacy'

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy('save')
    setError(undefined)
    try {
      await jiraApi().saveSettings({ scopeJql })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(undefined)
    }
  }

  async function forget() {
    setBusy('forget')
    setError(undefined)
    try {
      await jiraApi().forgetLegacyConnection()
      await refresh()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(undefined)
    }
  }

  /** The Atlassian account is managed by the hub, so this leaves the app for its Connections page. */
  function openConnections() {
    onClose()
    navigate('/connections')
  }

  const site = connection?.siteUrl?.replace(/^https:\/\//, '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Team Jira"
      description="Your team projects appear next to your private ones. Jira+ signs in with the Atlassian account from MonoRail's Connections page, so you see and change exactly what you can in Jira."
      width={600}
      footer={
        <>
          <button type="button" className="jp-btn jp-btn-subtle mr-auto" onClick={openConnections}>
            <ExternalLink /> {connected && !legacy ? 'Manage in Connections' : 'Open Connections'}
          </button>
          <button type="button" className="jp-btn jp-btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="jp-connect" className="jp-btn jp-btn-primary" disabled={!!busy}>
            {busy === 'save' && <Loader2 className="animate-spin" />} Save
          </button>
        </>
      }
    >
      <form id="jp-connect" onSubmit={save}>
        <div className="mb-4 rounded-[3px] bg-(--jp-sunken) px-3 py-2 text-sm">
          {connected ? (
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-(--jp-type-story)" />
              <span>
                Connected to <span className="font-medium">{site}</span>
                {connection?.displayName && <> as {connection.displayName}</>}
                {legacy ? ' with the token saved in Jira+.' : ' through Connections.'}
              </span>
            </div>
          ) : connection?.error ? (
            <div className="flex items-start gap-2">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-(--jp-pri-medium)" />
              <span>Team Jira is unavailable: {connection.error}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-(--jp-subtle)">
              <Cloud className="mt-0.5 size-4 shrink-0" />
              <span>
                Not connected. Add an Atlassian connection (site, email and API token) on the{' '}
                <button type="button" className="jp-link" onClick={openConnections}>
                  Connections page
                </button>
                , then come back here. Your private projects work without it.
              </span>
            </div>
          )}
        </div>
        {legacy && (
          <div className="mb-4 flex items-start gap-3 rounded-[3px] bg-(--jp-warning-bg) px-3 py-2 text-xs text-(--jp-warning-fg)">
            <span className="flex-1">
              This token was saved by an earlier version of Jira+. Add the same account on the Connections page, then forget the copy here.
              Once Connections has an Atlassian account, Jira+ uses that one.
            </span>
            <button type="button" className="jp-btn h-7 shrink-0" disabled={!!busy} onClick={forget}>
              {busy === 'forget' && <Loader2 className="animate-spin" />} Forget saved token
            </button>
          </div>
        )}
        <Field id="jp-j-jql" label="Which team issues to show (JQL)" hint="Default: issues assigned to you. Done issues drop off after 14 days.">
          <input id="jp-j-jql" className="jp-field font-mono text-xs" value={scopeJql} onChange={(e) => setScopeJql(e.target.value)} />
        </Field>
        <div className="mb-4 flex items-start gap-2 rounded-[3px] bg-(--jp-sunken) px-3 py-2 text-xs text-(--jp-subtle)">
          <Lock className="mt-0.5 size-3 shrink-0" />
          <span>The filter is saved on this computer, in MonoRail's data folder. Your API token is kept by Connections, not by Jira+.</span>
        </div>
        <ErrorNote error={error} />
      </form>
    </Modal>
  )
}
