import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Code2,
  Download,
  FolderOpen,
  FolderPlus,
  Tag,
  Loader2,
  MoreHorizontal,
  Package,
  Puzzle,
  RefreshCw,
  RotateCw,
  ScrollText,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { extensionIcon } from '@/extensions/ExtensionIcon'
import { refreshExtensions, useExtensionList } from '@/extensions/store'
import type { ExtensionList, ExtensionSource, ExtensionSummary, InstallPreview, LogLine, PermissionLine } from '@/extensions/types'
import { formatRelative } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'

const BACKEND = 'extensions'
const DOCS_URL = 'https://github.com/wojoe-444/MonoRail/blob/main/docs/extensions.md'

/** Shown in the browser dev server, where there is no backend. Fictional. */
const sampleList: ExtensionList = {
  apiVersion: '1.0.0',
  extensions: [
    {
      id: 'hello-monorail',
      name: 'Hello MonoRail',
      version: '1.0.0',
      description: 'The starter extension: one page, one app and a small backend.',
      publisher: 'Example Publisher',
      repository: 'example-org/hello-monorail',
      apiRange: '^1.0.0',
      hasIcon: false,
      source: { type: 'github', repo: 'example-org/hello-monorail', tag: 'v1.0.0' },
      enabled: true,
      status: 'active',
      revision: 0,
      permissions: [
        { key: 'net:api.example.com', kind: 'network', risk: 'low', label: 'Connect to api.example.com' },
        { key: 'pick', kind: 'filesystem', risk: 'low', label: 'Ask you for access to folders you choose' },
      ],
      newPermissions: [],
      canPickFolders: true,
      folders: [{ path: 'C:\\Users\\example\\Documents\\notes', write: false }],
      contributes: {
        modules: [{ id: 'hello', title: 'Hello', description: '', entry: 'index.html', nav: { section: 'Extensions', order: 100 } }],
        apps: [{ id: 'board', title: 'Hello Board', description: '', entry: 'app.html' }],
      },
      backend: { activation: 'onDemand', state: 'stopped' },
      update: { version: '1.1.0' },
      dataDir: '%APPDATA%\\MonoRail\\extension-data\\hello-monorail',
      extensionDir: '%APPDATA%\\MonoRail\\extensions\\hello-monorail',
    },
  ],
}

