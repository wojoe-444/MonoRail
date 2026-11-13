import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Folder, FolderGit2, FolderOpen, Loader2, Plus, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { invokeModule, isDesktop } from '@/modules/client'

import { sampleFolders } from './sample'
import type { AllowedFolders, SessionList } from './types'

type HiddenFolder = NonNullable<SessionList['limits']['hiddenFolders']>[number]

/**
 * Allowed folders: the Repos folder (every git repo directly inside it) plus
 * repos added one by one. Folders are chosen in the system dialog by the
 * backend; this page never sends a typed path.
 */
export function FoldersDialog({
  open,
  hidden,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  /** Chats the list leaves out, and the folders they ran in (from listSessions). */
  hidden?: { count: number; folders: HiddenFolder[] }
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const desktop = isDesktop()
  const [folders, setFolders] = useState<AllowedFolders | undefined>(desktop ? undefined : sampleFolders)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open || !desktop) return
    let live = true
    invokeModule<AllowedFolders>('agent-chat', 'getFolders').then(
      (f) => live && setFolders(f),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [open, desktop])

  async function run(method: string, args?: unknown) {
    if (!desktop) return
    setBusy(true)
    setError(undefined)
    try {
      await invokeModule('agent-chat', method, args)
      setFolders(await invokeModule<AllowedFolders>('agent-chat', 'getFolders'))
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const fromRoot = folders?.repos.filter((r) => r.source === 'root') ?? []
  const missingAdded = folders?.added.filter((p) => !folders.repos.some((r) => r.source === 'added' && samePath(r.path, p))) ?? []
  const addedRepos = folders?.repos.filter((r) => r.source === 'added') ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allowed folders</DialogTitle>
          <DialogDescription>
            Chats are listed, opened and run only in these git repos: each repo directly inside your Repos folder, and
            any repo you add here.
          </DialogDescription>
        </DialogHeader>

        {!folders && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}

        {folders && (
          <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto">
            {hidden && hidden.count > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Folders with hidden chats</h3>
                <p className="text-xs text-muted-foreground">
                  {hidden.count} {hidden.count === 1 ? 'chat is' : 'chats are'} hidden because {hidden.count === 1 ? 'it ran' : 'they ran'} outside
                  your allowed repos. Chat only lists, opens and runs chats in repos you allow, so an agent started here can never reach other
                  folders. Allow a repo to list its chats.
                </p>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {hidden.folders.map((f) => (
                    <li key={f.path} className="flex items-center gap-3 px-3 py-2">
                      {f.gitRepo ? <FolderGit2 className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium" title={f.path}>
                          {baseName(f.path)}
                        </div>
                        <div className="truncate font-mono text-xs text-muted-foreground" title={f.path}>
                          {f.path}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {f.count} {f.count === 1 ? 'chat' : 'chats'}
                      </span>
                      {f.gitRepo ? (
                        <Button size="sm" className="shrink-0" disabled={busy || !desktop} onClick={() => void run('allowHiddenRepo', { path: f.path })}>
                          <Check /> Allow
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="shrink-0" title="Only git repos can be allowed">
                          not a repo
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                {hidden.folders.some((f) => !f.gitRepo) && (
                  <p className="text-xs text-muted-foreground">
                    Folders that are not inside a git repo (your home folder, for example) cannot be allowed. Start those chats inside a repo
                    instead.
                  </p>
                )}
              </section>
            )}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Repos folder</h3>
                <Button variant="outline" size="sm" disabled={busy || !desktop} onClick={() => void run('pickReposRoot')}>
                  <FolderOpen /> Change
                </Button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs break-all">
                {folders.reposRoot}
                {folders.rootIsDefault && <Badge variant="secondary">default</Badge>}
                {!folders.reposRootFound && <Badge variant="warning">not found</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {fromRoot.length
                  ? `${fromRoot.length} ${fromRoot.length === 1 ? 'repo' : 'repos'}: ${fromRoot.map((r) => r.name).join(', ')}`
                  : 'No git repos directly inside it.'}
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Added repos</h3>
                <Button variant="outline" size="sm" disabled={busy || !desktop} onClick={() => void run('addRepo')}>
                  <Plus /> Add repo
                </Button>
              </div>
              {addedRepos.length === 0 && missingAdded.length === 0 && (
                <p className="text-xs text-muted-foreground">None. Add a repo that lives outside your Repos folder.</p>
              )}
              <ul className="flex flex-col divide-y rounded-lg border empty:hidden">
                {addedRepos.map((r) => (
                  <RepoRow key={r.path} name={r.name} path={r.path} disabled={busy || !desktop} onRemove={() => void run('removeRepo', { path: r.path })} />
                ))}
                {missingAdded.map((p) => (
                  <RepoRow key={p} name="Missing" path={p} missing disabled={busy || !desktop} onRemove={() => void run('removeRepo', { path: p })} />
                ))}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RepoRow({ name, path, missing, disabled, onRemove }: { name: string; path: string; missing?: boolean; disabled: boolean; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {name}
          {missing && <Badge variant="warning">not a repo any more</Badge>}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground" title={path}>
          {path}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="size-8" disabled={disabled} onClick={onRemove} aria-label={`Remove ${path}`}>
        <X />
      </Button>
    </li>
  )
}

function baseName(p: string) {
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p
}

function samePath(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}
