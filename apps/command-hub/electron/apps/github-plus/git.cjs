// GitHub+ app: read-only wrapper around the local `git` CLI.
// Ported from wojoe-444/Local-Repo-UI (src/main/git.ts).
//
// Everything stays on the machine: only the local git binary runs, against
// committed content at a ref, so the working tree is never touched. Refs and
// paths come from the renderer and are validated so they can't be parsed as
// git options or escape the repo. Repo config that would run programs
// (textconv, external diff, fsmonitor) is disabled per call.

const { execFile, spawn } = require('node:child_process')
const { basename } = require('node:path')

const { parseDiff } = require('./diff.cjs')

const MAX_BUFFER = 64 * 1024 * 1024
const MAX_TEXT_BYTES = 1024 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_DIFF_FILES = 300
const MAX_DIFF_LINES_PER_FILE = 5000

// Speed notes. Starting a process is the expensive part of every call here,
// most of all on Windows (Git for Windows plus antivirus), and Node starts
// each one synchronously on the main process, so a burst of them stalls IPC
// for the whole app. So: as few git processes per page as possible, at most
// MAX_PARALLEL at a time, and answers that depend only on a commit sha (which
// never changes) are memoized in memory for the session. Nothing is cached
// to disk: commit subjects and file names are repo content.
const MAX_PARALLEL = 6
let active = 0
const waiting = []

async function slot(fn) {
  if (active >= MAX_PARALLEL) await new Promise((r) => waiting.push(r))
  active++
  try {
    return await fn()
  } finally {
    active--
    waiting.shift()?.()
  }
}

/** A small in-memory LRU of promises; a rejected promise is dropped so the next call retries. */
function memo(max) {
  const m = new Map()
  return {
    get(key, fn) {
      if (m.has(key)) {
        const v = m.get(key)
        m.delete(key)
        m.set(key, v)
        return v
      }
      const p = fn()
      m.set(key, p)
      if (m.size > max) m.delete(m.keys().next().value)
      p.catch(() => m.get(key) === p && m.delete(key))
      return p
    },
    clear: () => m.clear(),
  }
}

const GIT_CONFIG = ['-c', 'core.quotepath=false', '-c', 'color.ui=false', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat']
const GIT_ENV = () => ({ ...process.env, GIT_OPTIONAL_LOCKS: '0' })

function run(cwd, args) {
  return slot(() => runNow(cwd, args))
}

function runNow(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [...GIT_CONFIG, ...args],
      { cwd, encoding: 'buffer', maxBuffer: MAX_BUFFER, windowsHide: true, env: GIT_ENV() },
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === 'ENOENT') return reject(new Error('git was not found. Install Git for Windows and make sure it is on PATH.'))
          const msg = stderr?.toString('utf8').trim() || err.message
          reject(new Error(msg))
        } else resolve(stdout)
      },
    )
  })
}

const text = async (cwd, args) => (await run(cwd, args)).toString('utf8')

/** Refs/revisions come from the UI; never allow them to be parsed as git options. */
function assertRef(ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\0\r\n]/.test(ref)) throw new Error(`Invalid ref: ${ref}`)
  return ref
}

/** Paths are used inside `ref:path` or after `--`; just reject traversal and NULs. */
function assertPath(p) {
  if (typeof p !== 'string') throw new Error('Invalid path')
  const clean = p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (clean.includes('\0') || clean.split('/').some((seg) => seg === '..')) throw new Error(`Invalid path: ${p}`)
  return clean
}

