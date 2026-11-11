// GitHub+: turn a plain folder into a local git repository.
//
// `git init` adds one hidden .git folder; the user's files are not moved or
// changed. We then write a .gitignore (only if the folder has none) and make
// a first commit so there is history to browse. No remote is ever added.
// Undo = delete the .git folder.
//
// previewFolder() runs first so the UI can show what would be snapshotted
// and flag large or sensitive-looking files before anything is written.

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')

const LARGE_BYTES = 50 * 1024 * 1024
const MAX_SCAN = 50_000
const MAX_LISTED = 50

/** Folders never worth snapshotting; skipped by the scan and ignored by default. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', '$RECYCLE.BIN', 'System Volume Information'])

const SENSITIVE = [
  /^\.env(\..*)?$/i,
  /\.(pem|key|p12|pfx|kdbx|ppk|asc|gpg)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)$/i,
  /^credentials.*\.json$/i,
  /secret/i,
  /password/i,
]

const DEFAULT_GITIGNORE = `# Created by GitHub+ in MonoRail. Edit freely.
# OS and editor clutter
Thumbs.db
desktop.ini
.DS_Store
~$*
*.tmp

# Dependencies and environments
node_modules/
__pycache__/
.venv/
venv/

# Secrets: keep these out of history
.env
.env.*
*.pem
*.key
*.p12
*.pfx
`

/** A literal path as a root-anchored .gitignore pattern (wildcards and specials escaped). */
const ignoreLine = (p) => '/' + p.replace(/[\\*?[\]!#]/g, (c) => '\\' + c).replace(/ $/, '\\ ')

function git(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile('git', ['-c', 'core.fsmonitor=false', ...args], { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if (err.code === 'ENOENT') return reject(new Error('git was not found. Install Git for Windows and make sure it is on PATH.'))
        return reject(new Error(String(stderr || err.message).trim().split('\n')[0]))
      }
      resolve(String(stdout))
    })
  })
}

/** Refuse folders that are too broad to snapshot: drive roots and the home folder itself. */
async function checkFolder(dir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new Error('Invalid folder')
  const full = path.resolve(dir)
  const st = await fs.stat(full).catch(() => null)
  if (!st?.isDirectory()) throw new Error(`"${dir}" is not a folder`)
  if (path.parse(full).root === full) throw new Error('A whole drive is too big to turn into a repository. Pick a folder inside it.')
  if (full.toLowerCase() === path.resolve(os.homedir()).toLowerCase())
    throw new Error('Your whole user folder is too big to turn into a repository. Pick a folder inside it.')
  return full
}

/** What a first commit would contain, with large and sensitive-looking files called out. */
async function previewFolder(dir) {
  const root = await checkFolder(dir)
  let fileCount = 0
  let totalBytes = 0
  let truncated = false
  const large = []
  const sensitive = []
  const skippedDirs = new Set()
  const hasGitignore = await fs.stat(path.join(root, '.gitignore')).then(() => true, () => false)

  const stack = ['']
  while (stack.length) {
    const rel = stack.pop()
    let entries
    try {
      entries = await fs.readdir(path.join(root, rel), { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) skippedDirs.add(e.name)
        else stack.push(relPath)
        continue
      }
      if (!e.isFile()) continue
      if (++fileCount > MAX_SCAN) {
        truncated = true
        stack.length = 0
        break
      }
      let size = 0
      try {
        size = (await fs.stat(path.join(root, relPath))).size
      } catch {
        /* unreadable */
      }
      totalBytes += size
      if (size >= LARGE_BYTES && large.length < MAX_LISTED) large.push({ path: relPath, size })
      if (SENSITIVE.some((re) => re.test(e.name)) && sensitive.length < MAX_LISTED) sensitive.push(relPath)
    }
  }
  return {
    path: root.replace(/\\/g, '/'),
    name: path.basename(root),
    fileCount: Math.min(fileCount, MAX_SCAN),
    totalBytes,
    truncated,
    large,
    sensitive,
    skippedDirs: [...skippedDirs],
    hasGitignore,
    largeThresholdBytes: LARGE_BYTES,
  }
}

/**
 * git init + .gitignore + first commit. Options:
 *   excludeLarge     add files over 50 MB to .gitignore (default true)
 *   excludeSensitive add sensitive-looking files to .gitignore (default true)
 */
async function initRepo(dir, { excludeLarge = true, excludeSensitive = true } = {}) {
  const root = await checkFolder(dir)
  const inside = await git(root, ['rev-parse', '--is-inside-work-tree']).then(() => true, () => false)
  if (inside) throw new Error('This folder is already inside a git repository')

  const preview = await previewFolder(root)
  await git(root, ['init', '-q'])
  await git(root, ['symbolic-ref', 'HEAD', 'refs/heads/main'])

  const gitignorePath = path.join(root, '.gitignore')
  const extra = [
    ...(excludeLarge ? preview.large.map((f) => f.path) : []),
    ...(excludeSensitive ? preview.sensitive : []),
  ]
  if (!preview.hasGitignore) {
    let body = DEFAULT_GITIGNORE
    if (extra.length) body += `\n# Left out when this repository was created\n${extra.map(ignoreLine).join('\n')}\n`
    await fs.writeFile(gitignorePath, body)
  } else if (extra.length) {
    await fs.appendFile(gitignorePath, `\n# Left out by GitHub+ when this repository was created\n${extra.map(ignoreLine).join('\n')}\n`)
  }

  await git(root, ['add', '-A'])
  // Commit as the user's git identity if they have one; otherwise a local-only one.
  const name = (await git(root, ['config', 'user.name']).catch(() => '')).trim()
  const email = (await git(root, ['config', 'user.email']).catch(() => '')).trim()
  const identity = [
    ...(name ? [] : ['-c', `user.name=${os.userInfo().username || 'GitHub+'}`]),
    ...(email ? [] : ['-c', 'user.email=local@githubplus.invalid']),
  ]
  await git(root, [...identity, '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'Initial snapshot (created by GitHub+)'])
  return { path: root, excluded: extra }
}

module.exports = { previewFolder, initRepo, ignoreLine, DEFAULT_GITIGNORE, LARGE_BYTES }
