// Incremental reader for files that only grow, such as JSONL logs (B4).
//
//   const inc = openIncremental(ctx, '<declared id>', { init, reduce })
//   const state = await inc.read(key, filePath)
//
// For each key the cache stores the byte offset it reached, the file's size,
// a hash of its first bytes and the reducer state. A later read parses only
// the complete lines added since. A file that shrank, or whose first bytes
// changed, was rewritten and is read again from the start. Lines are only
// consumed up to the last newline, so a line still being written is read
// whole next time.
//
// The state is saved to disk (atomically, in one file per cache) so it
// survives a restart, with the declared version: a file of another version is
// discarded and rebuilt, never misread. Keys are the caller's choice (use an
// id, not a path, if paths are private). What `reduce` keeps is what is
// stored: the declaration's `content` policy applies to it.

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const { declaration } = require('./declared.cjs')
const { readJson, writeJsonAtomic } = require('./files.cjs')

const HEAD_BYTES = 256
const CHUNK = 4 * 1024 * 1024

class IncrementalCache {
  /**
   * @param {string} dir
   * @param {string} id
   * @param {{ init: () => any, reduce: (state: any, lines: string[]) => any, saveDelayMs?: number }} opts
   */
  constructor(dir, id, opts) {
    const d = declaration(id)
    if (d.tier !== 'incremental' || d.storage !== 'disk') throw new Error(`${id} is not an incremental cache`)
    this.decl = d
    this.file = path.join(dir, d.file)
    this.init = opts.init
    this.reduce = opts.reduce
    this.saveDelayMs = opts.saveDelayMs ?? 2000
    this.entries = undefined // loaded lazily
    this.saveTimer = undefined
    this.queue = new Map() // key -> promise (one read per key at a time)
  }

  async #load() {
    if (this.entries) return this.entries
    const disk = await readJson(this.file)
    this.entries = new Map(disk?.version === this.decl.version && disk.entries ? Object.entries(disk.entries) : [])
    return this.entries
  }

  /** Reduce `filePath`'s new lines into the state stored under `key`; returns the state. */
  read(key, filePath) {
    const prev = this.queue.get(key) ?? Promise.resolve()
    const job = prev.catch(() => {}).then(() => this.#read(key, filePath))
    this.queue.set(key, job)
    job.finally(() => this.queue.get(key) === job && this.queue.delete(key)).catch(() => {})
    return job
  }

  async #read(key, filePath) {
    const entries = await this.#load()
    const h = await fs.open(filePath, 'r')
    try {
      const st = await h.stat()
      let e = entries.get(key)
      // Shrunk, or its first bytes changed: the file was rewritten.
      let rewritten = !e || st.size < e.offset
      if (!rewritten && e.headLen > 0) rewritten = (await headHash(h, e.headLen)) !== e.head
      if (rewritten) e = { offset: 0, state: this.init(), head: '', headLen: 0 }
      if (st.size === e.offset && st.mtimeMs === e.mtimeMs) return e.state

      let offset = e.offset
      let state = e.state
      while (offset < st.size) {
        const len = Math.min(CHUNK, st.size - offset)
        const buf = Buffer.alloc(len)
        const { bytesRead } = await h.read(buf, 0, len, offset)
        const nl = buf.lastIndexOf(0x0a, bytesRead - 1)
        if (nl < 0) {
          if (bytesRead === CHUNK) throw new Error('A line is longer than 4 MB')
          break // an unfinished line: read it whole next time
        }
        const lines = buf.subarray(0, nl).toString('utf8').split('\n').map((l) => l.replace(/\r$/, ''))
        state = this.reduce(state, lines.filter((l) => l.length > 0))
        offset += nl + 1
      }
      const headLen = Math.min(offset, HEAD_BYTES)
      const head = headLen === e.headLen ? e.head : await headHash(h, headLen)
      entries.set(key, { offset, size: st.size, mtimeMs: st.mtimeMs, head, headLen, state })
      this.#scheduleSave()
      return state
    } finally {
      await h.close()
    }
  }

  /** Forget one key (or all), e.g. when its file was deleted. */
  forget(key) {
    if (!this.entries) return
    if (key === undefined) this.entries.clear()
    else this.entries.delete(key)
    this.#scheduleSave()
  }

  #scheduleSave() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined
      void this.flush()
    }, this.saveDelayMs)
    this.saveTimer.unref?.()
  }

  /** Write the state to disk now. */
  async flush() {
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    if (!this.entries) return
    await writeJsonAtomic(this.file, { version: this.decl.version, entries: Object.fromEntries(this.entries) })
  }
}

async function headHash(h, len) {
  if (len <= 0) return ''
  const buf = Buffer.alloc(len)
  await h.read(buf, 0, len, 0)
  return crypto.createHash('sha1').update(buf).digest('hex')
}

module.exports = { IncrementalCache }
