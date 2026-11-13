// GitHub+ local issues: an issue tracker stored inside the repository itself.
//
// Local-Repo-UI's roadmap named "local issues stored in the repo (e.g. a
// refs/-based store)"; this is that store. Every issue is one JSON file
// (`<number>.json`) in the tree of a commit that the ref `refs/local-issues`
// points at. Each change writes a new commit on that ref with git plumbing
// (hash-object, mktree, commit-tree, update-ref), so:
//   - the checked-out files and the index are never touched,
//   - every change is history (`git log refs/local-issues`),
//   - backups (`git bundle --all`) and clones of a bundle carry the issues,
//   - a normal `git push` does not send them (only refs/heads and tags).
//
// Like the rest of GitHub+, only the local git binary runs, with repo config
// that could run programs disabled.

const { spawn } = require('node:child_process')
const os = require('node:os')

const ISSUES_REF = 'refs/local-issues'
const ZERO = '0000000000000000000000000000000000000000'
const MAX_TITLE = 256
const MAX_BODY = 65_536
const MAX_COMMENTS = 2_000
const MAX_ISSUES = 10_000
const FALLBACK_EMAIL = 'local@githubplus.invalid'

function git(cwd, args, { input, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'git',
      ['-c', 'core.quotepath=false', '-c', 'color.ui=false', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', ...args],
      { cwd, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env } },
    )
    const out = []
    const err = []
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => err.push(d))
    child.on('error', (e) => reject(e.code === 'ENOENT' ? new Error('git was not found. Install Git for Windows and make sure it is on PATH.') : e))
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out).toString('utf8'))
      else reject(Object.assign(new Error(Buffer.concat(err).toString('utf8').trim() || `git exited with ${code}`), { exitCode: code }))
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(input ?? '')
  })
}

/** The commit `refs/local-issues` points at, or null when the repo has no issues yet. */
async function tip(repo) {
  try {
    return (await git(repo, ['rev-parse', '--verify', '-q', `${ISSUES_REF}^{commit}`])).trim() || null
  } catch {
    return null
  }
}

/** [{ number, sha }] for every issue file at the tip. */
async function entries(repo, commit) {
  if (!commit) return []
  const out = await git(repo, ['ls-tree', '-z', commit])
  return out
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta, name] = line.split('\t')
      const [, type, sha] = meta.split(' ')
      const m = type === 'blob' && /^([1-9]\d{0,6})\.json$/.exec(name)
      return m ? { number: Number(m[1]), sha } : null
    })
    .filter(Boolean)
}

/** Read many blobs in one `git cat-file --batch` call. */
async function readBlobs(repo, shas) {
  if (shas.length === 0) return []
  const raw = await new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], { cwd: repo, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } })
    const out = []
    child.stdout.on('data', (d) => out.push(d))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error('Could not read issues'))))
    child.stdin.end(shas.join('\n') + '\n')
  })
  const blobs = []
  let pos = 0
  for (let i = 0; i < shas.length; i++) {
    const nl = raw.indexOf(10, pos)
    const header = raw.subarray(pos, nl).toString('utf8').split(' ')
    const size = Number(header[2])
    blobs.push(raw.subarray(nl + 1, nl + 1 + size).toString('utf8'))
    pos = nl + 1 + size + 1
  }
  return blobs
}

function parse(json, number) {
  try {
    const v = JSON.parse(json)
    if (!v || typeof v !== 'object') return null
    return {
      number,
      title: String(v.title ?? ''),
      body: String(v.body ?? ''),
      state: v.state === 'closed' ? 'closed' : 'open',
      author: String(v.author ?? ''),
      createdAt: String(v.createdAt ?? ''),
      updatedAt: String(v.updatedAt ?? v.createdAt ?? ''),
      closedAt: v.closedAt ? String(v.closedAt) : null,
      timeline: Array.isArray(v.timeline) ? v.timeline.filter((t) => t && typeof t === 'object') : [],
      github: cleanGitHubLink(v.github),
    }
  } catch {
    return null
  }
}

