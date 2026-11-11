// Notes: an unstructured info dump kept as Markdown files in a local git repo.
//
//   <Notes data folder>\repo\          (%APPDATA%\MonoRail\modules\notes\repo)
//     README.md
//     notes/<id>.md                    one note per file; the first line is its title
//
// Typing saves the file; commits are batched: one commit per quiet minute (or
// when the user leaves a note, or at the next start for anything left over),
// so the history reads as editing sessions, not keystrokes. Files edited or
// added outside MonoRail are committed the same way.
//
// The repo never gets a remote: it is never pushed anywhere, and it lives in
// the user's AppData, outside the MonoRail checkout. GitHub+ lists it as
// "Notes" (electron/apps/github-plus/linked.cjs).
//
// isomorphic-git does the git work (no git install needed, works from the
// packaged app.asar), like Jira+'s private projects repo. No Electron here, so
// tests run under plain Node.

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const git = require('isomorphic-git')

const { sleep, tryLock } = require('../cache/files.cjs')

const AUTHOR = { name: 'MonoRail', email: 'local@monorail.invalid' }
const NOTES = 'notes'
const COMMIT_AFTER_MS = 60_000
const MAX_NOTE_BYTES = 2 * 1024 * 1024
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/

const README = `# MonoRail notes

Your notes from MonoRail's Notes page, one Markdown file per note in \`notes/\`.
MonoRail commits changes after a minute of quiet, so \`git log\` is each note's history.

This repository lives in your local AppData and has no remote. Do not push it anywhere.
`

const repoDirOf = (dataDir) => path.join(dataDir, 'repo')

