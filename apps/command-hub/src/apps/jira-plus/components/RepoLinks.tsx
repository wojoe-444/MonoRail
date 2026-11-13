import { useEffect, useMemo, useState } from 'react'
import { Cloud, FolderGit2, FolderOpen, Loader2, Plus, Search, X } from 'lucide-react'

import { api as ghp } from '@/apps/github-plus/api'
import { openInGitHubPlus } from '@/apps/github-plus/handoff'
import type { GitHubRepos, LinkedRepo } from '@/apps/github-plus/types'

import { errorText, jiraApi } from '../api'
import type { RepoLink, Source } from '../types'

const baseName = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p

/**
 * The task's linked repositories, in the issue dialog's Details. A link is a
 * local git repo (opens in GitHub+) or a repo on github.com (opens in the
 * browser). Links are kept in Jira+'s data folder; nothing is written to
 * Jira or GitHub.
 */
export function RepoLinks({ source, issueKey }: { source: Source; issueKey: string }) {
  const [links, setLinks] = useState<RepoLink[]>()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    // The dialog keys this component by task, so state starts fresh per task.
    let live = true
    jiraApi()
      .getRepoLinks({ source, key: issueKey })
      .then((l) => live && setLinks(l), (e) => live && setError(errorText(e)))
    return () => {
      live = false
    }
  }, [source, issueKey])

  async function run(fn: () => Promise<RepoLink[]>) {
    setBusy(true)
    setError(undefined)
    try {
      setLinks(await fn())
      setPicking(false)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const link = (repo: { path?: string; github?: string }) => run(() => jiraApi().linkRepo({ source, key: issueKey, ...repo }))
  const unlink = (id: string) => run(() => jiraApi().unlinkRepo({ source, key: issueKey, id }))
  const open = (l: RepoLink) => {
    if (l.repo.path) openInGitHubPlus(l.repo.path)
    else if (l.repo.github) ghp.openOnGitHub(l.repo.github).catch((e) => setError(errorText(e)))
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {links === undefined && !error && <Loader2 className="size-4 animate-spin text-(--jp-subtlest)" />}
      {links?.map((l) => (
        <div key={l.id} className="group -ml-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 hover:bg-(--jp-hover)">
          {l.repo.kind === 'local' ? <FolderGit2 className="size-4 shrink-0 text-(--jp-subtle)" /> : <Cloud className="size-4 shrink-0 text-(--jp-subtle)" />}
          <button
            type="button"
            className="jp-focusable min-w-0 flex-1 truncate py-1 text-left text-(--jp-link) hover:underline"
            title={l.repo.kind === 'local' ? `Open in GitHub+: ${l.repo.path}` : `Open on GitHub: ${l.repo.github}`}
            onClick={() => open(l)}
          >
            {l.repo.name}
          </button>
          {l.repo.kind === 'local' && l.repo.github && (
            <span className="shrink-0 text-xs text-(--jp-subtlest)" title={`github.com/${l.repo.github}`}>
              GitHub
            </span>
          )}
          <button
            type="button"
            className="jp-btn jp-btn-subtle size-6 shrink-0 px-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Unlink ${l.repo.name}`}
            title="Unlink"
            disabled={busy}
            onClick={() => void unlink(l.id)}
          >
            <X />
          </button>
        </div>
      ))}
      {links && !picking && (
        <button type="button" className="jp-focusable -ml-1 flex w-fit items-center gap-1 rounded-md px-1 py-1 text-(--jp-subtle) hover:bg-(--jp-hover)" onClick={() => setPicking(true)}>
          <Plus className="size-4" /> {links.length ? 'Link another' : 'Link a repository'}
        </button>
      )}
      {picking && <RepoPicker busy={busy} exclude={links ?? []} onPick={link} onCancel={() => setPicking(false)} onError={setError} />}
      {error && <div className="text-xs text-(--jp-danger)">{error}</div>}
    </div>
  )
}

interface Choice {
  id: string
  label: string
  detail?: string
  kind: 'local' | 'github'
  pick: { path?: string; github?: string }
}

/** Repos GitHub+ knows (opened recently, Jira+'s own, and the GitHub list once GitHub is set up), plus any folder. */
function RepoPicker({
  busy,
  exclude,
  onPick,
  onCancel,
  onError,
}: {
  busy: boolean
  exclude: RepoLink[]
  onPick: (repo: { path?: string; github?: string }) => void
  onCancel: () => void
  onError: (e: string) => void
}) {
  const [recents, setRecents] = useState<string[]>()
  const [linked, setLinked] = useState<LinkedRepo[]>([])
  const [github, setGithub] = useState<GitHubRepos>()
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let live = true
    ghp.getRecents().then((r) => live && setRecents(r), () => live && setRecents([]))
    ghp.getLinked().then((l) => live && setLinked(l), () => undefined)
    // Runs nothing until GitHub is set up on the Connections page ({ connected: false }).
    ghp.githubRepos().then((g) => live && setGithub(g), () => undefined)
    return () => {
      live = false
    }
  }, [])

  const choices = useMemo(() => {
    const taken = new Set(
      exclude.flatMap((l) => [l.repo.path ? `p:${l.repo.path.toLowerCase()}` : '', l.repo.github ? `g:${l.repo.github.toLowerCase()}` : ''].filter(Boolean)),
    )
    const local: Choice[] = [
      ...(recents ?? []).map((p) => ({ id: `p:${p}`, label: baseName(p), detail: p, kind: 'local' as const, pick: { path: p } })),
      ...linked.filter((l) => !(recents ?? []).includes(l.path)).map((l) => ({ id: `p:${l.path}`, label: l.name, detail: l.path, kind: 'local' as const, pick: { path: l.path } })),
    ].filter((c) => !taken.has(c.id.toLowerCase()))
    const remote: Choice[] = (github?.repos ?? [])
      .map((r) => ({ id: `g:${r.fullName}`, label: r.fullName, detail: r.description || undefined, kind: 'github' as const, pick: { github: r.fullName } }))
      .filter((c) => !taken.has(c.id.toLowerCase()))
    const q = filter.trim().toLowerCase()
    const match = (c: Choice) => !q || c.label.toLowerCase().includes(q) || (c.detail ?? '').toLowerCase().includes(q)
    return { local: local.filter(match), remote: remote.filter(match) }
  }, [recents, linked, github, exclude, filter])

  const chooseFolder = () =>
    jiraApi()
      .pickRepoFolder()
      .then((dir) => dir && onPick({ path: dir }), (e) => onError(errorText(e)))

  return (
    <div className="mt-1 rounded-md border border-(--jp-border) bg-(--jp-raised)">
      <div className="flex items-center gap-2 border-b border-(--jp-border) px-2">
        <Search className="size-4 shrink-0 text-(--jp-subtlest)" />
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              onCancel()
            }
          }}
          placeholder="Find a repository"
          aria-label="Find a repository"
          className="h-8 min-w-0 flex-1 bg-transparent outline-none"
        />
        {busy && <Loader2 className="size-4 animate-spin text-(--jp-subtlest)" />}
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {recents === undefined && <div className="px-3 py-1.5 text-(--jp-subtle)">Loading…</div>}
        {choices.local.length > 0 && <div className="jp-overline px-3 pt-1.5 pb-1">On this computer</div>}
        {choices.local.map((c) => (
          <ChoiceRow key={c.id} choice={c} disabled={busy} onPick={onPick} />
        ))}
        {choices.remote.length > 0 && <div className="jp-overline px-3 pt-2 pb-1">On GitHub</div>}
        {choices.remote.map((c) => (
          <ChoiceRow key={c.id} choice={c} disabled={busy} onPick={onPick} />
        ))}
        {github && !github.connected && (
          <div className="px-3 py-1.5 text-xs text-(--jp-subtlest)">Set up GitHub on the Connections page to pick repos from GitHub too.</div>
        )}
        {recents !== undefined && !choices.local.length && !choices.remote.length && filter && (
          <div className="px-3 py-1.5 text-(--jp-subtle)">No repository matches “{filter}”.</div>
        )}
      </div>
      <div className="flex items-center gap-1 border-t border-(--jp-border) p-1">
        <button type="button" className="jp-btn jp-btn-subtle" disabled={busy} onClick={() => void chooseFolder()}>
          <FolderOpen /> Choose a folder…
        </button>
        <button type="button" className="jp-btn jp-btn-subtle ml-auto" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ChoiceRow({ choice, disabled, onPick }: { choice: Choice; disabled: boolean; onPick: (repo: { path?: string; github?: string }) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(choice.pick)}
      title={choice.detail}
      className="jp-focusable flex w-full min-w-0 items-center gap-2 px-3 py-1.5 text-left hover:bg-(--jp-hover) disabled:opacity-50"
    >
      {choice.kind === 'local' ? <FolderGit2 className="size-4 shrink-0 text-(--jp-subtle)" /> : <Cloud className="size-4 shrink-0 text-(--jp-subtle)" />}
      <span className="min-w-0 flex-1 truncate">{choice.label}</span>
      {choice.detail && <span className="max-w-[45%] shrink truncate text-xs text-(--jp-subtlest)">{choice.detail}</span>}
    </button>
  )
}