// Parsed issues by repo and tip commit. A commit never changes, so this needs
// no invalidation: any write moves the tip and the next read misses. It saves
// two git processes on every tab badge and list (one `rev-parse` remains).
const parsed = new Map()
const MAX_PARSED = 24

async function readAll(repo) {
  const commit = await tip(repo)
  const key = `${repo}\0${commit}`
  const hit = parsed.get(key)
  if (hit) return { commit, issues: hit }
  const list = await entries(repo, commit)
  const blobs = await readBlobs(repo, list.map((e) => e.sha))
  const issues = list.map((e, i) => parse(blobs[i], e.number)).filter(Boolean)
  parsed.set(key, issues)
  if (parsed.size > MAX_PARSED) parsed.delete(parsed.keys().next().value)
  return { commit, issues }
}

const summary = ({ body: _b, timeline, ...i }) => ({ ...i, comments: timeline.filter((t) => t.kind === 'comment').length })

/** Issues, newest first. state: 'open' | 'closed' | 'all'. */
async function listIssues(repo, state = 'open') {
  const { issues } = await readAll(repo)
  return issues
    .filter((i) => state === 'all' || i.state === state)
    .sort((a, b) => b.number - a.number)
    .map(summary)
}

/** Counts for the tab badge and the home page. */
async function issueCounts(repo) {
  const { issues } = await readAll(repo)
  const open = issues.filter((i) => i.state === 'open').length
  return { open, closed: issues.length - open }
}

async function getIssue(repo, number) {
  const n = assertNumber(number)
  const { issues } = await readAll(repo)
  const issue = issues.find((i) => i.number === n)
  if (!issue) throw new Error(`Issue #${n} was not found`)
  return issue
}

function assertNumber(n) {
  const v = Number(n)
  if (!Number.isInteger(v) || v < 1 || v > 9_999_999) throw new Error('Invalid issue number')
  return v
}

/**
 * An issue that was also created on GitHub records where: { repo: 'owner/name',
 * number, url }. Anything else reads as a local-only issue (null).
 */
function cleanGitHubLink(g) {
  if (!g || typeof g !== 'object') return null
  const repo = String(g.repo ?? '')
  const number = Number(g.number)
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(repo) || !Number.isInteger(number) || number < 1) return null
  return { repo, number, url: `https://github.com/${repo}/issues/${number}` }
}

function cleanTitle(t) {
  if (typeof t !== 'string' || !t.trim()) throw new Error('An issue needs a title')
  if (t.length > MAX_TITLE) throw new Error(`Titles are limited to ${MAX_TITLE} characters`)
  return t.trim().replace(/[\r\n]+/g, ' ')
}

function cleanBody(b) {
  if (b == null) return ''
  if (typeof b !== 'string') throw new Error('Invalid text')
  if (b.length > MAX_BODY) throw new Error('That text is too long')
  return b.replace(/\r\n/g, '\n')
}

/** Who to record as the author: git's user.name for this repo, else the OS user. */
async function identity(repo) {
  const get = (k) => git(repo, ['config', '--get', k]).then((s) => s.trim(), () => '')
  const [name, email] = await Promise.all([get('user.name'), get('user.email')])
  let fallback = 'local user'
  try {
    fallback = os.userInfo().username || fallback
  } catch {
    /* ignore */
  }
  return { name: name || fallback, email: email || FALLBACK_EMAIL }
}

/** Writes are serialized per repo; update-ref's old value also guards against other writers. */
const queues = new Map()
function serialized(repo, fn) {
  const prev = queues.get(repo) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  queues.set(repo, next.catch(() => undefined))
  return next
}

