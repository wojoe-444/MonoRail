// Local Jira: personal projects backed by a git repository under AppData.
//
//   %APPDATA%\MonoRail\apps\jira-plus\local-repo\
//     README.md
//     projects/<KEY>/project.json        { key, name, description, nextNumber, created }
//     projects/<KEY>/issues/<KEY>-<n>.json
//
// An issue may name a parent issue in the same project (`parent: "ME-3"`),
// and keeps the time logged against it in `worklogs` (one entry per "Log
// time": started, seconds, comment). Totals and child issues are worked out
// when an issue is read; nothing derived is stored.
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

const { sleep, tryLock } = require('../../cache/files.cjs')

const AUTHOR = { name: 'MonoRail', email: 'local@monorail.invalid' }

/** Workflow for local projects. Board columns group by category. */
const STATUSES = [
  { name: 'To Do', category: 'todo' },
  { name: 'In Progress', category: 'in_progress' },
  { name: 'In Review', category: 'in_progress' },
  { name: 'Done', category: 'done' },
]
const TYPES = ['Task', 'Bug', 'Story', 'Spike', 'Epic', 'Sub-task']
const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest']

const README = `# MonoRail local Jira

This repository holds your personal Jira projects. MonoRail writes one JSON
file per ticket and commits every change, so \`git log\` is each ticket's history.

It lives in your local AppData and has no remote. Do not push it anywhere.
`

/** Longest single time log: a week of whole days. */
const MAX_WORKLOG_SECONDS = 7 * 24 * 3600

function categoryOf(status) {
  return STATUSES.find((s) => s.name === status)?.category ?? 'todo'
}

function validKey(key) {
  return typeof key === 'string' && /^[A-Z][A-Z0-9]{1,9}$/.test(key)
}