async function openRepo(dir) {
  if (typeof dir !== 'string' || !dir) throw new Error('Invalid folder')
  let root
  try {
    root = (await text(dir, ['rev-parse', '--show-toplevel'])).trim()
  } catch (e) {
    if (/git was not found/.test(e.message)) throw e
    throw new Error(`"${dir}" is not inside a git repository`)
  }
  // On Windows git prints forward slashes; keep what git gives us for stable identity.
  const [headSha, currentBranch, branches] = await Promise.all([
    text(root, ['rev-parse', '--verify', '-q', 'HEAD']).then((s) => s.trim(), () => null),
    text(root, ['symbolic-ref', '--short', '-q', 'HEAD']).then((s) => s.trim() || null, () => null),
    text(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']).then((s) => s.split('\n').filter(Boolean)),
  ])
  let defaultRef = currentBranch
  if (!defaultRef) defaultRef = ['main', 'master'].find((b) => branches.includes(b)) ?? branches[0] ?? (headSha ? 'HEAD' : null)
  return { path: root, name: basename(root), currentBranch, headSha, isEmpty: !headSha && branches.length === 0, defaultRef }
}

/** Branches and tags, newest first. Ahead/behind is a separate call (branchDivergence), so opening a repo stays one process. */
async function listRefs(repo) {
  const SEP = '\x1f'
  const fmt = ['%(refname)', '%(objectname)', '%(*objectname)', '%(creatordate:iso-strict)', '%(authorname)', '%(taggername)', '%(contents:subject)', '%(HEAD)'].join(SEP)
  const out = await text(repo, ['for-each-ref', `--format=${fmt}`, '--sort=-creatordate', 'refs/heads', 'refs/tags'])
  const refs = out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [full, sha, peeled, date, author, tagger, subject, head] = line.split(SEP)
      const isTag = full.startsWith('refs/tags/')
      return {
        name: full.replace(/^refs\/(heads|tags)\//, ''),
        type: isTag ? 'tag' : 'branch',
        sha: peeled || sha,
        isCurrent: head === '*',
        date,
        author: author || tagger,
        subject,
      }
    })
  return refs
}

/**
 * The entries of one folder at a ref, folders first. One process. The last
 * commit per entry is a second call (treeLastCommits), so the file list shows
 * at once and the commit column fills in after.
 */
