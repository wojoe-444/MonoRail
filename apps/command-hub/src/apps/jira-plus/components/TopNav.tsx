import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Cloud, Plus, Search, Settings, SquareKanban } from 'lucide-react'

import { cn } from '@/lib/utils'

import { ProjectAvatar } from '../bits'
import { projectPath, useJira } from '../JiraContext'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './Menu'

/** 56px product bar: logo, Your work, Projects, Create, search, settings. */
export function TopNav() {
  const { projects, overview, openDialog, openIssue } = useJira()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [q, setQ] = useState('')
  const connection = overview?.connection

  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex h-8 items-center gap-1 rounded-[3px] px-2 font-medium text-(--jp-subtle) hover:bg-(--jp-hover) jp-focusable outline-none',
      isActive && 'text-(--jp-selected-fg) after:absolute after:inset-x-1 after:-bottom-3 after:h-[3px] after:rounded-t after:bg-(--jp-selected-fg)',
    )

  function search(e: React.FormEvent) {
    e.preventDefault()
    const key = q.trim().toUpperCase()
    if (!key) return
    // A ticket key jumps straight to the ticket; anything else searches Your work.
    const m = key.match(/^([A-Z][A-Z0-9]+)-\d+$/)
    const project = m && projects.find((p) => p.key === m[1])
    if (project) {
      openIssue(project.source, key)
      setQ('')
    } else navigate(`/?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--jp-border) bg-(--jp-bg) px-3">
      <NavLink to="/" className="jp-focusable mr-2 flex h-8 items-center gap-2 rounded-[3px] px-1 outline-none">
        <span className="flex size-6 items-center justify-center rounded-[4px] bg-(--jp-brand) text-(--jp-brand-fg)">
          <SquareKanban className="size-4" />
        </span>
        <span className="text-base font-semibold text-(--jp-text)">Jira+</span>
      </NavLink>
      <nav className="flex items-center gap-1">
        <NavLink to="/" end className={tab}>
          Your work
        </NavLink>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={tab({ isActive: pathname.startsWith('/projects') })}>
              Projects <ChevronDown className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent align="start" className="w-72">
            <MenuLabel>Projects</MenuLabel>
            {projects.map((p) => (
              <MenuItem key={`${p.source}:${p.key}`} onSelect={() => navigate(projectPath(p))}>
                <ProjectAvatar projectKey={p.key} local={p.source === 'local'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-xs text-(--jp-subtlest)">{p.source === 'local' ? 'Private project' : 'Team project'}</span>
                </span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem onSelect={() => navigate('/projects')}>View all projects</MenuItem>
            <MenuItem onSelect={() => openDialog('project')}>Create private project</MenuItem>
          </MenuContent>
        </Menu>
      </nav>
      <button type="button" className="jp-btn jp-btn-primary ml-2" onClick={() => openDialog('create')} disabled={!projects.length}>
        <Plus /> Create
      </button>

      <form onSubmit={search} className="relative ml-auto w-full max-w-60">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-(--jp-subtlest)" />
        <input
          aria-label="Search or jump to a ticket key"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="jp-field h-8 min-h-0 py-0 pl-8"
        />
      </form>
      {connection && !connection.connected && (
        <button type="button" className="jp-btn jp-btn-subtle" onClick={() => openDialog('connect')}>
          <Cloud /> Connect team Jira
        </button>
      )}
      {connection?.connected && (
        <span className="hidden items-center gap-1.5 text-xs text-(--jp-subtlest) xl:flex" title={connection.siteUrl}>
          <span className={cn('size-2 rounded-full', connection.error ? 'bg-(--jp-pri-medium)' : 'bg-(--jp-type-story)')} />
          {connection.siteUrl?.replace(/^https:\/\//, '')}
        </span>
      )}
      <button type="button" className="jp-btn jp-btn-subtle size-8 px-0" aria-label="Jira+ settings" title="Team Jira connection" onClick={() => openDialog('connect')}>
        <Settings />
      </button>
    </header>
  )
}
