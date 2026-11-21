import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { invokeModule, isDesktop } from '@/modules/client'

type Version = { version: number; name: string; text: string; savedAt: string }
type Template = { id: string; versions: Version[] }
const fields = (text: string) => [...new Set(Array.from(text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g), (m) => m[1]))]
const label = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export default function PromptsPage() {
  const [items, setItems] = useState<Template[]>([])
  const [selected, setSelected] = useState<string>()
  const [version, setVersion] = useState<number>()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const current = items.find((item) => item.id === selected)
  const revision = current?.versions.find((v) => v.version === version)
  useEffect(() => { if (isDesktop()) void invokeModule<Template[]>('prompt-templates', 'list').then(setItems, (e) => setError(String(e))) }, [])
  function select(item: Template, v = item.versions.length) {
    setSelected(item.id); setVersion(v); setValues({}); setEditing(false); setError(''); setNotice('')
  }
  function edit() {
    if (!revision) return
    setName(revision.name); setText(revision.text); setEditing(true); setError(''); setNotice('')
  }
  async function save() {
    setBusy(true); setError('')
    try {
      const args = { id: current?.id, baseVersion: current?.versions.length, name, text }
      let saved: Template
      if (isDesktop()) saved = await invokeModule<Template>('prompt-templates', 'save', args)
      else {
        if (!name.trim() || !text.trim()) throw new Error('Provide a name and prompt text.')
        // oxlint-disable-next-line react/purity -- The UUID and timestamp are created in the Save button's event handler.
        saved = { id: current?.id ?? crypto.randomUUID(), versions: [...(current?.versions ?? []), { version: (current?.versions.length ?? 0) + 1, name: name.trim(), text, savedAt: new Date().toISOString() }] }
      }
      setItems((old) => [...old.filter((item) => item.id !== saved.id), saved]); select(saved); setNotice('Version saved.')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const rendered = revision?.text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_match, key: string) => values[key] ?? '') ?? ''
  return <div className="flex flex-col gap-8">
    <PageHeader eyebrow="Templates" title="Prompts" description="Save reusable prompts, fill in their fields, and copy the result." actions={<Button onClick={() => { setSelected(undefined); setVersion(undefined); setName(''); setText(''); setEditing(true); setError(''); setNotice('') }}>New prompt</Button>} />
    {!isDesktop() && <p className="text-sm text-muted-foreground">Browser preview: changes last only until this page is reloaded.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
      <Card><CardContent className="flex flex-col gap-2 pt-6"><h2 className="font-semibold">Your prompts</h2>{items.length === 0 && <p className="text-sm text-muted-foreground">No prompts yet. Create one to get started.</p>}{items.map((item) => <button key={item.id} onClick={() => select(item)} className={`rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${selected === item.id ? 'bg-primary-soft font-medium' : ''}`}>{item.versions.at(-1)?.name} <span className="text-muted-foreground">· v{item.versions.length}</span></button>)}</CardContent></Card>
      <Card><CardContent className="flex flex-col gap-6 pt-6">
        {editing ? <>
          <h2 className="font-semibold">{current ? 'Save a new version' : 'New prompt'}</h2>
          <label className="grid gap-2 text-sm font-medium">Name<Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></label>
          <label className="grid gap-2 text-sm font-medium">Prompt text<Textarea className="min-h-48 font-mono" value={text} maxLength={200000} onChange={(e) => setText(e.target.value)} placeholder={'Summarize this for {audience}:\n\n{material}'} /></label>
          <p className="text-sm text-muted-foreground">Write field names in braces, such as {'{audience}'} or {'{material}'}. Use letters, numbers and underscores, starting with a letter. Repeated names share one field.</p>
          <div className="flex gap-2"><Button disabled={busy || !name.trim() || !text.trim()} onClick={() => void save()}>Save version</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
        </> : revision && current ? <>
          <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-semibold">{revision.name}</h2><Button variant="outline" onClick={edit}>Edit as new version</Button></div>
          <label className="grid gap-2 text-sm font-medium">Version<select className="h-9 rounded-md border border-input bg-card px-3" value={revision.version} onChange={(e) => select(current, Number(e.target.value))}>{[...current.versions].reverse().map((v) => <option key={v.version} value={v.version}>Version {v.version} · {new Date(v.savedAt).toLocaleString()}</option>)}</select></label>
          {fields(revision.text).map((key) => <label className="grid gap-2 text-sm font-medium" key={key}>{label(key)}<Textarea value={values[key] ?? ''} onChange={(e) => setValues((old) => ({ ...old, [key]: e.target.value }))} /></label>)}
          <label className="grid gap-2 text-sm font-medium">Completed prompt<Textarea readOnly className="min-h-48" value={rendered} /></label>
          <div><Button onClick={() => void navigator.clipboard.writeText(rendered).then(() => setNotice('Copied to clipboard.'), (e) => setError(String(e)))}>Copy prompt</Button></div>
        </> : <p className="text-sm text-muted-foreground">Select a prompt or create a new one.</p>}
      </CardContent></Card>
    </div>
  </div>
}