/** The first non-empty line, without Markdown heading marks. */
function titleOf(body) {
  const line = String(body).split('\n').find((l) => l.trim()) ?? ''
  return line.replace(/^\s*#+\s*/, '').trim().slice(0, 120) || 'Untitled'
}

/** The text after the title, flattened for the list. */
function excerptOf(body) {
  const lines = String(body).split('\n').filter((l) => l.trim())
  return lines
    .slice(1)
    .map((l) => l.replace(/^\s*([#>]+|[-*+]|\d+\.)\s+/, '').replace(/`/g, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

const wordsOf = (body) => String(body).split(/\s+/).filter(Boolean).length

/** A file-name slug for a title: lowercase letters and digits joined by dashes. */
function slugOf(title) {
  const s = String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
  return s && s !== 'untitled' ? s : 'note'
}

const dateOf = (ms) => {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function checkId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('Unknown note')
  return id
}

function checkBody(body) {
  if (typeof body !== 'string') throw new Error('Invalid note text')
  if (Buffer.byteLength(body) > MAX_NOTE_BYTES) throw new Error('This note is too long (2 MB at most).')
  return body
}

function createNotesStore(dataDir, { commitAfterMs = COMMIT_AFTER_MS, log = () => {} } = {}) {
  const repoDir = repoDirOf(dataDir)
  const notesDir = path.join(repoDir, NOTES)
  const rel = (id) => `${NOTES}/${id}.md`
  const abs = (id) => path.join(notesDir, `${id}.md`)

  let ready
  let queue = Promise.resolve()
  let timer
  /** Notes saved since the last commit. */
  const pending = new Set()

  async function ensureRepo() {
    if (!ready) {
      ready = (async () => {
        await fsp.mkdir(notesDir, { recursive: true })
        // HEAD, not just .git: a lock file alone must not pass for a repo.
        if (!fs.existsSync(path.join(repoDir, '.git', 'HEAD'))) {
          await git.init({ fs, dir: repoDir, defaultBranch: 'main' })
          await fsp.writeFile(path.join(repoDir, 'README.md'), README)
          await git.add({ fs, dir: repoDir, filepath: 'README.md' })
          await git.commit({ fs, dir: repoDir, message: 'Create notes repository', author: AUTHOR })
        }
      })().catch((e) => {
        ready = undefined
        throw e
      })
    }
    return ready
  }

  // A future MCP tool or a second window could write too, so a lock file in
  // .git keeps writers in different processes apart.
  const lockFile = path.join(repoDir, '.git', 'monorail-write.lock')
  async function locked(fn) {
    await ensureRepo()
    let release
    for (let waited = 0; !(release = await tryLock(lockFile, { staleMs: 60_000 })); waited += 50) {
      if (waited > 15_000) throw new Error('The notes repository is busy. Try again in a moment.')
      await sleep(50)
    }
    try {
      return await fn()
    } finally {
      await release()
    }
  }

  /** One write at a time, so a commit never sees half a save. */
  function serial(fn) {
    const run = () => locked(fn)
    const next = queue.then(run, run)
    queue = next.catch(() => {})
    return next
  }

  async function tracked(id) {
    try {
      await git.readBlob({ fs, dir: repoDir, oid: await git.resolveRef({ fs, dir: repoDir, ref: 'HEAD' }), filepath: rel(id) })
      return true
    } catch {
      return false
    }
  }

  async function read(id) {
    const file = abs(checkId(id))
    let body, st
    try {
      ;[body, st] = await Promise.all([fsp.readFile(file, 'utf8'), fsp.stat(file)])
    } catch {
      throw new Error('That note no longer exists.')
    }
    return { id, body, updated: st.mtimeMs, created: st.birthtimeMs || st.mtimeMs }
  }

  function view(n) {
    return { id: n.id, title: titleOf(n.body), excerpt: excerptOf(n.body), updated: n.updated, words: wordsOf(n.body), body: n.body, created: n.created, committed: !pending.has(n.id) }
  }

  const summaryOf = ({ body: _b, created: _c, committed: _k, ...s }) => s

  function scheduleCommit() {
    clearTimeout(timer)
    timer = setTimeout(() => void commitPending().catch((e) => log('commit failed', e?.message)), commitAfterMs)
    timer.unref?.()
  }

  /** A free id for a new name: <date>-<slug>, then -2, -3, ... */
  function freeId(base, except) {
    for (let n = 1; n < 1000; n++) {
      const id = n === 1 ? base : `${base}-${n}`
      if (id === except || !fs.existsSync(abs(id))) return id
    }
    throw new Error('Too many notes with that name')
  }

  /**
   * Commit every change under notes/ (MonoRail's own saves and anything edited
   * outside it). One commit; the message names the notes.
   */
  async function commitAll() {
    const rows = await git.statusMatrix({ fs, dir: repoDir, filepaths: [NOTES] })
    const changed = []
    const waiting = new Set()
    for (const row of rows) {
      const [file, head, work, stage] = row
      if (head === 1 && work === 1 && stage === 1) continue
      // A new note that is still blank waits: it is not worth a commit, and
      // until its first commit its file can still be renamed after its title.
      if (head === 0 && work !== 0 && !(await fsp.readFile(path.join(repoDir, file), 'utf8').catch(() => '')).trim()) {
        waiting.add(path.basename(file, '.md'))
        continue
      }
      changed.push(row)
    }
    // Afterwards only the blank new notes are still uncommitted.
    const settle = () => {
      for (const id of pending) if (!waiting.has(id)) pending.delete(id)
    }
    if (changed.length === 0) {
      settle()
      return false
    }
    const titles = []
    for (const [file, head, work] of changed) {
      if (work === 0) {
        await git.remove({ fs, dir: repoDir, filepath: file })
        titles.push(`delete ${path.basename(file, '.md')}`)
      } else {
        await git.add({ fs, dir: repoDir, filepath: file })
        const t = titleOf(await fsp.readFile(path.join(repoDir, file), 'utf8').catch(() => ''))
        titles.push(head === 0 ? `new "${t}"` : `"${t}"`)
      }
    }
    const message = changed.length === 1 ? `Notes: ${titles[0]}` : `Notes: ${changed.length} notes (${titles.slice(0, 3).join(', ')}${titles.length > 3 ? ', ...' : ''})`
    await git.commit({ fs, dir: repoDir, message, author: AUTHOR })
    settle()
    return true
  }

  function commitPending() {
    clearTimeout(timer)
    timer = undefined
    return serial(commitAll)
  }

  return {
    repoDir,

    /** { notes, repoPath, pending }, newest first; `query` matches anywhere in the text. */
    async list(query) {
      await ensureRepo()
      const q = typeof query === 'string' ? query.trim().toLowerCase() : ''
      const files = (await fsp.readdir(notesDir).catch(() => [])).filter((f) => f.endsWith('.md') && ID_RE.test(f.slice(0, -3)))
      const notes = (await Promise.all(files.map((f) => read(f.slice(0, -3)).catch(() => null))))
        .filter((n) => n && (!q || n.body.toLowerCase().includes(q)))
        .map((n) => summaryOf(view(n)))
        .sort((a, b) => b.updated - a.updated)
      return { notes, repoPath: repoDir, pending: pending.size }
    },

    async get(id) {
      await ensureRepo()
      return view(await read(id))
    },

    /** A new note. Named <date>-note until it has a title (see save). */
    async create(body = '') {
      checkBody(body)
      return serial(async () => {
        const now = Date.now()
        const id = freeId(`${dateOf(now)}-${slugOf(titleOf(body))}`)
        await fsp.writeFile(abs(id), body)
        pending.add(id)
        scheduleCommit()
        return view(await read(id))
      })
    },

    /**
     * Write the note's text. While a note has never been committed its file is
     * renamed to follow its title, so the repo reads well; after that the name
     * stays (renames would cut its history). Returns the note, maybe with a new id.
     */
    async save(id, body) {
      checkId(id)
      checkBody(body)
      return serial(async () => {
        let current = await read(id)
        let nid = id
        if (/^\d{4}-\d{2}-\d{2}-/.test(id) && !(await tracked(id))) {
          const want = freeId(`${id.slice(0, 10)}-${slugOf(titleOf(body))}`, id)
          if (want !== id) {
            await fsp.rename(abs(id), abs(want))
            pending.delete(id)
            nid = want
          }
        }
        if (current.body !== body || nid !== id) await fsp.writeFile(abs(nid), body)
        pending.add(nid)
        scheduleCommit()
        current = await read(nid)
        return view(current)
      })
    },

    /** Commit now (leaving a note, leaving the page, app start). */
    async flush() {
      await ensureRepo()
      return { committed: await commitPending() }
    },

    /** Delete the file and commit at once. Earlier versions stay in the history. */
    async remove(id) {
      checkId(id)
      return serial(async () => {
        await fsp.rm(abs(id), { force: true })
        pending.delete(id)
        await commitAll()
        return { removed: true }
      })
    },

    /** Commits that touched the note, newest first. */
    async history(id) {
      checkId(id)
      await ensureRepo()
      try {
        const commits = await git.log({ fs, dir: repoDir, filepath: rel(id), force: true })
        return commits.map((c) => ({ oid: c.oid, message: c.commit.message.trim(), time: c.commit.author.timestamp * 1000 }))
      } catch {
        return []
      }
    },

    /** The note's text at one commit. */
    async version(id, oid) {
      checkId(id)
      if (typeof oid !== 'string' || !/^[0-9a-f]{40}$/.test(oid)) throw new Error('Unknown version')
      await ensureRepo()
      const { blob } = await git.readBlob({ fs, dir: repoDir, oid, filepath: rel(id) })
      return { body: Buffer.from(blob).toString('utf8') }
    },

    /** Stop the commit timer (tests, shutdown). */
    close() {
      clearTimeout(timer)
      timer = undefined
    },
  }
}

module.exports = { createNotesStore, repoDirOf, titleOf, excerptOf, slugOf, COMMIT_AFTER_MS }