async function listTree(repo, ref, dirPath, withLastCommit = false) {
  assertRef(ref)
  const dir = assertPath(dirPath)
  const args = ['ls-tree', '-z', '-l', ref, '--']
  if (dir) args.push(dir + '/')
  const out = (await run(repo, args)).toString('utf8')
  const entries = out
    .split('\0')
    .filter(Boolean)
    .map((rec) => {
      const [meta, full] = rec.split('\t')
      const [mode, objType, , size] = meta.trim().split(/\s+/)
      const type = objType === 'tree' ? 'dir' : mode === '160000' ? 'submodule' : mode === '120000' ? 'symlink' : 'file'
      return { name: full.slice(dir ? dir.length + 1 : 0), path: full, type, size: size === '-' ? null : Number(size) }
    })
  entries.sort(
    (a, b) => (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
  if (withLastCommit) {
    const last = await treeLastCommits(repo, ref, dir)
    for (const e of entries) if (last[e.name]) e.lastCommit = last[e.name]
  }
  return entries
}

/** The commit a ref points at (peeled), so results can be memoized by something that never changes. */
async function resolveCommit(repo, ref) {
  assertRef(ref)
  const sha = await text(repo, ['rev-parse', '--verify', '-q', `${ref}^{commit}`]).then((s) => s.trim(), () => '')
  if (!/^[0-9a-f]{40,64}$/.test(sha)) throw new Error(`Unknown ref: ${ref}`)
  return sha
}

const LAST_COMMIT_TIME_LIMIT_MS = 20_000
const lastCommitMemo = memo(300)

/**
 * { [entry name]: { sha, subject, date } }: the newest commit that touched
 * each entry of a folder. One `git log --name-only` walk for the whole
 * folder, stopped as soon as every entry has its commit (it used to be one
 * `git log -1` per entry, up to 150 processes per folder). Memoized by commit
 * sha and folder, so revisiting a folder costs one `rev-parse`.
 */
async function treeLastCommits(repo, ref, dirPath) {
  const dir = assertPath(dirPath)
  const sha = await resolveCommit(repo, ref)
  return lastCommitMemo.get(`${repo}\0${sha}\0${dir}`, async () => {
    const out = (await run(repo, ['ls-tree', '-z', '--name-only', sha, '--', ...(dir ? [dir + '/'] : [])])).toString('utf8')
    const names = out.split('\0').filter(Boolean).map((full) => full.slice(dir ? dir.length + 1 : 0))
    return walkLastCommits(repo, sha, dir, names)
  })
}

function walkLastCommits(repo, sha, dir, names) {
  const pending = new Set(names)
  const found = {}
  if (pending.size === 0) return Promise.resolve(found)
  const prefix = dir ? dir + '/' : ''
  return slot(
    () =>
      new Promise((resolve, reject) => {
        const args = [...GIT_CONFIG, 'log', '--format=%x1e%H%x1f%s%x1f%aI', '--name-only', '-c', '-z', '--no-renames', sha, '--']
        if (dir) args.push(prefix)
        const child = spawn('git', args, { cwd: repo, windowsHide: true, env: GIT_ENV(), stdio: ['ignore', 'pipe', 'ignore'] })
        let buf = ''
        let done = false
        const stop = () => {
          clearTimeout(timer)
          done = true
          if (child.exitCode === null) child.kill()
        }
        const finish = () => {
          if (done) return
          stop()
          resolve(found)
        }
        // A folder whose entries have not changed in a very long history: keep what was found.
        const timer = setTimeout(finish, LAST_COMMIT_TIME_LIMIT_MS)
        // One record: "<sha>\x1f<subject>\x1f<date>\0\n<file>\0<file>\0..."
        const take = (rec) => {
          const nul = rec.indexOf('\0')
          if (nul < 0) return
          const [csha, subject, date] = rec.slice(0, nul).split('\x1f')
          for (const raw of rec.slice(nul + 1).split('\0')) {
            const file = raw.replace(/^\n/, '')
            if (!file || !file.startsWith(prefix)) continue
            const top = file.slice(prefix.length).split('/')[0]
            if (pending.delete(top)) found[top] = { sha: csha, subject, date }
          }
        }
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', (d) => {
          if (done) return
          buf += d
          const recs = buf.split('\x1e')
          buf = recs.pop()
          for (const r of recs) take(r)
          if (pending.size === 0) finish()
        })
        child.on('error', (e) => {
          if (done) return
          stop()
          reject(e.code === 'ENOENT' ? new Error('git was not found. Install Git for Windows and make sure it is on PATH.') : e)
        })
        child.on('close', () => {
          if (done) return
          take(buf)
          finish()
        })
      }),
  )
}

/** Uses for-each-ref's %(ahead-behind:) (git 2.41+): one process for every branch. Turned off for good if git is older. */
let aheadBehindAtom = true
const pairMemo = memo(2000)

/** Commits ahead/behind between two commit shas; memoized, since shas never change. */
function pairDivergence(repo, baseSha, sha) {
  return pairMemo.get(`${repo}\0${baseSha}\0${sha}`, async () => {
    const [behind, ahead] = (await text(repo, ['rev-list', '--left-right', '--count', `${baseSha}...${sha}`])).trim().split(/\s+/).map(Number)
    return { ahead, behind }
  })
}

/**
 * for-each-ref over refs/heads with ahead/behind against `base` added to each
 * row. `fields` are for-each-ref atoms; rows come back as { cols, ahead, behind }.
 */
