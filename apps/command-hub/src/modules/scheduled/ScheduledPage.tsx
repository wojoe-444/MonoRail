import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hasLocalScreen, invokeModule, isDesktop, useModuleQuery } from '@/modules/client'
import { prefs } from '@/lib/prefs'

type Task = { name: string; path: string; description: string; command: string; schedule: string; state: string; lastRun: string | null; nextRun: string | null; result: number | null; writable: boolean }
type Report = { tasks: Task[]; readAt: string }
const key = (t: Task) => t.path + t.name
const date = (s: string | null) => s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const HIDDEN = 'commandHub.scheduled.hidden'
function initialHidden(): string[] { try { const v = JSON.parse(prefs.getItem(HIDDEN) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [] } catch { return [] } }

export default function ScheduledPage() {
  const query = useModuleQuery<Report>('scheduled', 'list')
  const [filter, setFilter] = useState('')
  const [hidden, setHidden] = useState<string[]>(initialHidden)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const local = hasLocalScreen()
  const tasks = (query.data?.tasks ?? []).filter((t) => `${t.name} ${t.path} ${t.description} ${t.command}`.toLowerCase().includes(filter.toLowerCase()))
  const visible = tasks.filter((t) => !hidden.includes(key(t)))
  const own = visible.filter((t) => t.writable)
  const system = visible.filter((t) => !t.writable)
  const hiddenTasks = tasks.filter((t) => hidden.includes(key(t)))
  function hide(t: Task, value: boolean) { const next = value ? [...hidden, key(t)] : hidden.filter((k) => k !== key(t)); setHidden(next); prefs.setItem(HIDDEN, JSON.stringify(next)) }
  async function change(t: Task, action: string) {
    if (action === 'delete' && !window.confirm(`Delete the scheduled task “${t.name}”?`)) return
    setBusy(true); setError('')
    try { await invokeModule('scheduled', 'change', { action, name: t.name, path: t.path }); await query.refresh() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  async function open() { try { await invokeModule('scheduled', 'openScheduler') } catch (e) { setError(e instanceof Error ? e.message : String(e)) } }
  const table = (items: Task[], isHidden = false) => <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{['Task', 'Schedule', 'Next run', 'Last run', 'State', 'Actions'].map((h) => <th className="px-4 py-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{items.map((t) => <tr className="border-t align-top" key={key(t)}><td className="min-w-56 px-4 py-4"><div className="font-medium">{t.name}</div><div className="break-all text-xs text-muted-foreground">{t.path} · {t.command}</div>{t.description && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{t.description}</p>}</td><td className="min-w-36 px-4 py-4">{t.schedule || 'No trigger'}</td><td className="min-w-36 px-4 py-4">{date(t.nextRun)}</td><td className="min-w-36 px-4 py-4">{date(t.lastRun)}{t.lastRun && t.result !== null && <div className="mt-1 text-xs text-muted-foreground">{t.state === 'Running' ? 'Running now' : t.result === 0 ? 'Succeeded' : `Result: 0x${(t.result >>> 0).toString(16).toUpperCase()}`}</div>}</td><td className="px-4 py-4"><Badge variant={t.state === 'Running' ? 'success' : 'secondary'}>{t.state}</Badge></td><td className="min-w-64 px-4 py-3"><div className="flex flex-wrap gap-2">{!isHidden && t.writable && local && <><Button size="sm" variant="outline" disabled={busy} onClick={() => void change(t, t.state === 'Running' ? 'stop' : 'run')}>{t.state === 'Running' ? 'Stop' : 'Run now'}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void change(t, t.state === 'Disabled' ? 'enable' : 'disable')}>{t.state === 'Disabled' ? 'Turn on' : 'Turn off'}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void change(t, 'delete')}>Delete</Button></>}<Button size="sm" variant="ghost" onClick={() => hide(t, !isHidden)}>{isHidden ? 'Unhide' : 'Hide'}</Button></div></td></tr>)}</tbody></table>{items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks to show.</p>}</div>
  return <div className="flex flex-col gap-6"><PageHeader eyebrow="Scheduled" title="Windows Task Scheduler" description="Review scheduled tasks on this computer." actions={<><Button variant="outline" disabled={!local} onClick={() => void open()}><ExternalLink /> Open Task Scheduler</Button><Button disabled={!isDesktop() || query.fetching} onClick={() => void query.refresh()}><RefreshCw /> Refresh</Button></>} />
    <p className="text-sm text-muted-foreground">{query.data ? `Read ${date(query.data.readAt)}. ` : ''}Tasks running as your Windows account can be changed here. Other tasks are read-only. Use Task Scheduler to create or edit tasks; Microsoft system tasks are omitted.</p>
    <Input aria-label="Filter tasks" placeholder="Filter tasks" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
    {(error || query.error) && <p role="alert" className="text-sm text-destructive">{error || query.error?.message}</p>}
    {!isDesktop() ? <p className="text-sm text-muted-foreground">Open MonoRail on Windows to see scheduled tasks.</p> : query.loading ? <p className="text-sm text-muted-foreground">Reading scheduled tasks…</p> : query.data && <><section className="flex flex-col gap-3"><h2 className="font-semibold">Your tasks ({own.length})</h2>{table(own)}</section><details><summary className="cursor-pointer text-sm font-medium">System and app tasks ({system.length}, read-only)</summary><div className="mt-4">{table(system)}</div></details><details><summary className="cursor-pointer text-sm font-medium">Hidden ({hiddenTasks.length})</summary><div className="mt-4">{table(hiddenTasks, true)}</div></details></>}
  </div>
}