function createLocalStore(repoDir) {
  let ready
  let queue = Promise.resolve()

  // The app and the MCP server (electron/mcp) can both write here, so a lock
  // file in .git keeps writes from two processes apart too.
  const lockFile = path.join(repoDir, '.git', 'monorail-write.lock')
  async function locked(fn) {
    await ensureRepo()
    let release
    for (let waited = 0; !(release = await tryLock(lockFile, { staleMs: 60_000 })); waited += 50) {
      if (waited > 15_000) throw new Error('The local Jira repository is busy. Try again in a moment.')
      await sleep(50)
    }
    try {
      return await fn()
    } finally {
      await release()
    }
  }

  /** Run writes one at a time (in this process and across processes) so commits never interleave. */
  function serial(fn) {
    const run = () => locked(fn)
    const next = queue.then(run, run)
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

  async function projectNameOf(key) {
    try {
      return (await readJson(projectFile(key))).name
    } catch {
      return undefined
    }
  }

  async function readIssue(key) {
    return readJson(path.join(repoDir, issueRel(key)))
  }

  function summarize(raw) {
    const { comments = [], worklogs = [], parent, ...rest } = raw
    return {
      ...rest,
      ...(parent ? { parent: { key: parent } } : {}),
      source: 'local',
      statusCategory: categoryOf(raw.status),
      commentCount: comments.length,
      timeSpentSeconds: sumSeconds(worklogs),
    }
  }

  /** Every issue in a project, raw (with worklogs), keyed by issue key. */
  async function rawIssues(projectKey) {
    const dir = path.join(projectDir(projectKey), 'issues')
    let files = []
    try {
      files = (await fsp.readdir(dir)).filter((f) => f.endsWith('.json'))
    } catch {
      return new Map()
    }
    const issues = await Promise.all(files.map((f) => readJson(path.join(dir, f)).catch(() => undefined)))
    return new Map(issues.filter(Boolean).map((i) => [i.key, i]))
  }

  /** Keys of every issue below `key` (children, their children, ...). */
  function descendantsOf(key, all) {
    const out = new Set()
    const walk = (k) => {
      for (const i of all.values()) {
        if (i.parent === k && !out.has(i.key)) {
          out.add(i.key)
          walk(i.key)
        }
      }
    }
    walk(key)
    return out
  }

  /** Parent summary for one issue: key, summary, type and status. */
  function parentRef(raw, all) {
    const p = raw.parent && all.get(raw.parent)
    if (!raw.parent) return undefined
    if (!p) return { key: raw.parent, missing: true }
    return { key: p.key, summary: p.summary, type: p.type, status: p.status, statusCategory: categoryOf(p.status) }
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
    const all = new Map(issues.filter(Boolean).map((i) => [i.key, i]))
    const projectName = await projectNameOf(projectKey)
    return [...all.values()]
      .map((raw) => {
        const parent = parentRef(raw, all)
        return { ...summarize(raw), ...(parent ? { parent } : {}), projectName }
      })
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
    const all = await rawIssues(raw.projectKey)
    const below = descendantsOf(key, all)
    const children = [...all.values()]
      .filter((i) => i.parent === key)
      .map(summarize)
      .sort((a, b) => keyNumber(a.key) - keyNumber(b.key))
    const parent = parentRef(raw, all)
    const own = sumSeconds(raw.worklogs)
    return {
      ...summarize(raw),
      ...(parent ? { parent } : {}),
      projectName: await projectNameOf(raw.projectKey),
      comments: (raw.comments ?? []).map((c) => ({ ...c, mine: true })),
      worklogs: [...(raw.worklogs ?? [])].sort((a, b) => b.started.localeCompare(a.started)),
      children,
      timeTracking: {
        spentSeconds: own,
        // This issue plus everything below it, at any depth.
        totalSeconds: own + [...below].reduce((n, k) => n + sumSeconds(all.get(k)?.worklogs), 0),
      },

      history: await history(key),
      transitions: STATUSES.filter((s) => s.name !== current).map((s) => ({
        id: s.name,
        name: s.name,
        toStatus: s.name,
        toCategory: s.category,
      })),
    }
  }

  /** Throws unless `parent` is an issue in `projectKey` that is not `key` or below it. */
  async function checkParent(key, parent, projectKey) {
    const all = await rawIssues(projectKey)
    if (!all.has(parent)) throw new Error(`${parent} is not an issue in this project. A parent must be in the same project.`)
    if (key && (parent === key || descendantsOf(key, all).has(parent))) {
      throw new Error(`${parent} is ${parent === key ? 'this issue' : 'below this issue'}, so it can't be its parent.`)
    }
  }

  /** Issues `key` may be put under (or, without a key, any issue in the project): not itself or below it. */
  async function parentOptions({ projectKey, key }) {
    await ensureRepo()
    const all = await rawIssues(projectKey ?? String(key).split('-')[0])
    const below = key ? descendantsOf(key, all) : new Set()
    return [...all.values()]
      .filter((i) => i.key !== key && !below.has(i.key))
      .map((i) => ({ key: i.key, summary: i.summary, type: i.type, status: i.status, statusCategory: categoryOf(i.status) }))
      .sort((a, b) => keyNumber(b.key) - keyNumber(a.key))
  }

  return {
    meta: { statuses: STATUSES, types: TYPES, priorities: PRIORITIES, repoDir },
    listProjects,
    parentOptions,
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

    createIssue: ({ projectKey, summary, description, type, priority, labels, status, parent }) =>
      serial(async () => {
        await ensureRepo()
        summary = String(summary ?? '').trim()
        if (!summary) throw new Error('A ticket needs a summary.')
        const p = await readJson(projectFile(projectKey))
        if (type === 'Sub-task' && !parent) throw new Error('A sub-task needs a parent issue.')
        if (parent) {
          await checkParent(undefined, parent, p.key)
          if (type === 'Sub-task' && (await readIssue(parent)).type === 'Sub-task') throw new Error('A sub-task cannot be the parent of another sub-task.')
        }
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
          ...(parent ? { parent } : {}),
          created: now,
          updated: now,
          comments: [],
        }
        await writeAndCommit(
          [
            [`projects/${p.key}/project.json`, p],
            [issueRel(key), issue],
          ],
          `${key}: Created "${summary}"${parent ? ` under ${parent}` : ''}`,
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

    /** updateComment({ key, id, body }): local comments are all yours, so any may be edited. */
    updateComment: ({ key, id, body }) =>
      serial(async () => {
        await ensureRepo()
        body = String(body ?? '').trim()
        if (!body) throw new Error('Write something first.')
        const issue = await readIssue(key)
        const comment = (issue.comments ?? []).find((c) => c.id === id)
        if (!comment) throw new Error('That comment is gone.')
        if (comment.body === body) return comment
        comment.body = body
        comment.updated = new Date().toISOString()
        issue.updated = comment.updated
        await writeAndCommit([[issueRel(key), issue]], `${key}: Edited a comment`)
        return comment
      }),

    /** deleteComment({ key, id }): the comment stays in the repo's git history. */
    deleteComment: ({ key, id }) =>
      serial(async () => {
        await ensureRepo()
        const issue = await readIssue(key)
        const comments = issue.comments ?? []
        if (!comments.some((c) => c.id === id)) throw new Error('That comment is gone.')
        issue.comments = comments.filter((c) => c.id !== id)
        issue.updated = new Date().toISOString()
        await writeAndCommit([[issueRel(key), issue]], `${key}: Deleted a comment`)
        return { ok: true }
      }),

    /** setParent({ key, parent }): parent is an issue key in the same project, or null to remove it. */
    setParent: ({ key, parent }) =>
      serial(async () => {
        await ensureRepo()
        const issue = await readIssue(key)
        parent = parent ? String(parent).trim().toUpperCase() : null
        if (issue.type === 'Sub-task' && !parent) throw new Error('A sub-task needs a parent issue.')
        if (issue.type === 'Sub-task' && parent && (await readIssue(parent)).type === 'Sub-task') throw new Error('A sub-task cannot be the parent of another sub-task.')
        if ((issue.parent ?? null) === parent) return summarize(issue)
        if (parent) await checkParent(key, parent, issue.projectKey)
        const from = issue.parent
        if (parent) issue.parent = parent
        else delete issue.parent
        issue.updated = new Date().toISOString()
        const text = parent ? (from ? `Parent ${from} → ${parent}` : `Parent set to ${parent}`) : `Parent ${from} removed`
        await writeAndCommit([[issueRel(key), issue]], `${key}: ${text}`)
        return summarize(issue)
      }),

    /** logWork({ key, seconds, started?, comment? }): one time log entry. */
    logWork: ({ key, seconds, started, comment }) =>
      serial(async () => {
        await ensureRepo()
        const entry = worklogEntry({ seconds, started, comment })
        const issue = await readIssue(key)
        issue.worklogs = [...(issue.worklogs ?? []), entry]
        issue.updated = entry.created
        await writeAndCommit([[issueRel(key), issue]], `${key}: Logged ${formatSeconds(entry.seconds)}`)
        return entry
      }),

    deleteWorklog: ({ key, id }) =>
      serial(async () => {
        await ensureRepo()
        const issue = await readIssue(key)
        const entry = (issue.worklogs ?? []).find((w) => w.id === id)
        if (!entry) throw new Error('That time log is already gone.')
        issue.worklogs = issue.worklogs.filter((w) => w.id !== id)
        issue.updated = new Date().toISOString()
        await writeAndCommit([[issueRel(key), issue]], `${key}: Removed ${formatSeconds(entry.seconds)} time log`)
        return { ok: true }
      }),

    /** Deletes a ticket. Its child issues stay, without a parent, in the same commit. */
    deleteIssue: ({ key }) =>
      serial(async () => {
        await ensureRepo()
        const rel = issueRel(key)
        const all = await rawIssues(key.split('-')[0])
        for (const child of all.values()) {
          if (child.parent !== key) continue
          delete child.parent
          if (child.type === 'Sub-task') child.type = 'Task'
          child.updated = new Date().toISOString()
          const childRel = issueRel(child.key)
          await fsp.writeFile(path.join(repoDir, childRel), JSON.stringify(child, null, 2) + '\n')
          await git.add({ fs, dir: repoDir, filepath: childRel })
        }
        await fsp.rm(path.join(repoDir, rel))
        await git.remove({ fs, dir: repoDir, filepath: rel })
        await git.commit({ fs, dir: repoDir, message: `${key}: Deleted`, author: AUTHOR })
        return { ok: true }
      }),
  }
}

function sumSeconds(worklogs) {
  return (worklogs ?? []).reduce((n, w) => n + (Number(w.seconds) || 0), 0)
}

function keyNumber(key) {
  return Number(String(key).split('-')[1]) || 0
}

/** "1d 2h 30m" with 8-hour days, as Jira writes time. */
function formatSeconds(seconds) {
  let m = Math.round(seconds / 60)
  const d = Math.floor(m / 480)
  m -= d * 480
  const h = Math.floor(m / 60)
  m -= h * 60
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m'
}

/** A checked time log entry from what the page sent. */
function worklogEntry({ seconds, started, comment }) {
  seconds = Math.round(Number(seconds))
  if (!Number.isFinite(seconds) || seconds < 60) throw new Error('Log at least one minute.')
  if (seconds > MAX_WORKLOG_SECONDS) throw new Error('One time log can be at most a week. Split longer work into several logs.')
  const at = started ? new Date(started) : new Date()
  if (Number.isNaN(at.getTime())) throw new Error('Pick when the work started.')
  const now = new Date()
  return {
    id: `w${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    author: 'You',
    started: at.toISOString(),
    seconds,
    comment: String(comment ?? '').trim(),
    created: now.toISOString(),
  }
}

module.exports = { createLocalStore, formatSeconds, worklogEntry, STATUSES, TYPES, PRIORITIES, MAX_WORKLOG_SECONDS }
