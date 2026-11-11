// Local Jira: personal projects backed by a git repository under AppData.
//
//   %APPDATA%\MonoHub\modules\jira\local-repo\
//     README.md
//     projects/<KEY>/project.json        { key, name, description, nextNumber, created }
//     projects/<KEY>/issues/<KEY>-<n>.json
//
// Every change is a commit, so the history of a ticket is the git log of its
// file. The repository never gets a remote: it is not pushed anywhere, and it
// lives outside the MonoRail checkout, so it can never be committed there.
//
// isomorphic-git (pure JavaScript) does the git work, so this runs without a
// git install and from inside the packaged app.asar.

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const git = require('isomorphic-git')

const AUTHOR = { name: 'MonoHub', email: 'local@monohub.invalid' }

/** Workflow for local projects. Board columns group by category. */
const STATUSES = [
  { name: 'To Do', category: 'todo' },
  { name: 'In Progress', category: 'in_progress' },
  { name: 'In Review', category: 'in_progress' },
  { name: 'Done', category: 'done' },
]
const TYPES = ['Task', 'Bug', 'Story', 'Spike']
const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest']

const README = `# MonoHub local Jira

This repository holds your personal Jira projects. MonoHub writes one JSON
file per ticket and commits every change, so \`git log\` is each ticket's history.

It lives in your local AppData and has no remote. Do not push it anywhere.
`

function categoryOf(status) {
  return STATUSES.find((s) => s.name === status)?.category ?? 'todo'
}

function validKey(key) {
  return typeof key === 'string' && /^[A-Z][A-Z0-9]{1,9}$/.test(key)
}

