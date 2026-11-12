// File helpers for caches: atomic writes (A3) and a lock file (A4).

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Write a file atomically: write a temporary sibling, flush it, then rename it
 * over the old file. A reader sees the old file or the new one, never half of
 * one. Windows can refuse the rename for a moment while another process has the
 * target open, so it is retried briefly.
 */
async function writeAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  const handle = await fs.open(tmp, 'w')
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, file)
      return
    } catch (e) {
      if (attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) {
        await fs.rm(tmp, { force: true })
        throw e
      }
      await sleep(50 * (attempt + 1))
    }
  }
}

const writeJsonAtomic = (file, value) => writeAtomic(file, JSON.stringify(value))

/** Parse a JSON file; undefined if it is missing or damaged. */
async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** Temporary files left by writeAtomic (a crash between write and rename). */
const TMP_RE = /\.\d+\.[0-9a-f]{8}\.tmp$/

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  if (pid === process.pid) return true
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/**
 * Take the lock file `file` (created exclusively). Returns a release function,
 * or undefined if another live holder has it. A lock whose holder died, or that
 * is older than `staleMs`, is broken.
 */
async function tryLock(file, { staleMs }) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const h = await fs.open(file, 'wx')
      await h.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
      await h.close()
      let released = false
      return async () => {
        if (released) return
        released = true
        await fs.rm(file, { force: true })
      }
    } catch (e) {
      // Windows: a lock file another holder is deleting right now can't be
      // opened (EPERM/EACCES) until the delete finishes. That is "busy".
      if (process.platform === 'win32' && (e.code === 'EPERM' || e.code === 'EACCES')) return undefined
      if (e.code !== 'EEXIST') throw e
      const held = await lockHolder(file)
      const age = held ? Date.now() - Date.parse(held.startedAt) : Infinity
      // No pid yet means another holder has just created the file and is
      // still writing it: busy, unless it has stayed that way past staleMs.
      if (held && (held.pid === undefined || pidAlive(held.pid)) && age < staleMs) return undefined
      await fs.rm(file, { force: true }) // stale: its holder is gone
    }
  }
  return undefined
}

/** { pid, startedAt } of the lock file's holder, if it is held. */
async function lockHolder(file) {
  const held = await readJson(file)
  if (held && typeof held.startedAt === 'string') return held
  try {
    const st = await fs.stat(file) // being written right now
    return { pid: undefined, startedAt: st.mtime.toISOString() }
  } catch {
    return undefined
  }
}

module.exports = { writeAtomic, writeJsonAtomic, readJson, tryLock, lockHolder, pidAlive, sleep, TMP_RE }
