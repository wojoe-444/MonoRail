import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { errorText, jiraApi } from '../api'
import type { Project, TriggerTemplate } from '../types'
import { ErrorNote, Field, Modal } from '../components/Modal'

export function TriggerTemplates({ project }: { project: Project }) {
  const [items, setItems] = useState<TriggerTemplate[]>()
  const [error, setError] = useState<string>()
  const [editing, setEditing] = useState<TriggerTemplate | 'new'>()
  const [deleting, setDeleting] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [formError, setFormError] = useState<string>()
  useEffect(() => {
    let live = true
    setItems(undefined); setError(undefined)
    jiraApi().listTriggerTemplates({ source: project.source, projectKey: project.key }).then((result) => { if (live) setItems(result) }, (err) => { if (live) setError(errorText(err)) })
    return () => { live = false }
  }, [project.source, project.key])
  function edit(item: TriggerTemplate | 'new') {
    setEditing(item); setSummary(item === 'new' ? '' : item.summary); setDescription(item === 'new' ? '' : item.description)
    setCondition(item === 'new' ? '' : item.condition); setPriority(item === 'new' ? 'Medium' : item.priority); setFormError(undefined)
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing || !summary.trim()) return
    setBusy(true); setFormError(undefined)
    try {
      const saved = await jiraApi().saveTriggerTemplate({ source: project.source, projectKey: project.key, id: editing === 'new' ? undefined : editing.id, summary, description, condition, priority })
      setItems((old) => editing === 'new' ? [...(old ?? []), saved] : (old ?? []).map((i) => i.id === saved.id ? saved : i))
      setEditing(undefined)
    } catch (err) { setFormError(errorText(err)) } finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true); setError(undefined)
    try { await jiraApi().deleteTriggerTemplate({ source: project.source, projectKey: project.key, id }); setItems((old) => old?.filter((i) => i.id !== id)); setDeleting(undefined) }
    catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }
  return <main className="min-w-0 flex-1 px-10 py-6">
    <div className="text-(--jp-subtle)"><Link to="/projects" className="hover:underline">Projects</Link><span className="mx-2">/</span>{project.name}<span className="mx-2">/</span>Recurring</div>
    <div className="mt-2 flex items-center gap-3"><h1 className="text-2xl font-medium">On Trigger</h1><button type="button" className="jp-btn ml-auto" disabled={!items} onClick={() => edit('new')}><Plus /> Create template</button></div>
    <p className="mt-4 text-(--jp-subtle)">Save task templates for future triggers. Conditions are notes for now; hooks are not connected and no tasks will be created automatically.</p>
    <div className="mt-6"><ErrorNote error={error} /></div>
    {!items && !error && <div className="flex items-center gap-2 text-(--jp-subtle)"><Loader2 className="size-4 animate-spin" /> Loading…</div>}
    {items?.length === 0 && <div className="rounded-md border border-(--jp-border) px-6 py-12 text-center text-(--jp-subtle)">No templates yet. Create one for a future trigger.</div>}
    {!!items?.length && <ul className="flex flex-col gap-3">{items.map((item) => <li key={item.id} className="rounded-md border border-(--jp-border) p-4">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="font-semibold break-words">{item.summary}</div><div className="mt-1 text-xs text-(--jp-subtle)">Priority: {item.priority} · Trigger not connected</div></div>
        <button type="button" className="jp-btn jp-btn-subtle" onClick={() => edit(item)}>Edit</button>
        {deleting === item.id ? <><button type="button" className="jp-btn jp-btn-danger" disabled={busy} onClick={() => void remove(item.id)}>Delete template?</button><button type="button" className="jp-btn jp-btn-subtle" onClick={() => setDeleting(undefined)}>Cancel</button></> : <button type="button" className="jp-btn jp-btn-subtle" onClick={() => setDeleting(item.id)} aria-label={`Delete template ${item.summary}`}><Trash2 /></button>}
      </div>{item.condition && <p className="mt-3 break-words whitespace-pre-wrap"><strong>Condition note:</strong> {item.condition}</p>}{item.description && <p className="mt-2 text-(--jp-subtle) break-words whitespace-pre-wrap">{item.description}</p>}
    </li>)}</ul>}
    <Modal open={!!editing} onClose={() => !busy && setEditing(undefined)} title={editing === 'new' ? 'Create trigger template' : 'Edit trigger template'} description="This saves a template only. Its condition will not run until hooks are added." width={640} footer={<><button type="button" className="jp-btn jp-btn-subtle" onClick={() => setEditing(undefined)} disabled={busy}>Cancel</button><button type="submit" form="jp-trigger-template" className="jp-btn jp-btn-primary" disabled={busy || !summary.trim()}>{busy && <Loader2 className="animate-spin" />} Save template</button></>}>
      <form id="jp-trigger-template" onSubmit={save}>
        <Field id="jp-trigger-summary" label="Task summary" required><input id="jp-trigger-summary" autoFocus className="jp-field" value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
        <Field id="jp-trigger-condition" label="Condition note" hint="Describe the condition you want to connect later."><textarea id="jp-trigger-condition" className="jp-field" rows={3} value={condition} onChange={(e) => setCondition(e.target.value)} /></Field>
        <Field id="jp-trigger-description" label="Task description"><textarea id="jp-trigger-description" className="jp-field" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field id="jp-trigger-priority" label="Priority"><select id="jp-trigger-priority" className="jp-field" value={priority} onChange={(e) => setPriority(e.target.value)}>{['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <ErrorNote error={formError} />
      </form>
    </Modal>
  </main>
}