function cleanError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export default function ExtensionsPage() {
  const desktop = isDesktop()
  const live = useExtensionList()
  const list = desktop ? live : sampleList
  const [preview, setPreview] = useState<InstallPreview>()
  const [githubOpen, setGithubOpen] = useState(false)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const [checkedAt, setCheckedAt] = useState<string>()
  const [removing, setRemoving] = useState<ExtensionSummary>()
  const [logsFor, setLogsFor] = useState<ExtensionSummary>()

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    if (!desktop) {
      setError('Extensions can be installed in the desktop app, not in the browser.')
      return undefined
    }
    setBusy(label)
    setError(undefined)
    try {
      return await fn()
    } catch (e) {
      setError(cleanError(e))
      return undefined
    } finally {
      setBusy(undefined)
      void refreshExtensions()
    }
  }

  async function inspect(args: Record<string, unknown>) {
    const p = await run('inspect', () => invokeModule<InstallPreview | null>(BACKEND, 'inspect', args))
    if (p) setPreview(p)
    return !!p
  }

  async function checkUpdates() {
    const res = await run('updates', () => invokeModule<{ checkedAt: string; results: { id: string; ok: boolean; error?: string }[] }>(BACKEND, 'checkUpdates'))
    if (!res) return
    setCheckedAt(res.checkedAt)
    const failed = res.results.filter((r) => !r.ok)
    if (failed.length) setError(failed.map((f) => `${f.id}: ${f.error}`).join('\n'))
  }

  const call = (method: string, args: Record<string, unknown>) => run(method, () => invokeModule(BACKEND, method, args))
  const hasGitHub = list.extensions.some((e) => e.source.type === 'github')

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Settings"
        title="Extensions"
        description="Modules and apps built outside MonoRail. Each one runs in its own sandbox and only gets the access you approve."
        actions={
          <>
            {hasGitHub && (
              <Button variant="outline" onClick={checkUpdates} disabled={!!busy}>
                {busy === 'updates' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Check for updates
              </Button>
            )}
            <InstallMenu busy={busy === 'inspect'} onGitHub={() => setGithubOpen(true)} onPick={(kind) => void inspect({ kind })} />
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1 break-words whitespace-pre-line">{error}</span>
          <button type="button" onClick={() => setError(undefined)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-destructive/10">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Installed</CardTitle>
            <CardDescription>
              {list.extensions.length === 0
                ? 'Nothing installed yet.'
                : `${list.extensions.length} extension${list.extensions.length === 1 ? '' : 's'}${checkedAt ? `. Updates checked ${formatRelative(checkedAt)}.` : '.'}`}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {list.extensions.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="divide-y">
                {list.extensions.map((ext) => (
                  <ExtensionRow
                    key={ext.id}
                    ext={ext}
                    busy={busy}
                    onToggle={(enabled) => void call('setEnabled', { id: ext.id, enabled })}
                    onApprove={() => void call('approve', { id: ext.id })}
                    onReload={() => void call('reload', { id: ext.id })}
                    onUpdate={async () => {
                      const p = await run('inspect', () => invokeModule<InstallPreview>(BACKEND, 'stageUpdate', { id: ext.id }))
                      if (p) setPreview(p)
                    }}
                    onRevokeFolder={(path) => void call('revokeFolder', { id: ext.id, path })}
                    onOpenFolder={(which) => void call('openFolder', { id: ext.id, which })}
                    onLogs={() => setLogsFor(ext)}
                    onRemove={() => setRemoving(ext)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <AboutCard apiVersion={list.apiVersion || '1.0.0'} />
      </div>

      <GitHubDialog
        open={githubOpen}
        busy={busy === 'inspect'}
        onOpenChange={setGithubOpen}
        onSubmit={async (repo) => {
          if (await inspect({ kind: 'github', repo })) setGithubOpen(false)
        }}
      />

      {preview && (
        <ConsentDialog
          preview={preview}
          busy={busy === 'confirm'}
          onCancel={() => {
            void invokeModule(BACKEND, 'cancel', { token: preview.token }).catch(() => {})
            setPreview(undefined)
          }}
          onConfirm={async () => {
            const done = await run('confirm', () => invokeModule<ExtensionSummary>(BACKEND, 'confirm', { token: preview.token }))
            setPreview(undefined)
            const first = done?.contributes.modules[0]
            if (done && !preview.installedVersion && first) navigate(`/x/${done.id}/${first.id}`)
          }}
        />
      )}

      {removing && (
        <RemoveDialog
          ext={removing}
          busy={busy === 'uninstall'}
          onCancel={() => setRemoving(undefined)}
          onConfirm={async (deleteData) => {
            await call('uninstall', { id: removing.id, deleteData })
            setRemoving(undefined)
          }}
        />
      )}

      {logsFor && <LogsDialog ext={logsFor} onClose={() => setLogsFor(undefined)} />}
    </div>
  )
}

// ------------------------------------------------------------------ pieces --

function InstallMenu({ busy, onGitHub, onPick }: { busy: boolean; onGitHub: () => void; onPick: (kind: 'zip' | 'folder' | 'dev') => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
          Install extension
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={onGitHub}>
          <Tag /> From a GitHub release…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick('zip')}>
          <Package /> From a .zip file…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick('folder')}>
          <FolderOpen /> From a folder…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">For extension authors</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onPick('dev')}>
          <Code2 /> Load a folder for development…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Puzzle className="size-6" />
      </div>
      <div className="font-medium">No extensions yet</div>
      <p className="max-w-sm text-sm text-muted-foreground">
        Install one from a GitHub release, a .zip or a folder. Extensions add pages to the menu or full-screen apps under Apps.
      </p>
    </div>
  )
}

const STATUS: Record<ExtensionSummary['status'], { label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive' }> = {
  active: { label: 'On', variant: 'success' },
  disabled: { label: 'Off', variant: 'secondary' },
  'needs-approval': { label: 'Needs approval', variant: 'warning' },
  incompatible: { label: 'Incompatible', variant: 'destructive' },
  broken: { label: 'Could not load', variant: 'destructive' },
}

function sourceLabel(s: ExtensionSource): string {
  switch (s.type) {
    case 'github':
      return `GitHub · ${s.repo}`
    case 'zip':
      return 'Installed from a .zip'
    case 'folder':
      return 'Installed from a folder'
    case 'dev':
      return `Development folder · ${s.path}`
  }
}

interface RowProps {
  ext: ExtensionSummary
  busy?: string
  onToggle: (enabled: boolean) => void
  onApprove: () => void
  onReload: () => void
  onUpdate: () => void
  onRevokeFolder: (path: string) => void
  onOpenFolder: (which: 'data' | 'extension') => void
  onLogs: () => void
  onRemove: () => void
}

function ExtensionRow({ ext, busy, onToggle, onApprove, onReload, onUpdate, onRevokeFolder, onOpenFolder, onLogs, onRemove }: RowProps) {
  const status = STATUS[ext.status]
  const pages = ext.contributes.modules.length
  const apps = ext.contributes.apps.length
  const parts = [pages && `${pages} page${pages === 1 ? '' : 's'}`, apps && `${apps} app${apps === 1 ? '' : 's'}`, ext.backend && 'backend'].filter(Boolean)

  return (
    <li className="flex flex-col gap-4 px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <RowIcon ext={ext} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{ext.name}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{ext.version}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
            {ext.source.type === 'dev' && <Badge variant="info">Development</Badge>}
            {ext.backend?.state === 'running' && <Badge variant="outline">Backend running</Badge>}
            {ext.backend?.state === 'crashed' && <Badge variant="destructive">Backend crashed</Badge>}
          </div>
          {ext.description && <p className="mt-1 text-sm text-muted-foreground">{ext.description}</p>}
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[ext.publisher, sourceLabel(ext.source), parts.join(', ')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ext.update && ext.status !== 'broken' && (
            <Button size="sm" onClick={onUpdate} disabled={!!busy}>
              <Download /> Update to {ext.update.version}
            </Button>
          )}
          {ext.source.type === 'dev' && (
            <Button size="sm" variant="outline" onClick={onReload} disabled={!!busy}>
              <RotateCw /> Reload
            </Button>
          )}
          <Switch
            checked={ext.enabled}
            onCheckedChange={onToggle}
            disabled={!!busy || ext.status === 'broken' || ext.status === 'incompatible'}
            aria-label={ext.enabled ? `Turn off ${ext.name}` : `Turn on ${ext.name}`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`More for ${ext.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {ext.backend && (
                <DropdownMenuItem onSelect={onLogs}>
                  <ScrollText /> Backend logs
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => onOpenFolder('data')}>
                <FolderOpen /> Open its data folder
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpenFolder('extension')}>
                <FolderOpen /> Open its files
              </DropdownMenuItem>
              {ext.source.type !== 'dev' && (
                <DropdownMenuItem onSelect={onReload}>
                  <RotateCw /> Restart
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
                <Trash2 /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {ext.error && (
        <Notice tone="destructive">
          <span className="break-words">{ext.error}</span>
        </Notice>
      )}
      {ext.backend?.error && ext.status === 'active' && (
        <Notice tone="warning">
          <span className="break-words">Backend: {ext.backend.error}</span>
        </Notice>
      )}
      {ext.status === 'needs-approval' && (
        <Notice tone="warning">
          <div className="flex flex-1 flex-col gap-2">
            <span>This version asks for more access. It stays off until you approve:</span>
            <PermissionList items={ext.newPermissions} />
          </div>
          <Button size="sm" onClick={onApprove} disabled={!!busy}>
            <ShieldCheck /> Approve
          </Button>
        </Notice>
      )}

      <div className="flex flex-wrap gap-2 pl-14">
        {ext.permissions.length === 0 ? (
          <Badge variant="outline">
            <ShieldCheck /> No extra access
          </Badge>
        ) : (
          ext.permissions.map((p) => <PermissionChip key={p.key} p={p} />)
        )}
      </div>

      {ext.folders.length > 0 && (
        <div className="flex flex-col gap-1 pl-14">
          <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Folders you shared</div>
          {ext.folders.map((f) => (
            <div key={f.path} className="flex items-center gap-2 text-sm">
              <FolderPlus className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
              <span className="text-xs text-muted-foreground">{f.write ? 'read and change' : 'read'}</span>
              <Button size="sm" variant="ghost" onClick={() => onRevokeFolder(f.path)} disabled={!!busy}>
                Remove access
              </Button>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

function RowIcon({ ext }: { ext: ExtensionSummary }) {
  const Icon = extensionIcon(ext.id, '', ext.hasIcon)
  return <Icon className="size-5" />
}

function Notice({ tone, children }: { tone: 'warning' | 'destructive'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'ml-14 flex items-start gap-3 rounded-lg px-4 py-3 text-sm',
        tone === 'warning' ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-destructive-soft text-destructive-soft-foreground',
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {children}
    </div>
  )
}

const RISK = { low: 'info', medium: 'warning', high: 'destructive' } as const

function PermissionChip({ p }: { p: PermissionLine }) {
  return <Badge variant={RISK[p.risk]}>{p.label}</Badge>
}

function PermissionList({ items, highlight }: { items: PermissionLine[]; highlight?: Set<string> }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => (
        <li key={p.key} className="flex items-center gap-2 text-sm">
          <span
            className={cn('size-2 shrink-0 rounded-full', p.risk === 'high' ? 'bg-destructive' : p.risk === 'medium' ? 'bg-warning' : 'bg-info')}
            aria-hidden
          />
          <span className="flex-1">{p.label}</span>
          {highlight?.has(p.key) && <Badge variant="primary">New</Badge>}
          {p.risk === 'high' && <span className="text-xs text-muted-foreground">Full trust</span>}
        </li>
      ))}
    </ul>
  )
}

function AboutCard({ apiVersion }: { apiVersion: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How extensions work</CardTitle>
        <CardDescription>Extension API {apiVersion}</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
        <p>
          Pages and apps from an extension run in a sandboxed frame. They can’t see MonoRail’s data, other extensions, or the internet.
        </p>
        <p>
          An extension’s backend runs in its own process. It can use its own data folder and nothing else, unless you approve more when you install it: specific
          servers, folders, or programs.
        </p>
        <p>Running programs gives an extension the same access you have, so only approve that for extensions you trust.</p>
        <Button variant="outline" className="self-start" onClick={() => void invokeModule(BACKEND, 'openExternal', { url: DOCS_URL }).catch(() => {})}>
          <Code2 /> Build an extension
        </Button>
      </CardContent>
    </Card>
  )
}

function GitHubDialog({ open, busy, onOpenChange, onSubmit }: { open: boolean; busy: boolean; onOpenChange: (o: boolean) => void; onSubmit: (repo: string) => void }) {
  const [repo, setRepo] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install from GitHub</DialogTitle>
          <DialogDescription>MonoRail downloads the .monorail.zip attached to the repository’s latest release. You’ll review its access before anything is installed.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (repo.trim()) onSubmit(repo.trim())
          }}
        >
          <Label htmlFor="ext-repo">Repository</Label>
          <Input id="ext-repo" placeholder="owner/name" value={repo} onChange={(e) => setRepo(e.target.value)} autoFocus />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !repo.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Tag />} Find release
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConsentDialog({ preview: p, busy, onCancel, onConfirm }: { preview: InstallPreview; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const isUpdate = !!p.installedVersion
  const added = new Set(p.newPermissions.map((x) => x.key))
  const pages = p.contributes.modules.map((m) => m.title)
  const apps = p.contributes.apps.map((a) => a.title)
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? `Update ${p.name} from ${p.installedVersion} to ${p.version}?` : `Install ${p.name} ${p.version}?`}
          </DialogTitle>
          <DialogDescription>
            {[p.publisher && `By ${p.publisher}`, sourceLabel(p.source)].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        {p.description && <p className="text-sm">{p.description}</p>}

        <div className="flex flex-col gap-1 text-sm">
          {pages.length > 0 && <div>Adds {pages.length === 1 ? 'a page' : 'pages'}: {pages.join(', ')}</div>}
          {apps.length > 0 && <div>Adds {apps.length === 1 ? 'an app' : 'apps'}: {apps.join(', ')}</div>}
          {p.hasBackend && <div className="text-muted-foreground">Includes a backend that runs in its own sandboxed process.</div>}
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">It will be able to</div>
          <PermissionList
            items={[
              { key: 'base', kind: 'filesystem', risk: 'low', label: 'Keep its own data in its MonoRail data folder' },
              ...p.permissions,
            ]}
            highlight={isUpdate ? added : undefined}
          />
        </div>

        {!p.compatible && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Built for extension API {p.apiRange}; this MonoRail provides {p.apiVersion}. Update MonoRail or get a newer version of the extension.
          </div>
        )}
        {p.downgrade && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            This is older than the installed version {p.installedVersion}.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy || !p.compatible}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {isUpdate ? 'Update' : 'Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemoveDialog({ ext, busy, onCancel, onConfirm }: { ext: ExtensionSummary; busy: boolean; onCancel: () => void; onConfirm: (deleteData: boolean) => void }) {
  const [deleteData, setDeleteData] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {ext.name}?</DialogTitle>
          <DialogDescription>
            {ext.source.type === 'dev'
              ? 'MonoRail stops loading it. Your development folder is not touched.'
              : 'Its pages and apps leave MonoRail and its files are deleted.'}
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--destructive)]" checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} />
          <span>
            Also delete its data
            <span className="block text-xs text-muted-foreground">Settings and anything it saved. Keep it if you might reinstall.</span>
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(deleteData)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LogsDialog({ ext, onClose }: { ext: ExtensionSummary; onClose: () => void }) {
  const [lines, setLines] = useState<LogLine[]>()
  const [loading, setLoading] = useState(false)
  async function load() {
    setLoading(true)
    try {
      setLines(await invokeModule<LogLine[]>(BACKEND, 'logs', { id: ext.id }))
    } catch {
      setLines([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (isDesktop()) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ext.id])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="gap-0">
        <div className="flex items-center gap-3 border-b px-6 py-4 pr-14">
          <div className="min-w-0 flex-1">
            <DialogTitle>{ext.name} backend logs</DialogTitle>
            <DialogDescription>The last 300 lines since MonoRail started.</DialogDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn(loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6 font-mono text-xs leading-5">
          {!lines?.length
            ? 'Nothing logged yet.'
            : lines.map((l, i) => (
                <div key={i} className={cn(l.level === 'error' && 'text-destructive', l.level === 'warn' && 'text-warning-soft-foreground')}>
                  <span className="text-muted-foreground">{l.at.slice(11, 19)}</span> {l.line}
                </div>
              ))}
        </pre>
      </DialogContent>
    </Dialog>
  )
}