/** Read the store, let `change` edit one issue, then commit the result to refs/local-issues. */
function mutate(repo, message, change) {
  return serialized(repo, async () => {
    const commit = await tip(repo)
    const list = await entries(repo, commit)
    const who = await identity(repo)
    const now = new Date().toISOString()
    const { number, issue } = await change({ list, who, now })
    const json = JSON.stringify(
      { number, title: issue.title, body: issue.body, state: issue.state, author: issue.author, createdAt: issue.createdAt, updatedAt: issue.updatedAt, closedAt: issue.closedAt, timeline: issue.timeline, ...(issue.github ? { github: issue.github } : {}) },
      null,
      2,
    ) + '\n'
    const blob = (await git(repo, ['hash-object', '-w', '--stdin'], { input: json })).trim()
    const others = list.filter((e) => e.number !== number)
    const tree = (await git(repo, ['mktree', '-z'], {
      input: [...others.map((e) => `100644 blob ${e.sha}\t${e.number}.json`), `100644 blob ${blob}\t${number}.json`].map((l) => l + '\0').join(''),
    })).trim()
    const env = { GIT_AUTHOR_NAME: who.name, GIT_AUTHOR_EMAIL: who.email, GIT_COMMITTER_NAME: who.name, GIT_COMMITTER_EMAIL: who.email }
    const next = (await git(repo, ['commit-tree', '--no-gpg-sign', tree, ...(commit ? ['-p', commit] : []), '-m', `${message} #${number}`], { env })).trim()
    await git(repo, ['update-ref', '-m', `GitHub+: ${message} #${number}`, ISSUES_REF, next, commit ?? ZERO])
    return parse(json, number)
  })
}

async function createIssue(repo, { title, body, github } = {}) {
  const t = cleanTitle(title)
  const b = cleanBody(body)
  const link = github === undefined ? null : cleanGitHubLink(github)
  if (github !== undefined && !link) throw new Error('Invalid GitHub link')
  return mutate(repo, 'Open issue', async ({ list, who, now }) => {
    if (list.length >= MAX_ISSUES) throw new Error('This repository has too many issues')
    const number = list.reduce((m, e) => Math.max(m, e.number), 0) + 1
    return { number, issue: { title: t, body: b, state: 'open', author: who.name, createdAt: now, updatedAt: now, closedAt: null, timeline: [], github: link } }
  })
}

async function load(repo, list, number) {
  const e = list.find((x) => x.number === number)
  if (!e) throw new Error(`Issue #${number} was not found`)
  const [json] = await readBlobs(repo, [e.sha])
  const issue = parse(json, number)
  if (!issue) throw new Error(`Issue #${number} could not be read`)
  return issue
}

/** Edit the title/body and/or close or reopen. Closing and reopening go on the timeline. */
async function updateIssue(repo, number, { title, body, state } = {}) {
  const n = assertNumber(number)
  const t = title === undefined ? undefined : cleanTitle(title)
  const b = body === undefined ? undefined : cleanBody(body)
  if (state !== undefined && state !== 'open' && state !== 'closed') throw new Error('Invalid state')
  const message = state === 'closed' ? 'Close issue' : state === 'open' ? 'Reopen issue' : 'Edit issue'
  return mutate(repo, message, async ({ list, who, now }) => {
    const issue = await load(repo, list, n)
    if (t !== undefined) issue.title = t
    if (b !== undefined) issue.body = b
    if (state && state !== issue.state) {
      if (issue.timeline.length >= MAX_COMMENTS) throw new Error('This issue has too many entries')
      issue.state = state
      issue.closedAt = state === 'closed' ? now : null
      issue.timeline.push({ kind: state === 'closed' ? 'closed' : 'reopened', author: who.name, at: now })
    }
    issue.updatedAt = now
    return { number: n, issue }
  })
}

async function addComment(repo, number, { body } = {}) {
  const n = assertNumber(number)
  const b = cleanBody(body)
  if (!b.trim()) throw new Error('A comment needs some text')
  return mutate(repo, 'Comment on issue', async ({ list, who, now }) => {
    const issue = await load(repo, list, n)
    if (issue.timeline.length >= MAX_COMMENTS) throw new Error('This issue has too many comments')
    issue.timeline.push({ kind: 'comment', author: who.name, at: now, body: b })
    issue.updatedAt = now
    return { number: n, issue }
  })
}

module.exports = { ISSUES_REF, listIssues, issueCounts, getIssue, createIssue, updateIssue, addComment, cleanTitle, cleanBody }