function createLocalStore(repoDir) {
  let ready
  let queue = Promise.resolve()

  /** Run writes one at a time so commits never interleave. */
  function serial(fn) {
    const next = queue.then(fn, fn)
    queue = next.catch(() => {})
    return next
  }

  async function ensureRepo() {
    if (!ready) {
      ready = (async () => {
        await fsp.mkdir(path.join(repoDir, 'projects'), { recursive: true })
        if (!fs.existsSync(path.join(repoDir, '.git'))) {
          await git.init({ fs, dir: repoDir, defaultBranch: 'main' })
          await fsp.writeFile(path.join(repoDir, 'README.md'), README)
          await git.add({ fs, dir: repoDir, filepath: 'README.md' })
          await git.commit({ fs, dir: repoDir, message: 'Create local Jira repository', author: AUTHOR })
        }
      })().catch((e) => {
        ready = undefined
        throw e
      })
    }
    return ready
  }

  const projectDir = (key) => path.join(repoDir, 'projects', key)
  const projectFile = (key) => path.join(projectDir(key), 'project.json')
  const issueRel = (key) => `projects/${key.split('-')[0]}/issues/${key}.json`

  async function readJson(file) {
    return JSON.parse(await fsp.readFile(file, 'utf8'))
  }

  async function writeAndCommit(files, message) {
    for (const [rel, data] of files) {
      const abs = path.join(repoDir, rel)
      await fsp.mkdir(path.dirname(abs), { recursive: true })
      await fsp.writeFile(abs, JSON.stringify(data, null, 2) + '\n')
      await git.add({ fs, dir: repoDir, filepath: rel })
    }
    await git.commit({ fs, dir: repoDir, message, author: AUTHOR })
  }

  async function listProjects() {
    await ensureRepo()
    const entries = await fsp.readdir(path.join(repoDir, 'projects'), { withFileTypes: true })
    const projects = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      try {
        const p = await readJson(projectFile(e.name))
        const issues = await listIssues(p.key)
        projects.push({
          key: p.key,
          name: p.name,
          description: p.description ?? '',
          source: 'local',
          issueCount: issues.length,
          openCount: issues.filter((i) => i.statusCategory !== 'done').length,
        })
      } catch {
        // Not a project folder; skip it.
      }
    }
    return projects.sort((a, b) => a.name.localeCompare(b.name))
  }

  async function readIssue(key) {
    return readJson(path.join(repoDir, issueRel(key)))
  }

  function summarize(raw) {
    const { comments = [], ...rest } = raw
    return { ...rest, source: 'local', statusCategory: categoryOf(raw.status), commentCount: comments.length }
  }

  async function listIssues(projectKey) {
    await ensureRepo()
    const dir = path.join(projectDir(projectKey), 'issues')
    let files = []
    try {
      files = (await fsp.readdir(dir)).filter((f) => f.endsWith('.json'))
    } catch {
      return []
    }
    const issues = await Promise.all(files.map((f) => readJson(path.join(dir, f)).catch(() => undefined)))
    return issues
      .filter(Boolean)
      .map(summarize)
      .sort((a, b) => b.updated.localeCompare(a.updated))
  }

  async function history(key) {
    try {
      const commits = await git.log({ fs, dir: repoDir, filepath: issueRel(key), force: true })
      return commits.map((c) => ({
        id: c.oid,
        at: new Date(c.commit.author.timestamp * 1000).toISOString(),
        // Messages look like "ME-4: Status To Do -> In Progress"; drop the key.
        text: c.commit.message.trim().replace(new RegExp(`^${key}:\\s*`), ''),
      }))
    } catch {
      return []
    }
  }

  async function getIssue(key) {
    await ensureRepo()
    const raw = await readIssue(key)
    const current = raw.status
    return {
      ...summarize(raw),
      comments: raw.comments ?? [],
      history: await history(key),
      transitions: STATUSES.filter((s) => s.name !== current).map((s) => ({
        id: s.name,
        name: s.name,
        toStatus: s.name,
        toCategory: s.category,
      })),
    }
  }

  return {
    meta: { statuses: STATUSES, types: TYPES, priorities: PRIORITIES, repoDir },
    listProjects,
    listIssues,
    getIssue,

    createProject: ({ key, name, description }) =>
      serial(async () => {
        await ensureRepo()
        key = String(key ?? '').trim().toUpperCase()
        name = String(name ?? '').trim()
        if (!validKey(key)) throw new Error('Project keys are 2 to 10 letters or digits and start with a letter.')
        if (!name) throw new Error('Give the project a name.')
        if (fs.existsSync(projectFile(key))) throw new Error(`A local project with key ${key} already exists.`)
        const project = { key, name, description: description ?? '', nextNumber: 1, created: new Date().toISOString() }
        await writeAndCommit([[`projects/${key}/project.json`, project]], `${key}: Create project "${name}"`)
        return { ...project, source: 'local', issueCount: 0, openCount: 0 }
      }),

    updateProject: ({ key, name, description }) =>
      serial(async () => {
        await ensureRepo()
        const p = await readJson(projectFile(key))
        if (name !== undefined) p.name = String(name).trim() || p.name
        if (description !== undefined) p.description = String(description)
        await writeAndCommit([[`projects/${key}/project.json`, p]], `${key}: Update project details`)
        return p
      }),

    createIssue: ({ projectKey, summary, description, type, priority, labels, status }) =>
      serial(async () => {
        await ensureRepo()
        summary = String(summary ?? '').trim()
        if (!summary) throw new Error('A ticket needs a summary.')
        const p = await readJson(projectFile(projectKey))
        const key = `${p.key}-${p.nextNumber}`
        p.nextNumber += 1
        const now = new Date().toISOString()
        const issue = {
          key,
          projectKey: p.key,
          summary,
          description: description ?? '',
          type: TYPES.includes(type) ? type : 'Task',
          priority: PRIORITIES.includes(priority) ? priority : 'Medium',
          status: STATUSES.some((s) => s.name === status) ? status : 'To Do',
          assignee: 'You',
          reporter: 'You',
          labels: Array.isArray(labels) ? labels : [],
          created: now,
          updated: now,
          comments: [],
        }
        await writeAndCommit(
          [
            [`projects/${p.key}/project.json`, p],
            [issueRel(key), issue],
          ],
          `${key}: Created "${summary}"`,
        )
        return summarize(issue)
      }),

    updateIssue: ({ key, fields }) =>
      serial(async () => {
        await ensureRepo()
        const issue = await readIssue(key)
        const changed = []
        for (const f of ['summary', 'description', 'type', 'priority', 'labels']) {
          if (fields?.[f] === undefined) continue
          if (JSON.stringify(issue[f]) === JSON.stringify(fields[f])) continue
          if (f === 'summary' && !String(fields.summary).trim()) throw new Error('A ticket needs a summary.')
          issue[f] = f === 'summary' ? String(fields.summary).trim() : fields[f]
          changed.push(f === 'summary' || f === 'description' ? f : `${f} → ${Array.isArray(fields[f]) ? fields[f].join(', ') || 'none' : fields[f]}`)
        }
        if (!changed.length) return summarize(issue)
        issue.updated = new Date().toISOString()
        await writeAndCommit([[issueRel(key), issue]], `${key}: Edited ${changed.join('; ')}`)
        return summarize(issue)
      }),

    transitionIssue: ({ key, transitionId }) =>
      serial(async () => {
        await ensureRepo()
        const issue = await readIssue(key)
        if (!STATUSES.some((s) => s.name === transitionId)) throw new Error(`Unknown status: ${transitionId}`)
        if (issue.status === transitionId) return summarize(issue)
        const from = issue.status
        issue.status = transitionId
        issue.updated = new Date().toISOString()
        await writeAndCommit([[issueRel(key), issue]], `${key}: Status ${from} → ${transitionId}`)
        return summarize(issue)
      }),

    addComment: ({ key, body }) =>
      serial(async () => {
        await ensureRepo()
        body = String(body ?? '').trim()
        if (!body) throw new Error('Write something first.')
        const issue = await readIssue(key)
        const comment = { id: `c${Date.now()}`, author: 'You', body, created: new Date().toISOString() }
        issue.comments = [...(issue.comments ?? []), comment]
        issue.updated = comment.created
        await writeAndCommit([[issueRel(key), issue]], `${key}: Commented`)
        return comment
      }),

    deleteIssue: ({ key }) =>
      serial(async () => {
        await ensureRepo()
        const rel = issueRel(key)
        await fsp.rm(path.join(repoDir, rel))
        await git.remove({ fs, dir: repoDir, filepath: rel })
        await git.commit({ fs, dir: repoDir, message: `${key}: Deleted`, author: AUTHOR })
        return { ok: true }
      }),
  }
}

module.exports = { createLocalStore, STATUSES, TYPES, PRIORITIES }
