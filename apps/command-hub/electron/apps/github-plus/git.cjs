// GitHub+ app: read-only wrapper around the local `git` CLI.
// Ported from wojoe-444/Local-Repo-UI (src/main/git.ts).
//
// Everything stays on the machine: only the local git binary runs, against
// committed content at a ref, so the working tree is never touched. Refs and
// paths come from the renderer and are validated so they can't be parsed as
// git options or escape the repo. Repo config that would run programs
// (textconv, external diff, fsmonitor) is disabled per call.

const { execFile } = require('node:child_process')
const { basename } = require('node:path')

const { parseDiff } = require('./diff.cjs')

const MAX_BUFFER = 64 * 1024 * 1024
const MAX_TEXT_BYTES = 1024 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_DIFF_FILES = 300
const MAX_DIFF_LINES_PER_FILE = 5000

function run(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', '-c', 'color.ui=false', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', ...args],
      { cwd, encoding: 'buffer', maxBuffer: MAX_BUFFER, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } },
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
  const headSha = await text(root, ['rev-parse', '--verify', '-q', 'HEAD']).then((s) => s.trim(), () => null)
  const currentBranch = await text(root, ['symbolic-ref', '--short', '-q', 'HEAD']).then((s) => s.trim() || null, () => null)
  const branches = (await text(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])).split('\n').filter(Boolean)
  let defaultRef = currentBranch
  if (!defaultRef) defaultRef = ['main', 'master'].find((b) => branches.includes(b)) ?? branches[0] ?? (headSha ? 'HEAD' : null)
  return { path: root, name: basename(root), currentBranch, headSha, isEmpty: !headSha && branches.length === 0, defaultRef }
}

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
  const info = await openRepo(repo)
  const base = info.defaultRef
  if (base) {
    await Promise.all(
      refs
        .filter((r) => r.type === 'branch')
        .slice(0, 200)
        .map(async (r) => {
          try {
            const [behind, ahead] = (await text(repo, ['rev-list', '--left-right', '--count', `${assertRef(base)}...refs/heads/${r.name}`]))
              .trim()
              .split(/\s+/)
              .map(Number)
            r.ahead = ahead
            r.behind = behind
          } catch {
            /* ignore */
          }
        }),
    )
  }
  return refs
}

async function listTree(repo, ref, dirPath, withLastCommit = true) {
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
    const queue = entries.slice(0, 150)
    const worker = async () => {
      for (let e = queue.shift(); e; e = queue.shift()) {
        try {
          const o = await text(repo, ['log', '-1', '--format=%H%x1f%s%x1f%aI', ref, '--', e.path])
          const [sha, subject, date] = o.trim().split('\x1f')
          if (sha) e.lastCommit = { sha, subject, date }
        } catch {
          /* ignore */
        }
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker))
  }
  return entries
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

async function countCommits(repo, ref) {
  assertRef(ref)
  return Number((await text(repo, ['rev-list', '--count', ref, '--'])).trim())
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
  const log = parseLog(await text(info.path, ['log', '--exclude=refs/local-issues', '--all', '--date-order', `--format=${LOG_FMT}`, '-n', String(commits), '--']))
  const SEP = '\x1f'
  const out = await text(info.path, [
    'for-each-ref',
    `--format=%(refname:short)${SEP}%(objectname)${SEP}%(committerdate:iso-strict)${SEP}%(authorname)${SEP}%(contents:subject)`,
    '--sort=-committerdate',
    `--count=${branches}`,
    'refs/heads',
  ])
  const list = out.split('\n').filter(Boolean).map((line) => {
    const [name, sha, date, author, subject] = line.split(SEP)
    return { name, sha, date, author, subject, isDefault: name === info.defaultRef }
  })
  if (info.defaultRef) {
    await Promise.all(
      list.filter((b) => !b.isDefault).map(async (b) => {
        try {
          const [behind, ahead] = (await text(info.path, ['rev-list', '--left-right', '--count', `${assertRef(info.defaultRef)}...refs/heads/${b.name}`]))
            .trim().split(/\s+/).map(Number)
          b.ahead = ahead
          b.behind = behind
        } catch {
          /* ignore */
        }
      }),
    )
  }
  return { ...info, commits: log, branches: list }
}

/** Write every branch and tag, with full history, to one bundle file; then check it. */
async function createBundle(repo, file) {
  await run(repo, ['bundle', 'create', file, '--all'])
  await run(repo, ['bundle', 'verify', '--quiet', file])
  return file
}

module.exports = {
  createBundle,
  recentActivity,
  assertRef,
  assertPath,
  openRepo,
  listRefs,
  listTree,
  readBlob,
  getLog,
  countCommits,
  getCommit,
  compareRefs,
}