async function headsWithDivergence(repo, base, fields, extra = []) {
  const SEP = '\x1f'
  const parse = (out) => out.split('\n').filter(Boolean).map((line) => line.split(SEP))
  if (base) assertRef(base)
  if (base && aheadBehindAtom && !/[)%:]/.test(base)) {
    try {
      const rows = parse(await text(repo, ['for-each-ref', `--format=${[...fields, `%(ahead-behind:${base})`].join(SEP)}`, ...extra, 'refs/heads']))
      return rows.map((r) => {
        const [ahead, behind] = (r[fields.length] ?? '').split(' ').map(Number)
        return { cols: r.slice(0, fields.length), ahead, behind }
      })
    } catch (e) {
      if (!/unknown field name/i.test(e.message)) throw e
      aheadBehindAtom = false
    }
  }
  const rows = parse(await text(repo, ['for-each-ref', `--format=${[...fields, '%(objectname)'].join(SEP)}`, ...extra, 'refs/heads']))
  const list = rows.map((r) => ({ cols: r.slice(0, fields.length), sha: r[fields.length] }))
  if (!base) return list
  const baseSha = await resolveCommit(repo, base).catch(() => null)
  if (!baseSha) return list
  await Promise.all(
    list.slice(0, 200).map(async (b) => {
      try {
        Object.assign(b, await pairDivergence(repo, baseSha, b.sha))
      } catch {
        /* ignore */
      }
    }),
  )
  return list.map(({ sha: _sha, ...b }) => b)
}

/** { [branch]: { ahead, behind } } against `base` (the repo's default branch). For the Branches page. */
async function branchDivergence(repo, base) {
  const rows = await headsWithDivergence(repo, base, ['%(refname:short)'])
  const out = {}
  for (const r of rows) if (Number.isFinite(r.ahead)) out[r.cols[0]] = { ahead: r.ahead, behind: r.behind }
  return out
}

const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
}

async function readBlob(repo, ref, filePath) {
  assertRef(ref)
  const p = assertPath(filePath)
  const spec = `${ref}:${p}`
  const size = Number((await text(repo, ['cat-file', '-s', spec])).trim())
  const ext = p.split('.').pop()?.toLowerCase() ?? ''
  const mime = IMAGE_MIME[ext]
  if (mime) {
    if (size > MAX_IMAGE_BYTES) return { kind: 'toolarge', size }
    const buf = await run(repo, ['cat-file', 'blob', spec])
    return { kind: 'image', dataUrl: `data:${mime};base64,${buf.toString('base64')}`, size }
  }
  if (size > MAX_TEXT_BYTES * 5) return { kind: 'toolarge', size }
  const buf = await run(repo, ['cat-file', 'blob', spec])
  if (buf.subarray(0, 8000).includes(0)) return { kind: 'binary', size }
  const truncated = buf.length > MAX_TEXT_BYTES
  return { kind: 'text', content: buf.subarray(0, MAX_TEXT_BYTES).toString('utf8'), size, truncated }
}

const LOG_FMT = '%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%s%x1f%b%x1e'

function parseLog(out) {
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.trim())
    .map((r) => {
      const [sha, parents, authorName, authorEmail, date, refs, subject, body] = r.split('\x1f')
      return {
        sha,
        shortSha: sha.slice(0, 7),
        parents: parents ? parents.split(' ') : [],
        authorName,
        authorEmail,
        date,
        subject,
        body: (body ?? '').trim(),
        refs: refs ? refs.split(', ').filter(Boolean) : [],
      }
    })
}

async function getLog(repo, o) {
  assertRef(o?.ref)
  const limit = Math.min(Math.max(Math.trunc(Number(o.limit ?? 30)) || 30, 1), 200)
  const skip = Math.max(Math.trunc(Number(o.skip ?? 0)) || 0, 0)
  const args = ['log', `--format=${LOG_FMT}`, `--skip=${skip}`, `-n`, String(limit + 1)]
  if (o.search && typeof o.search === 'string') args.push('-i', '--fixed-strings', `--grep=${o.search}`)
  args.push(o.ref, '--')
  if (o.path) args.push(assertPath(o.path))
  const commits = parseLog(await text(repo, args))
  return { commits: commits.slice(0, limit), hasMore: commits.length > limit }
}

const countMemo = memo(200)

/** Walks the whole history, so it is memoized by commit sha. */
async function countCommits(repo, ref) {
  const sha = await resolveCommit(repo, ref)
  return countMemo.get(`${repo}\0${sha}`, async () => Number((await text(repo, ['rev-list', '--count', sha, '--'])).trim()))
}

