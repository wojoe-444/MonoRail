import { useEffect, useState } from 'react'
import { AlertTriangle, KeyRound, Loader2, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import { errorText, jiraApi } from '../api'
import type { Connection, Issue, Project } from '../types'

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">{error}</span>
    </div>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---------- Create ticket ----------

interface CreateIssueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  defaultProject?: Project
  priorities: string[]
  onCreated: (issue: Issue) => void
}

const projectId = (p: Project) => `${p.source}:${p.key}`

export function CreateIssueDialog({ open, onOpenChange, projects, defaultProject, priorities, onCreated }: CreateIssueDialogProps) {
  const [project, setProject] = useState<string>('')
  const [types, setTypes] = useState<string[]>(['Task'])
  const [type, setType] = useState('Task')
  const [priority, setPriority] = useState('Medium')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [labels, setLabels] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // Default to the open project, else your first local project.
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

  useEffect(() => {
    if (!selected) return
    let live = true
    jiraApi()
      .getIssueTypes({ source: selected.source, projectKey: selected.key })
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
  }, [selected?.source, selected?.key]) // eslint-disable-line react-hooks/exhaustive-deps

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
      onCreated(issue)
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const locals = projects.filter((p) => p.source === 'local')
  const team = projects.filter((p) => p.source === 'jira')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create ticket</DialogTitle>
          <DialogDescription>
            {selected?.source === 'jira'
              ? `Creates the ticket in ${selected.name} on your team's Jira.`
              : 'Personal tickets are committed to your local repo and never leave this computer.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="ci-project" label="Project">
              <NativeSelect id="ci-project" value={project} onChange={(e) => setProject(e.target.value)}>
                {locals.length > 0 && (
                  <optgroup label="Personal">
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
              </NativeSelect>
            </Field>
            <Field id="ci-type" label="Type">
              <NativeSelect id="ci-type" value={type} onChange={(e) => setType(e.target.value)}>
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field id="ci-summary" label="Summary">
            <Input id="ci-summary" autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What needs doing?" />
          </Field>
          <Field id="ci-desc" label="Description">
            <Textarea id="ci-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selected?.source === 'local' && (
              <Field id="ci-priority" label="Priority">
                <NativeSelect id="ci-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {priorities.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field id="ci-labels" label="Labels" hint="Comma separated">
              <Input id="ci-labels" value={labels} onChange={(e) => setLabels(e.target.value)} />
            </Field>
          </div>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !summary.trim() || !selected}>
              {busy && <Loader2 className="animate-spin" />} Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- New personal project ----------

export function suggestKey(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '')
  return key.replace(/^[0-9]+/, '').slice(0, 6)
}

export function ProjectForm({ onCreated, submitLabel = 'Create project', onCancel }: { onCreated: (p: Project) => void; submitLabel?: string; onCancel?: () => void }) {
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
      onCreated(await jiraApi().createLocalProject({ key, name }))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
        <Field id="np-name" label="Name">
          <Input
            id="np-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!keyTouched) setKey(suggestKey(e.target.value))
            }}
          />
        </Field>
        <Field id="np-key" label="Key" hint="Ticket prefix, e.g. ME-12">
          <Input
            id="np-key"
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
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy || !name.trim() || key.length < 2}>
          {busy && <Loader2 className="animate-spin" />} {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function NewProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (p: Project) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New personal project</DialogTitle>
          <DialogDescription>A project in your local repo. It works like any other Jira project and stays on this computer.</DialogDescription>
        </DialogHeader>
        {open && (
          <ProjectForm
            onCancel={() => onOpenChange(false)}
            onCreated={(p) => {
              onCreated(p)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------- Connect Jira ----------

interface ConnectDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  connection?: Connection
  onSaved: (c: Connection) => void
}

export function ConnectJiraDialog({ open, onOpenChange, connection, onSaved }: ConnectDialogProps) {
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
      onSaved(await jiraApi().saveConnection({ siteUrl, email, token, scopeJql }))
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(undefined)
    }
  }

  async function disconnect() {
    setBusy('disconnect')
    try {
      onSaved(await jiraApi().disconnect())
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <KeyRound className="size-5" />
          </div>
          <DialogTitle>{connected ? 'Team Jira connection' : 'Connect your team Jira'}</DialogTitle>
          <DialogDescription>
            MonoRail talks to Jira Cloud with your own API token, so you see and change exactly what you can in Jira.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field id="cj-site" label="Jira site">
            <Input id="cj-site" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="your-team.atlassian.net" />
          </Field>
          <Field id="cj-email" label="Email">
            <Input id="cj-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field
            id="cj-token"
            label="API token"
            hint={
              <>
                Create one at{' '}
                <a className="text-primary underline-offset-4 hover:underline" href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
                  id.atlassian.com › Security › API tokens
                </a>
                .{connected && ' Leave empty to keep the saved token.'}
              </>
            }
          >
            <Input
              id="cj-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={connected ? '••••••••••••' : ''}
            />
          </Field>
          <Field id="cj-jql" label="Which tickets to show (JQL)" hint="Default: tickets assigned to you. Done tickets drop off after 14 days.">
            <Input id="cj-jql" className="font-mono text-xs" value={scopeJql} onChange={(e) => setScopeJql(e.target.value)} />
          </Field>
          <div className="flex items-start gap-2 rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Saved only on this computer, in MonoRail's data folder (Settings shows where). The token is encrypted with Windows' data protection and is never shown again.
            </span>
          </div>
          <ErrorNote error={error} />
          <DialogFooter className="sm:justify-between">
            {connected ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={!!busy} onClick={disconnect}>
                {busy === 'disconnect' && <Loader2 className="animate-spin" />} Disconnect
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!!busy || !siteUrl.trim() || !email.trim() || (!connected && !token.trim())}>
                {busy === 'save' && <Loader2 className="animate-spin" />} {connected ? 'Save' : 'Connect'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
