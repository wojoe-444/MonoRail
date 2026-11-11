// One running turn per chat, across processes.
//
// Turns can start in three places: the app (Chat page), a coordinator turn's
// worker (the coordinator messaging a chat) and the MCP server (an agent
// asking the coordinator). Each keeps its own in-memory list, so a lock file
// per chat in the module's data folder makes sure two of them never run a
// turn in the same chat at once. This also stops loops: a chat cannot ask
// the coordinator while the coordinator is waiting on that chat's reply.
//
//   <dataDir>/turn-locks/<hash of the chat key>.lock   { pid, at }
//
// Numbers only: no prompt, no session text. A lock whose process is gone, or
// that is older than a turn may run, is stale and taken over.

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const LOCKS_DIR = 'turn-locks'
const MAX_AGE_MS = 35 * 60 * 1000 // a turn times out after 30 minutes

class ChatBusyError extends Error {
  constructor() {
    super('A reply is still running in this chat. Wait for it to finish, or press Stop.')
    this.code = 'CHAT_BUSY'
  }
}

function lockFile(dataDir, key) {
  return path.join(dataDir, LOCKS_DIR, `${crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)}.lock`)
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM' // exists, owned by someone else
  }
}

function stale(file, now) {
  try {
    const { pid, at } = JSON.parse(fs.readFileSync(file, 'utf8'))
    return !alive(pid) || typeof at !== 'number' || now - at > MAX_AGE_MS
  } catch {
    // Unreadable or half written: a writer that crashed mid-write.
    try {
      return now - fs.statSync(file).mtimeMs > 5000
    } catch {
      return true
    }
  }
}

/**
 * Take the lock for `key` (e.g. "claude:<session id>"). Returns a function
 * that releases it. Throws ChatBusyError when another live turn holds it.
 */
function acquire(dataDir, key, { now = Date.now(), pid = process.pid } = {}) {
  const file = lockFile(dataDir, key)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx')
      try {
        fs.writeSync(fd, JSON.stringify({ pid, at: now }))
      } finally {
        fs.closeSync(fd)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        try {
          // Only remove our own lock (a stale-lock takeover may have replaced it).
          if (JSON.parse(fs.readFileSync(file, 'utf8')).pid === pid) fs.rmSync(file, { force: true })
        } catch {
          // already gone
        }
      }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      if (!stale(file, now)) throw new ChatBusyError()
      fs.rmSync(file, { force: true })
    }
  }
  throw new ChatBusyError()
}

/** Whether a live turn holds the lock for `key`. */
function isLocked(dataDir, key, now = Date.now()) {
  const file = lockFile(dataDir, key)
  return fs.existsSync(file) && !stale(file, now)
}

module.exports = { acquire, isLocked, ChatBusyError, LOCKS_DIR, MAX_AGE_MS, _lockFile: lockFile }
