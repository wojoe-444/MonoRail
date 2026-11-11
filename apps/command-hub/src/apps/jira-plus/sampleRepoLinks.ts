// Fictional task <-> repository links for the browser dev server, shared by
// the Jira+ and GitHub+ sample backends so both sides show the same links.
// Kept in memory only; the repos and tickets are the made-up sample ones.

import type { RepoLink, Source } from './types'

export interface SampleTaskRef {
  source: Source
  key: string
}
interface Row {
  issue: SampleTaskRef
  link: RepoLink
}

const ORBIT = { kind: 'local' as const, path: 'C:/Users/sample/Repos/orbit-notes', github: 'sample-dev/orbit-notes', name: 'orbit-notes' }

const folderKey = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
const repoId = (r: RepoLink['repo']) => (r.path ? `path:${folderKey(r.path)}` : `github:${(r.github ?? '').toLowerCase()}`)

let rows: Row[] = [
  { issue: { source: 'local', key: 'ME-2' }, link: { id: repoId(ORBIT), repo: ORBIT, linkedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() } },
  {
    issue: { source: 'jira', key: 'PLAT-112' },
    link: {
      id: 'github:acme-demo/platform-api',
      repo: { kind: 'github', github: 'acme-demo/platform-api', name: 'acme-demo/platform-api' },
      linkedAt: new Date(Date.now() - 86_400_000).toISOString(),
    },
  },
  { issue: { source: 'jira', key: 'WEB-431' }, link: { id: repoId(ORBIT), repo: ORBIT, linkedAt: new Date(Date.now() - 3_600_000).toISOString() } },
]

const same = (a: SampleTaskRef, b: SampleTaskRef) => a.source === b.source && a.key === b.key

export const sampleRepoLinks = {
  forIssue: (issue: SampleTaskRef): RepoLink[] => rows.filter((r) => same(r.issue, issue)).map((r) => structuredClone(r.link)),
  forRepo({ path, github }: { path?: string; github?: string | null }): { issue: SampleTaskRef; link: RepoLink }[] {
    const seen = new Set<string>()
    return rows
      .filter((r) => (path && r.link.repo.path && folderKey(r.link.repo.path) === folderKey(path)) || (github && r.link.repo.github?.toLowerCase() === github.toLowerCase()))
      .filter((r) => !seen.has(`${r.issue.source}:${r.issue.key}`) && !!seen.add(`${r.issue.source}:${r.issue.key}`))
      .map((r) => structuredClone(r))
  },
  counts() {
    const paths: Record<string, number> = {}
    const github: Record<string, number> = {}
    for (const { link } of rows) {
      if (link.repo.path) paths[folderKey(link.repo.path)] = (paths[folderKey(link.repo.path)] ?? 0) + 1
      if (link.repo.github) github[link.repo.github.toLowerCase()] = (github[link.repo.github.toLowerCase()] ?? 0) + 1
    }
    return { paths, github }
  },
  link(issue: SampleTaskRef, repo: RepoLink['repo']) {
    const id = repoId(repo)
    rows = rows.filter((r) => !(same(r.issue, issue) && r.link.id === id))
    rows.push({ issue: { ...issue }, link: { id, repo: { ...repo }, linkedAt: new Date().toISOString() } })
  },
  unlink(issue: SampleTaskRef, id: string) {
    rows = rows.filter((r) => !(same(r.issue, issue) && r.link.id === id))
  },
}

/** Lowercased, forward-slash folder path: how link counts are keyed. */
export const linkFolderKey = folderKey
