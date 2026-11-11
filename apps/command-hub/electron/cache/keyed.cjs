// Keyed cache for checks and lists (tiers 'check' and 'list').
//
//   get(key, produce, { definition, force, failed })
//     Reuses a result for ttlMs after a success and failureTtlMs after a
//     failure (B1). `failed(value)` says whether a result counts as a failure
//     (default: the producer threw). `definition` is whatever produced the
//     result (a connector's config, a query): a hash of it is stored with the
//     result, and a different definition discards the old result at once (B2).
//     Only the hash is kept, never the definition itself. Two calls for the
//     same key while one is running share it (A4).
//   invalidate(key?)  clears one key, or all of them, when the user changes
//     something the result depends on (B3).
//
// Memory storage only: these are cheap enough to redo after a restart.

const crypto = require('node:crypto')

const { declaration } = require('./declared.cjs')

/** Stable hash of any JSON-able value (object keys sorted). */
function definitionHash(def) {
  const stable = (v) =>
    v && typeof v === 'object'
      ? Array.isArray(v)
        ? v.map(stable)
        : Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]))
      : v
  return crypto.createHash('sha256').update(JSON.stringify(stable(def ?? null))).digest('hex')
}

class KeyedCache {
  /** @param {string} id a declared cache id @param {{ now?: () => number }} [opts] */
  constructor(id, opts = {}) {
    const d = declaration(id)
    if (d.storage !== 'memory' || !['check', 'list'].includes(d.tier)) throw new Error(`${id} is not a keyed memory cache`)
    this.decl = d
    this.now = opts.now ?? Date.now
    this.entries = new Map() // key -> { value, error, ok, builtAt, defHash }
    this.inflight = new Map() // key -> promise
  }

  /** The stored entry for `key` if it may still be reused for `definition`. */
  peek(key, definition) {
    const e = this.entries.get(key)
    if (!e) return undefined
    if (definition !== undefined && e.defHash !== definitionHash(definition)) {
      this.entries.delete(key) // definition edited: the old result no longer applies
      return undefined
    }
    const limit = e.ok ? this.decl.ttlMs : (this.decl.failureTtlMs ?? this.decl.ttlMs)
    return this.now() - e.builtAt < limit ? e : undefined
  }

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} produce
   * @param {{ definition?: unknown, force?: boolean, failed?: (value: T) => boolean }} [opts]
   * @returns {Promise<T>} the result (a cached failure that threw is thrown again)
   */
  async get(key, produce, { definition, force = false, failed } = {}) {
    if (!force) {
      const hit = this.peek(key, definition)
      if (hit) {
        if (hit.error) throw hit.error
        return hit.value
      }
      const running = this.inflight.get(key)
      if (running) return running
    }
    const defHash = definitionHash(definition)
    const job = (async () => {
      try {
        const value = await produce()
        this.entries.set(key, { value, ok: !(failed?.(value) ?? false), builtAt: this.now(), defHash })
        return value
      } catch (error) {
        this.entries.set(key, { error, ok: false, builtAt: this.now(), defHash })
        throw error
      } finally {
        if (this.inflight.get(key) === job) this.inflight.delete(key)
      }
    })()
    this.inflight.set(key, job)
    return job
  }

  /** When `key`'s result was built and whether it is stale, for the page (C2). */
  status(key) {
    const e = this.entries.get(key)
    if (!e) return undefined
    const limit = e.ok ? this.decl.ttlMs : (this.decl.failureTtlMs ?? this.decl.ttlMs)
    const age = this.now() - e.builtAt
    return {
      id: this.decl.id,
      builtAt: new Date(e.builtAt).toISOString(),
      ageMs: age,
      ttlMs: limit,
      stale: age >= limit,
      ok: e.ok,
      nextRetryAt: e.ok ? undefined : new Date(e.builtAt + limit).toISOString(),
    }
  }

  /** Clear one key, or everything (B3: call it when the user changes what the result depends on). */
  invalidate(key) {
    if (key === undefined) this.entries.clear()
    else this.entries.delete(key)
  }
}

module.exports = { KeyedCache, definitionHash }
