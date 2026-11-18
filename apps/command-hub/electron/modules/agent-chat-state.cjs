// Per-chat flags for the Chat list: last seen, unread, archived, started here.
//
// Kept in a record file in the module's data folder (chat-state.json), never
// in a transcript. Keys are chat ids ("claude:<id>", "pi:<id>"); values are
// numbers and flags only, nothing from a conversation.

const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const FILE = 'chat-state.json'
const retryWait = new Int32Array(new SharedArrayBuffer(4))

function read(dataDir) {
  let state
  try {
    state = JSON.parse(fs.readFileSync(path.join(dataDir, FILE), 'utf8'))
  } catch {
    state = undefined
  }
  if (!state || typeof state !== 'object' || typeof state.since !== 'number') {
    // First run: chats that changed before now are not "unread".
    state = { since: Date.now(), chats: {} }
    write(dataDir, state)
  }
  if (!state.chats || typeof state.chats !== 'object') state.chats = {}
  return state
}

function write(dataDir, state) {
  const file = path.join(dataDir, FILE)
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(temp, JSON.stringify(state))
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(temp, file)
        return
      } catch (e) {
        // Windows can briefly refuse replacement while the destination is open.
        if (attempt >= 3 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e
        Atomics.wait(retryWait, 0, 0, 10 * (attempt + 1))
      }
    }
  } catch {
    try { fs.rmSync(temp, { force: true }) } catch { /* best effort cleanup */ }
    // best effort: the list still works without flags
  }
}

function update(dataDir, id, fn) {
  if (typeof id !== 'string' || !/^(claude|pi):[\w.-]+$/.test(id)) throw new Error('Unknown chat')
  const state = read(dataDir)
  const rec = { ...(state.chats[id] ?? {}) }
  fn(rec)
  for (const k of Object.keys(rec)) if (rec[k] === undefined || rec[k] === false) delete rec[k]
  if (Object.keys(rec).length) state.chats[id] = rec
  else delete state.chats[id]
  write(dataDir, state)
  return rec
}

/**
 * Flags for one chat. Unread: marked by hand, or its log changed after it was
 * last seen (or, never seen, after the record file was started).
 */
function flags(state, id, updatedAt) {
  const rec = state.chats[id] ?? {}
  const seen = typeof rec.seen === 'number' ? rec.seen : state.since
  return {
    unread: !!rec.unread || updatedAt > seen + 1000,
    archived: !!rec.archived,
    startedHere: !!rec.here,
  }
}

/** Seen now; clears a hand-set unread mark. */
function markSeen(dataDir, id) {
  return update(dataDir, id, (r) => {
    r.seen = Date.now()
    r.unread = undefined
  })
}

function setUnread(dataDir, id, unread) {
  return update(dataDir, id, (r) => {
    r.unread = !!unread || undefined
    if (!unread) r.seen = Date.now()
  })
}

function setArchived(dataDir, id, archived) {
  return update(dataDir, id, (r) => {
    r.archived = !!archived || undefined
  })
}

function markStartedHere(dataDir, id) {
  return update(dataDir, id, (r) => {
    r.here = true
  })
}

module.exports = { read, flags, markSeen, setUnread, setArchived, markStartedHere, FILE }
