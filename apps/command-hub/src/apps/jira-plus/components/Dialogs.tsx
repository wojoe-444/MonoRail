import { useEffect, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'

import { errorText, jiraApi } from '../api'
import { useJira } from '../JiraContext'
import type { Project } from '../types'
import { ErrorNote, Field, Modal } from './Modal'

const projectId = (p: Project) => `${p.source}:${p.key}`

/** All three app dialogs, driven by JiraContext.dialog. */
export function Dialogs({ onProjectCreated }: { onProjectCreated: (p: Project) => void }) {
  const { dialog, closeDialog } = useJira()
  return (
    <>
      <CreateIssueModal open={dialog?.kind === 'create'} defaultProject={dialog?.project} onClose={closeDialog} />
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

function CreateIssueModal({ open, defaultProject, onClose }: { open: boolean; defaultProject?: Project; onClose: () => void }) {
  const { projects, priorities, refresh, openIssue } = useJira()
  const [project, setProject] = useState('')
  const [types, setTypes] = useState<string[]>(['Task'])
  const [type, setType] = useState('Task')
  const [priority, setPriority] = useState('Medium')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [labels, setLabels] = useState('')
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
    setPriority('Medium')
    setError(undefined)
  }, [open, defaultProject, projects])

  const selected = projects.find((p) => projectId(p) === project)
  const selSource = selected?.source
  const selKey = selected?.key

  useEffect(() => {
    if (!selSource || !selKey) return
    let live = true
    jiraApi()
      .getIssueTypes({ source: selSource, projectKey: selKey })
      .then((t) => {
        if (!live) return
        const list = t.length ? t : ['Task']
        setTypes(list)
        setType((cur) => (list.includes(cur) ? cur : list.includes('Task') ? 'Task' : list[0]))
      })
      .catch(() => live && setTypes(['Task']))
    return () => {
      live = false
    }
  }, [selSource, selKey])

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
      title="Create issue"
      width={760}
      footer={
        <>
          <button type="button" className="jp-btn jp-btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="jp-create" className="jp-btn jp-btn-primary" disabled={busy || !summary.trim() || !selected}>
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
            <select id="jp-c-project" className="jp-field" value={project} onChange={(e) => setProject(e.target.value)}>
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
            <select id="jp-c-type" className="jp-field" value={type} onChange={(e) => setType(e.target.value)}>
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
  const [siteUrl, setSiteUrl] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [scopeJql, setScopeJql] = useState('')
  const [busy, setBusy] = useState<'save' | 'disconnect'>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setSiteUrl(connection?.siteUrl?.replace(/^https:\/\//, '') ?? '')
    setEmail(connection?.email ?? '')
    setToken('')
    setScopeJql(connection?.scopeJql ?? 'assignee = currentUser()')
    setError(undefined)
  }, [open, connection])

  const connected = !!connection?.connected

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy('save')
    setError(undefined)
    try {
      await jiraApi().saveConnection({ siteUrl, email, token, scopeJql })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(undefined)
    }
  }

  async function disconnect() {
    setBusy('disconnect')
    try {
      await jiraApi().disconnect()
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={connected ? 'Team Jira connection' : 'Connect your team Jira'}
      description="Your team projects appear next to your private ones. Jira+ uses your own Atlassian API token, so you see and change exactly what you can in Jira."
      width={600}
      footer={
        <>
          {connected && (
            <button type="button" className="jp-btn jp-btn-subtle mr-auto text-(--jp-danger)" disabled={!!busy} onClick={disconnect}>
              {busy === 'disconnect' && <Loader2 className="animate-spin" />} Disconnect
            </button>
          )}
          <button type="button" className="jp-btn jp-btn-subtle" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="jp-connect"
            className="jp-btn jp-btn-primary"
            disabled={!!busy || !siteUrl.trim() || !email.trim() || (!connected && !token.trim())}
          >
            {busy === 'save' && <Loader2 className="animate-spin" />} {connected ? 'Save' : 'Connect'}
          </button>
        </>
      }
    >
      <form id="jp-connect" onSubmit={save}>
        <Field id="jp-j-site" label="Jira site" required>
          <input id="jp-j-site" className="jp-field" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="your-team.atlassian.net" />
        </Field>
        <Field id="jp-j-email" label="Email" required>
          <input id="jp-j-email" type="email" autoComplete="off" className="jp-field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field
          id="jp-j-token"
          label="API token"
          required={!connected}
          hint={
            <>
              Create one at{' '}
              <a className="jp-link" href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
                id.atlassian.com › Security › API tokens
              </a>
              .{connected && ' Leave empty to keep the saved token.'}
            </>
          }
        >
          <input
            id="jp-j-token"
            type="password"
            autoComplete="off"
            className="jp-field"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={connected ? '••••••••••••' : ''}
          />
        </Field>
        <Field id="jp-j-jql" label="Which team issues to show (JQL)" hint="Default: issues assigned to you. Done issues drop off after 14 days.">
          <input id="jp-j-jql" className="jp-field font-mono text-xs" value={scopeJql} onChange={(e) => setScopeJql(e.target.value)} />
        </Field>
        <div className="mb-4 flex items-start gap-2 rounded-[3px] bg-(--jp-sunken) px-3 py-2 text-xs text-(--jp-subtle)">
          <Lock className="mt-0.5 size-3 shrink-0" />
          <span>Saved only on this computer, in MonoRail's data folder. The token is encrypted with Windows' data protection and is never shown again.</span>
        </div>
        <ErrorNote error={error} />
      </form>
    </Modal>
  )
}