function limitDiff(files) {
  let truncated = files.length > MAX_DIFF_FILES
  const kept = files.slice(0, MAX_DIFF_FILES)
  for (const f of kept) {
    let n = 0
    f.hunks = f.hunks.filter((h) => {
      if (n >= MAX_DIFF_LINES_PER_FILE) {
        truncated = true
        return false
      }
      n += h.lines.length
      return true
    })
  }
  return { files: kept, truncated }
}

const DIFF_FLAGS = ['-M', '--no-color', '--no-ext-diff', '--no-textconv']

async function getCommit(repo, sha) {
  assertRef(sha)
  const [summary] = parseLog(await text(repo, ['show', '-s', `--format=${LOG_FMT}`, sha, '--']))
  if (!summary) throw new Error(`Commit not found: ${sha}`)
  const raw = summary.parents.length
    ? await text(repo, ['diff', ...DIFF_FLAGS, summary.parents[0], summary.sha, '--'])
    : await text(repo, ['show', '--format=', '-p', ...DIFF_FLAGS, summary.sha, '--'])
  const { files, truncated } = limitDiff(parseDiff(raw))
  return { ...summary, files, truncated }
}

async function compareRefs(repo, base, head) {
  assertRef(base)
  assertRef(head)
  const raw = await text(repo, ['diff', ...DIFF_FLAGS, `${base}...${head}`, '--'])
  const commits = parseLog(await text(repo, ['log', `--format=${LOG_FMT}`, '-n', '200', `${base}..${head}`, '--']))
  const { files, truncated } = limitDiff(parseDiff(raw))
  return { base, head, commits, files, truncated }
}

/**
 * A dashboard summary of one repo: newest commits on any branch, and the
 * most recently updated branches with ahead/behind against the default.
 */
async function recentActivity(repo, { commits = 10, branches = 6 } = {}) {
  const info = await openRepo(repo)
  if (info.isEmpty) return { ...info, commits: [], branches: [] }
  const [log, rows] = await Promise.all([
    text(info.path, ['log', '--exclude=refs/local-issues', '--all', '--date-order', `--format=${LOG_FMT}`, '-n', String(commits), '--']).then(parseLog),
    headsWithDivergence(
      info.path,
      info.defaultRef,
      ['%(refname:short)', '%(objectname)', '%(committerdate:iso-strict)', '%(authorname)', '%(contents:subject)'],
      ['--sort=-committerdate', `--count=${branches}`],
    ),
  ])
  const list = rows.map(({ cols: [name, sha, date, author, subject], ahead, behind }) => {
    const isDefault = name === info.defaultRef
    return { name, sha, date, author, subject, isDefault, ...(!isDefault && Number.isFinite(ahead) ? { ahead, behind } : {}) }
  })
  return { ...info, commits: log, branches: list }
}

/**
 * One line per ref (branches, tags, remotes, refs/local-issues) with its
 * commit, and a * on the checked-out branch: changes whenever anything a
 * dashboard summary shows could have changed.
 */
async function refsFingerprint(repo) {
  return text(repo, ['for-each-ref', '--format=%(HEAD)%(refname) %(objectname)'])
}

/** Write every branch and tag, with full history, to one bundle file; then check it. */
async function createBundle(repo, file) {
  await run(repo, ['bundle', 'create', file, '--all'])
  await run(repo, ['bundle', 'verify', '--quiet', file])
  return file
}

module.exports = {
  /** Tests only: take the git < 2.41 path for ahead/behind. */
  _useRevListDivergence: () => { aheadBehindAtom = false },
  createBundle,
  recentActivity,
  refsFingerprint,
  assertRef,
  assertPath,
  openRepo,
  listRefs,
  listTree,
  treeLastCommits,
  branchDivergence,
  resolveCommit,
  readBlob,
  getLog,
  countCommits,
  getCommit,
  compareRefs,
}
