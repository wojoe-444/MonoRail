import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { invokeModule, isDesktop } from '@/modules/client'
import { SourceViewer, TemplateTabs } from './TemplateCode'

type Run = { number: number; title: string; status: string; error?: string; startedAt: number }
type State = { enabled: boolean; repository: string; model: string; lastCheckedAt?: number; error?: string; runs: Run[] }
type Template = { prompt: string; updatedAt: number; customized: boolean }

export function PrReviewer({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<State>()
  const [repository, setRepository] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'code'>('overview')
  const [source, setSource] = useState<{ name: string; text: string }[]>()
  const [sourceError, setSourceError] = useState('')
  const [template, setTemplate] = useState<Template>()
  const [editing, setEditing] = useState(false)
  const [prompt, setPrompt] = useState('')
  useEffect(() => {
    if (tab !== 'code' || source || !isDesktop()) return
    let live = true
    void invokeModule<{ name: string; text: string }[]>('pr-review', 'source').then((files) => { if (live) setSource(files) }, (e: unknown) => { if (live) setSourceError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
  }, [tab, source])
  const refresh = useCallback(async () => {
    const data = await invokeModule<State>('pr-review', 'get')
    setState(data)
    return data
  }, [])
  useEffect(() => {
    if (!isDesktop()) return
    let live = true
    void refresh().then((data) => { if (live) { setRepository(data.repository || ''); setModel(data.model || '') } }).catch((e: unknown) => { if (live) setError(String(e)) })
    void invokeModule<Template>('pr-review', 'template').then((data) => { if (live) { setTemplate(data); setPrompt(data.prompt) } }, (e: unknown) => { if (live) setError(String(e)) })
    const timer = window.setInterval(() => void refresh().catch(() => {}), 10_000)
    return () => { live = false; window.clearInterval(timer) }
  }, [refresh])
  async function action(method: string, args?: object) {
    setBusy(true); setError('')
    try { setState(await invokeModule<State>('pr-review', method, args)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  async function templateAction(method: 'saveTemplate' | 'resetTemplate') {
    setBusy(true); setError('')
    try {
      const next = await invokeModule<Template>('pr-review', method, { prompt, updatedAt: template?.updatedAt })
      setTemplate(next); setPrompt(next.prompt); setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return <>
    <div><Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}><ArrowLeft /> Template Catalog</Button></div>
    <PageHeader eyebrow="Template Catalog" title="Pull request reviewer" description="Configure a reviewer from this OpenAI template to review newly opened pull requests and post findings to GitHub while MonoRail is running." />
    <TemplateTabs value={tab} onChange={setTab} />
    {tab === 'code' ? <div role="tabpanel" id="template-panel-code" aria-labelledby="template-tab-code">{sourceError ? <p role="alert" className="text-sm text-destructive">{sourceError}</p> : !source && isDesktop() ? <p className="text-sm text-muted-foreground">Loading source…</p> : <SourceViewer files={source ?? []} description="The actual reviewer, PR context collection, and watcher code shipped with MonoRail." />}</div> : <div role="tabpanel" id="template-panel-overview" aria-labelledby="template-tab-overview" className="flex flex-col gap-6">
    {!isDesktop() && <p className="text-sm text-muted-foreground">Open MonoRail on your computer to configure the reviewer.</p>}
    <Card className="max-w-3xl gap-0 py-0"><CardHeader className="border-b px-6 py-5"><CardTitle>Template instructions</CardTitle><CardDescription>Used for new reviews. Reset restores the shipped instructions.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 px-6 py-5">
      {editing ? <Textarea aria-label="Reviewer instructions" rows={10} value={prompt} onChange={(e) => setPrompt(e.target.value)} /> : <p className="whitespace-pre-wrap text-sm">{template?.prompt ?? 'Loading instructions…'}</p>}
      <div className="flex flex-wrap gap-2">{editing ? <><Button disabled={busy || !prompt.trim()} onClick={() => void templateAction('saveTemplate')}>Save changes</Button><Button variant="outline" disabled={busy} onClick={() => { setPrompt(template?.prompt ?? ''); setEditing(false) }}>Cancel</Button></> : <><Button disabled={!template || busy} onClick={() => setEditing(true)}>Edit</Button><Button variant="outline" disabled={!template?.customized || busy} onClick={() => void templateAction('resetTemplate')}>Reset to default</Button></>}</div>
    </CardContent></Card>
    <Card className="max-w-3xl gap-0 py-0"><CardHeader className="border-b px-6 py-5"><CardTitle>Review setup</CardTitle><CardDescription>Requires GitHub and an OpenAI API key in Connections.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-2"><Label htmlFor="review-repo">GitHub repository</Label><Input id="review-repo" value={repository} onChange={(e) => setRepository(e.target.value)} placeholder="owner/repository" disabled={busy} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="review-model">OpenAI model ID (optional)</Label><Input id="review-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="SDK default" disabled={busy} /></div>
        <p className="text-sm text-muted-foreground">MonoRail checks for new open PRs every minute while it is running. Existing PRs are skipped when you enable the watcher. The PR patch and applicable base-branch AGENTS.md and CLAUDE.md files are sent to OpenAI; API charges apply. Reviews are posted as comments, without approval.</p>
        <div className="flex flex-wrap items-center gap-3"><Button disabled={!isDesktop() || busy || !repository.trim()} onClick={() => void action('configure', { repository: repository.trim(), model: model.trim() })}>{state?.enabled ? 'Save and restart watcher' : 'Enable reviewer'}</Button>{state?.enabled && <><Button variant="outline" disabled={busy} onClick={() => void action('disable')}>Disable</Button><Button variant="outline" disabled={busy} onClick={() => void action('check')}><RefreshCw /> Check now</Button></>}<span className="text-sm text-muted-foreground">{state?.enabled ? 'Watching' : 'Off'}</span></div>
        {(error || state?.error) && <p role="alert" className="text-sm text-destructive">{error || state?.error}</p>}
      </CardContent>
    </Card>
    <Card className="max-w-3xl gap-0 py-0"><CardHeader className="border-b px-6 py-5"><CardTitle>Recent reviews</CardTitle><CardDescription>{state?.lastCheckedAt ? `Last checked ${new Date(state.lastCheckedAt).toLocaleString()}` : 'No checks yet.'}</CardDescription></CardHeader><CardContent className="px-6 py-5">
      {!state?.runs.length ? <p className="text-sm text-muted-foreground">New reviews will appear here.</p> : <div className="divide-y">{state.runs.map((run, i) => <div key={`${run.number}-${run.startedAt}-${i}`} className="flex flex-wrap items-start gap-3 py-3 text-sm"><div className="min-w-0 flex-1"><div className="font-medium">#{run.number} {run.title}</div><div className="text-muted-foreground">{run.status} · {new Date(run.startedAt).toLocaleString()}</div>{run.error && <p className="text-destructive">{run.error}</p>}</div>{state.enabled && ['failed', 'running'].includes(run.status) && <Button variant="outline" size="sm" disabled={busy} onClick={() => void action('retry', { number: run.number })}>Retry</Button>}</div>)}</div>}
    </CardContent></Card>
    </div>}
  </>
}
