import { useEffect, useState } from 'react'
import { FolderOpen, HardDriveDownload, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { formatBytes, formatIn, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'

import type { BackupPageStatus, BackupStatus, BackupUnit, GlobalBackupSettings } from './types'

const MODULE_ID = 'backups'
const UNITS: BackupUnit[] = ['hour', 'day', 'week']

/** Browser dev server: fictional, kept in memory. */
const SAMPLE_FOLDER = 'C:\\Users\\sample\\OneDrive\\MonoRail backups'
let sample: BackupStatus = {
  settings: { enabled: false, folder: '', times: 1, unit: 'day', keep: 14, items: { 'jira-plus': true, flashcards: true } },
  pages: [
    { id: 'github-plus', title: 'GitHub+', what: 'Repositories you set to use the global folder on their Backups tab.', folder: null, repos: 1 },
    { id: 'jira-plus', title: 'Jira+', what: 'Your private projects (the local git repo), as one .bundle file.', folder: null, included: true, lastResult: null, nextDueAt: null, files: 0 },
    { id: 'flashcards', title: 'Flashcards', what: 'All decks, cards and study history, as one .json file.', folder: null, included: true, lastResult: null, nextDueAt: null, files: 0 },
  ],
}
function sampleSave(s: GlobalBackupSettings): BackupStatus {
  const sep = s.folder.includes('/') ? '/' : '\\'
  sample = {
    settings: s,
    pages: sample.pages.map((p) => {
      const folder = s.enabled && s.folder ? `${s.folder.replace(/[\\/]+$/, '')}${sep}${p.id}` : null
      if (p.id === 'github-plus') return { ...p, folder }
      const on = !!folder && s.items[p.id]
      return { ...p, folder, included: s.items[p.id], nextDueAt: on ? new Date(Date.now() + 86_400_000 / s.times).toISOString() : null }
    }),
  }
  return sample
}

const call = <T,>(method: string, args?: unknown): Promise<T> =>
  isDesktop()
    ? invokeModule<T>(MODULE_ID, method, args)
    : new Promise<T>((r) => {
        const v =
          method === 'save' ? sampleSave((args as { settings: GlobalBackupSettings }).settings)
          : method === 'pickFolder' ? SAMPLE_FOLDER
          : sample
        setTimeout(() => r(v as T), 60)
      })

const same = (a: GlobalBackupSettings, b: GlobalBackupSettings) =>
  a.enabled === b.enabled && a.folder === b.folder && a.times === b.times && a.unit === b.unit && a.keep === b.keep &&
  a.items['jira-plus'] === b.items['jira-plus'] && a.items.flashcards === b.items.flashcards

const clamp = (v: string, max: number) => Math.max(1, Math.min(max, Math.trunc(Number(v)) || 1))
const joinPath = (folder: string, id: string) => `${folder.replace(/[\\/]+$/, '')}${folder.includes('/') && !folder.includes('\\') ? '/' : '\\'}${id}`

/** Settings > Backups: one folder and one frequency that every page's backups default to. */
export function BackupsCard({ className }: { className?: string }) {
  const [status, setStatus] = useState<BackupStatus>()
  const [form, setForm] = useState<GlobalBackupSettings>()
  const [busy, setBusy] = useState<'save' | 'run' | null>(null)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  useEffect(() => {
    let live = true
    const load = (reset: boolean) =>
      call<BackupStatus>('getStatus').then(
        (s) => {
          if (!live) return
          setStatus(s)
          if (reset) setForm(s.settings)
        },
        (e: Error) => live && setError(e.message),
      )
    void load(true)
    // The schedule runs in the background; keep the per-page status current.
    const t = setInterval(() => void load(false), 30_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [])

  async function act(kind: 'save' | 'run', fn: () => Promise<BackupStatus>, done: string) {
    setBusy(kind)
    setError(undefined)
    setNotice(undefined)
    try {
      const s = await fn()
      setStatus(s)
      if (kind === 'save') setForm(s.settings)
      setNotice(done)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function choose() {
    try {
      const dir = await call<string | null>('pickFolder')
      if (dir) setForm((f) => f && { ...f, folder: dir })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const set = <K extends keyof GlobalBackupSettings>(k: K, v: GlobalBackupSettings[K]) => setForm((f) => f && { ...f, [k]: v })
  const saved = status?.settings
  const dirty = !!form && !!saved && !same(form, saved)
  const folderChanged = !!saved?.folder && !!form && form.folder !== saved.folder

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Backups</CardTitle>
        <CardDescription>
          One folder for all of MonoRail's backups, for example a folder OneDrive already syncs. Each page backs up into its own subfolder, and a
          page's own folder still wins.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-6">
        {!form || !status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} aria-label="Use a global backup folder" />
              Use a global backup folder
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[112px_1fr] sm:items-center">
              <span className="text-sm text-muted-foreground">Folder</span>
              <div className="flex min-w-0 gap-2">
                <Input readOnly value={form.folder} placeholder="No folder chosen" title={form.folder} className="font-mono text-xs" />
                <Button variant="outline" onClick={choose}>
                  Choose folder…
                </Button>
                {saved?.folder && isDesktop() && (
                  <Button variant="ghost" size="icon" title="Open in File Explorer" aria-label="Open in File Explorer"
                    onClick={() => call('openFolder').catch((e: Error) => setError(e.message))}>
                    <FolderOpen />
                  </Button>
                )}
              </div>

              <span className="text-sm text-muted-foreground">How often</span>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Input type="number" min={1} max={24} value={form.times} className="w-20" aria-label="Times"
                  onChange={(e) => set('times', clamp(e.target.value, 24))} />
                <span>{form.times === 1 ? 'time' : 'times'} per</span>
                <NativeSelect value={form.unit} className="w-28" aria-label="Per" onChange={(e) => set('unit', e.target.value as BackupUnit)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <span className="text-sm text-muted-foreground">Keep</span>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                the newest
                <Input type="number" min={1} max={365} value={form.keep} className="w-20" aria-label="Keep"
                  onChange={(e) => set('keep', clamp(e.target.value, 365))} />
                backups per item, delete older ones
              </div>
            </div>

            {folderChanged && (
              <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-soft-foreground">
                Only new backups go to the new folder. Backups already in <span className="font-mono text-xs">{saved!.folder}</span> stay where
                they are; MonoRail never moves or deletes them.
              </p>
            )}

            <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/10">
              {status.pages.map((p) => (
                <PageRow key={p.id} page={p} form={form} onInclude={(v) => set('items', { ...form.items, [p.id]: v })} />
              ))}
            </div>

            {error && <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>}
            {notice && !error && <p className="text-sm text-muted-foreground">{notice}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!dirty || (form.enabled && !form.folder) || !!busy}
                onClick={() =>
                  act('save', () => call('save', { settings: form }), form.enabled ? 'Saved. Backups run in MonoRail while it is open, and catch up when it next opens.' : 'Saved. The global backup folder is off.')
                }>
                {busy === 'save' && <Loader2 className="animate-spin" />} Save
              </Button>
              <Button variant="outline" disabled={!saved?.enabled || dirty || !!busy}
                title={dirty ? 'Save your changes first' : undefined}
                onClick={() => act('run', () => call('runAll'), 'Backup finished. See each page above.')}>
                {busy === 'run' ? <Loader2 className="animate-spin" /> : <HardDriveDownload />} Back up now
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PageRow({ page, form, onInclude }: { page: BackupPageStatus; form: GlobalBackupSettings; onInclude: (v: boolean) => void }) {
  const preview = form.folder ? joinPath(form.folder, page.id) : `[backup folder]\\${page.id}`
  const githubPlus = page.id === 'github-plus'
  const included = githubPlus || form.items[page.id as 'jira-plus' | 'flashcards']
  const last = page.lastResult
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', !included && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {page.title}
          {githubPlus && (
            <Badge variant="secondary">{page.repos ? `${page.repos} ${page.repos === 1 ? 'repo follows' : 'repos follow'} this` : 'Set per repo'}</Badge>
          )}
          {!githubPlus && last && (last.ok ? (last.skipped ? <Badge variant="secondary">Nothing to back up yet</Badge> : <Badge variant="success">Backed up {formatRelative(last.at)}</Badge>)
            : <Badge variant="destructive" title={last.error}>Failed {formatRelative(last.at)}</Badge>)}
        </div>
        <div className="text-xs text-muted-foreground">{page.what}</div>
        <div className="truncate font-mono text-xs text-muted-foreground" title={preview}>{preview}</div>
        {!githubPlus && last && !last.ok && <div className="text-xs text-destructive">{last.error}</div>}
      </div>
      {!githubPlus && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {page.nextDueAt && form.enabled && (
            <span>{formatIn(page.nextDueAt) === 'now' ? 'Due now' : `Next ${formatIn(page.nextDueAt)}`}</span>
          )}
          {!!page.files && <span>{page.files} kept{last?.ok && last.size ? ` · ${formatBytes(last.size)}` : ''}</span>}
          <Switch checked={included} onCheckedChange={onInclude} aria-label={`Back up ${page.title}`} />
        </div>
      )}
    </div>
  )
}
