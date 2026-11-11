// Changes panel (W1): `git status` and `git diff HEAD` for a chat's folder.
//
// Read-only. The folder comes from the main process (a listed chat's log or
// an allowed repo), never from the page. Repo config that could run programs
// (external diff, textconv, fsmonitor) is switched off, and output is capped.

const { execFile } = require('node:child_process')

const MAX_DIFF = 1024 * 1024
const MAX_FILES = 500

function git(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false', '-c', 'diff.external=', ...args],
      { cwd, maxBuffer: MAX_DIFF * 4, timeout: 20_000, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_EXTERNAL_DIFF: '' } },
      (err, stdout) => (err && !stdout ? reject(err) : resolve(stdout)),
    )
  })
}

/** Parse `git status --porcelain=v1 -b -z`. */
function parseStatus(out) {
  const parts = out.split('\0').filter(Boolean)
  let branch
  const files = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (p.startsWith('## ')) {
      branch = p.slice(3)
      continue
    }
    const code = p.slice(0, 2)
    const file = p.slice(3)
    const entry = { code, path: file }
    // Renames and copies carry the old path as the next field.
    if (code[0] === 'R' || code[0] === 'C') entry.from = parts[++i]
    files.push(entry)
  }
  return { branch, files }
}

async function changes(cwd) {
  const status = parseStatus(await git(cwd, ['status', '--porcelain=v1', '-b', '-z', '--untracked-files=all']))
  let diff = ''
  let noHead = false
  try {
    diff = await git(cwd, ['diff', 'HEAD', '--no-color', '--no-ext-diff', '--no-textconv', '--stat=200', '--patch'])
  } catch {
    noHead = true // a repo with no commits yet
  }
  const cut = diff.length > MAX_DIFF
  return {
    branch: status.branch,
    files: status.files.slice(0, MAX_FILES),
    moreFiles: Math.max(0, status.files.length - MAX_FILES),
    diff: cut ? diff.slice(0, MAX_DIFF) : diff,
    diffCut: cut,
    noHead,
  }
}

module.exports = { changes, parseStatus }
