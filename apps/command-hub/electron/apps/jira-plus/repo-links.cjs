// Links between tasks and code repositories.
//
// A task (a local Tasks ticket or a team Jira issue) can be linked to any
// number of repositories, and a repository to any number of tasks. A
// repository is either
//   - a local git repo, by its folder (the path git reports, as GitHub+ names
//     it), plus the "owner/name" of its github.com remote when it has one, or
//   - a repo on github.com that is not cloned here, by "owner/name" only.
// GitHub+ shows a repo's tasks by matching either one, so a link made to the
// GitHub copy also shows on a local clone of it, and the other way round.
//
// Links live in one file, <Tasks data>\repo-links.json. They are never
// written to Jira, to GitHub or into any repository. The file holds issue
// keys, repo folders and repo names only: no ticket text (team tickets are
// fetched on demand, see the cache declaration), no tokens.
//
// No Electron here, so tests run under plain Node.

const fs = require('node:fs/promises')
const path = require('node:path')

const LINKS_FILE = 'repo-links.json'
const VERSION = 1
const MAX_LINKS = 5000

const KEY_RE = /^[A-Z][A-Z0-9_]{0,49}-[1-9][0-9]{0,8}$/
const GITHUB_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/

function cleanIssue(issue) {
  const source = issue?.source
  if (source !== 'local' && source !== 'jira') throw new Error(`Unknown source: ${source}`)
  const key = String(issue?.key ?? '').trim().toUpperCase()
  if (!KEY_RE.test(key)) throw new Error(`Not an issue key: ${issue?.key}`)
  return { source, key }
}

function cleanGitHub(name) {
  if (name === undefined || name === null || name === '') return null
  if (typeof name !== 'string' || !GITHUB_RE.test(name)) throw new Error('Not a GitHub repository name (owner/name).')
  return name
}

/** How two folder paths compare: forward slashes, no trailing slash, case-insensitive on Windows. */
function folderKey(p) {
  const s = String(p).replace(/\\/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? s.toLowerCase() : s
}

/** A repo's identity in the file: its folder, or its GitHub name when it has no folder. */
function repoId(repo) {
  return repo.path ? `path:${folderKey(repo.path)}` : `github:${repo.github.toLowerCase()}`
}

/** True when a stored link points at the given repo (folder, or either side's GitHub name). */
function matches(link, { path: p, github }) {
  if (p && link.repo.path && folderKey(link.repo.path) === folderKey(p)) return true
  if (github && link.repo.github && link.repo.github.toLowerCase() === github.toLowerCase()) return true
  return false
}

function publicLink(l) {
  return {
    id: repoId(l.repo),
    issue: l.issue,
    repo: { ...l.repo, kind: l.repo.path ? 'local' : 'github' },
    linkedAt: l.linkedAt,
  }
}

function createRepoLinks(dir) {
  const file = path.join(dir, LINKS_FILE)
  let queue = Promise.resolve()
  const serial = (fn) => {
    const next = queue.then(fn, fn)
    queue = next.catch(() => undefined)
    return next
  }

  async function read() {
    let data
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8'))
    } catch (e) {
      if (e.code === 'ENOENT') return []
      throw new Error(`Could not read the repository links (${LINKS_FILE}): ${e.message}`)
    }
    if (data?.version !== VERSION || !Array.isArray(data.links)) return []
    return data.links.filter((l) => l?.issue && l?.repo && (l.repo.path || l.repo.github))
  }

  async function write(links) {
    await fs.mkdir(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify({ version: VERSION, links }, null, 2))
    await fs.rename(tmp, file)
  }

  return {
    file,

    /** Repos linked to one task, oldest link first. */
    async forIssue(issue) {
      const { source, key } = cleanIssue(issue)
      return (await read()).filter((l) => l.issue.source === source && l.issue.key === key).map(publicLink)
    },

    /** Tasks linked to a repo, matched by folder or GitHub name; one entry per task. */
    async forRepo({ path: p, github } = {}) {
      if (!p && !github) return []
      const seen = new Set()
      const out = []
      for (const l of await read()) {
        if (!matches(l, { path: p, github })) continue
        const id = `${l.issue.source}:${l.issue.key}`
        if (seen.has(id)) continue
        seen.add(id)
        out.push(publicLink(l))
      }
      return out
    },

    /** How many tasks each repo has: { paths: { folderKey: n }, github: { lower name: n } }. */
    async counts() {
      const paths = {}
      const github = {}
      for (const l of await read()) {
        if (l.repo.path) paths[folderKey(l.repo.path)] = (paths[folderKey(l.repo.path)] ?? 0) + 1
        if (l.repo.github) github[l.repo.github.toLowerCase()] = (github[l.repo.github.toLowerCase()] ?? 0) + 1
      }
      return { paths, github }
    },

    /**
     * Link a task to a repo: { path, name, github } for a local repo (the
     * caller has checked the folder is a repo root), { github } for a repo on
     * github.com. Linking the same pair again only refreshes the repo's names.
     */
    async link(issue, repo) {
      const i = cleanIssue(issue)
      const github = cleanGitHub(repo?.github)
      const p = typeof repo?.path === 'string' && repo.path.trim() ? repo.path : null
      if (!p && !github) throw new Error('Pick a repository to link.')
      const name = String(repo?.name || (p ? path.basename(p) : github.split('/')[1])).slice(0, 200)
      const entry = { issue: i, repo: { ...(p ? { path: p } : {}), ...(github ? { github } : {}), name }, linkedAt: new Date().toISOString() }
      return serial(async () => {
        const links = await read()
        const id = repoId(entry.repo)
        const at = links.findIndex((l) => l.issue.source === i.source && l.issue.key === i.key && repoId(l.repo) === id)
        if (at >= 0) links[at] = { ...entry, linkedAt: links[at].linkedAt }
        else {
          if (links.length >= MAX_LINKS) throw new Error('Too many repository links.')
          links.push(entry)
        }
        await write(links)
        return publicLink(entry)
      })
    },

    /** Remove one task-repo link by the repo's id (from forIssue / forRepo). */
    async unlink(issue, id) {
      const i = cleanIssue(issue)
      return serial(async () => {
        const links = await read()
        const next = links.filter((l) => !(l.issue.source === i.source && l.issue.key === i.key && repoId(l.repo) === id))
        if (next.length !== links.length) await write(next)
        return next.length !== links.length
      })
    },

    /** Drop every link of a task (the task was deleted). */
    async removeIssue(issue) {
      const i = cleanIssue(issue)
      return serial(async () => {
        const links = await read()
        const next = links.filter((l) => !(l.issue.source === i.source && l.issue.key === i.key))
        if (next.length !== links.length) await write(next)
      })
    },
  }
}

module.exports = { createRepoLinks, LINKS_FILE, folderKey, repoId }
