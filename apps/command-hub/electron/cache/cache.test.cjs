// Tests for the shared cache primitive (docs/caching.md). Run with `npm test`.
// Item numbers (A1, B4, ...) refer to the caching rules in that doc.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const cache = require('./index.cjs')
const declared = require('./declared.cjs')
const { writeAtomic, tryLock } = require('./files.cjs')
const { ReportCache } = require('./report.cjs')
const { KeyedCache } = require('./keyed.cjs')
const { IncrementalCache } = require('./incremental.cjs')
const { HistoryCache } = require('./history.cjs')

const MIN = 60_000
const HOUR = 60 * MIN

declared.declareForTest({ id: 'test.report', folder: 'test/report', tier: 'report', storage: 'disk', file: 'r.json', version: 2, ttlMs: 10 * MIN, failureTtlMs: HOUR, scheduleMs: 10 * MIN, waitMs: 2000, timeoutMs: 3000, content: 'derived', policy: 'test' })
declared.declareForTest({ id: 'test.reading', folder: 'test/report', tier: 'reading', storage: 'disk', file: 'reading.json', version: 1, ttlMs: Infinity, failureTtlMs: Infinity, content: 'derived', policy: 'test' })
declared.declareForTest({ id: 'test.summary', folder: 'test/report', tier: 'summary', storage: 'disk', file: 'summary.json', version: 1, ttlMs: 10 * MIN, content: 'derived', policy: 'test' })
declared.declareForTest({ id: 'test.check', folder: 'test/mem', tier: 'check', storage: 'memory', version: 1, ttlMs: 15 * MIN, failureTtlMs: 2 * MIN, content: 'derived', policy: 'test' })
declared.declareForTest({ id: 'test.inc', folder: 'test/inc', tier: 'incremental', storage: 'disk', file: 'inc.json', version: 1, ttlMs: Infinity, content: 'derived', policy: 'test' })
declared.declareForTest({ id: 'test.inc2', folder: 'test/inc', tier: 'incremental', storage: 'disk', file: 'inc.json', version: 2, ttlMs: Infinity, content: 'derived', policy: 'test' })
declared.declareForTest({ id: 'test.history', folder: 'test/hist', tier: 'history', storage: 'disk', file: 'disk.json', version: 1, ttlMs: 3 * 24 * HOUR, keep: 3, content: 'derived', policy: 'test' })

function tmpDir(folder = 'test/report') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-cache-'))
  const dir = path.join(root, ...folder.split('/'))
  fs.mkdirSync(dir, { recursive: true })
  return { root, dir, ctx: { dataDir: dir, rootDir: root, log: () => {} } }
}

function clock(start = Date.parse('2026-11-11T12:00:00Z')) {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// A1 / A2 / B1: declarations

test('A1: every declared cache is complete and in one place', () => {
  const ids = new Set()
  for (const c of declared.CACHES) {
    assert.ok(!ids.has(c.id), `duplicate cache ${c.id}`)
    ids.add(c.id)
    assert.match(c.id, /^[a-z-]+\.[a-z-]+$/)
    assert.ok(['report', 'check', 'list', 'incremental', 'reading', 'summary', 'history'].includes(c.tier), c.id)
    assert.ok(['disk', 'memory'].includes(c.storage), c.id)
    if (c.storage === 'disk') assert.ok(c.file && !c.file.includes('/') && !c.file.includes('\\'), `${c.id} needs a plain file name`)
    assert.ok(Number.isInteger(c.version) && c.version > 0, `${c.id} needs a version`)
    assert.ok(c.ttlMs > 0, `${c.id} needs a time limit`)
    assert.ok(c.policy && c.policy.length > 20, `${c.id} needs a written policy`)
  }
  // Two disk caches never share a file.
  const files = declared.CACHES.filter((c) => c.storage === 'disk').map((c) => `${c.folder}/${c.file}`)
  assert.equal(new Set(files).size, files.length)
})

test('A1: every FILE constant in a backend is declared for some data folder', () => {
  const root = path.join(__dirname, '..')
  const allNames = new Set(declared.declaredFolders().flatMap((f) => [...declared.declaredFiles(f)]))
  const missing = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.cjs') && !e.name.endsWith('.test.cjs')) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/const (\w*FILE) = '([^']+)'/g)) {
          if (!allNames.has(m[2])) missing.push(`${path.relative(root, p)}: ${m[1]} = '${m[2]}'`)
        }
      }
    }
  }
  walk(path.join(root, 'modules'))
  walk(path.join(root, 'apps'))
  walk(path.join(root, 'connections'))
  assert.deepEqual(missing, [], 'declare these in electron/cache/declared.cjs')
})

test('A1: the audit reports any undeclared file in a data folder, and deleting a cache loses nothing', async () => {
  const { root, dir, ctx } = tmpDir('modules/claude-stats')
  fs.writeFileSync(path.join(dir, 'usage.json'), '{}')
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x')
  assert.deepEqual(await cache.auditDataDir('modules/claude-stats', dir), ['notes.txt'])
  const report = await cache.auditAll(root, () => {})
  assert.deepEqual(report, { 'modules/claude-stats': ['notes.txt'] })

  // Claude Stats opens without its cache file: it reports "missing", it does not fail.
  fs.rmSync(path.join(dir, 'usage.json'))
  const stats = require('../modules/claude-stats.cjs')
  const view = await stats.methods.getUsage(ctx, {})
  assert.equal(view.missing, true)
  assert.equal(view.cache.builtAt, undefined)
})

test('A2: each source states its caching policy; message caches say what they do not cover', () => {
  for (const c of declared.CACHES) {
    assert.ok(['derived', 'messages'].includes(c.content), `${c.id} must state its content policy`)
    if (c.content === 'messages') assert.ok(c.coverage, `${c.id} caches messages, so it must say what it does not cover`)
  }
  // Mail is not cached on disk (kept on purpose).
  assert.ok(declared.NOT_CACHED['apps/email'])
  assert.equal(declared.CACHES.filter((c) => c.folder === 'apps/email').length, 0)
})

test('B1: each cache has its own time limit, declared once', () => {
  const d = (id) => declared.declaration(id)
  assert.equal(d('connections.connector-check').ttlMs, 15 * MIN)
  assert.equal(d('connections.sign-in').ttlMs, 15 * MIN)
  assert.equal(d('connections.sign-in').failureTtlMs, 2 * MIN)
  assert.equal(d('agent-chat.recent').ttlMs, 10_000)
  assert.equal(d('claude-stats.usage').ttlMs, 15 * MIN)
  assert.throws(() => d('nope.nothing'), /Undeclared cache/)
})

test('D4: scheduled builds retry at most hourly; every external read has a time limit', () => {
  for (const c of declared.CACHES.filter((x) => x.scheduleMs)) {
    assert.ok(c.failureTtlMs >= HOUR, `${c.id} must wait at least an hour after a failure`)
    assert.notEqual(c.failureTtlMs, c.ttlMs, `${c.id}: the failure interval is kept apart from the success interval`)
    assert.ok(c.timeoutMs > 0, `${c.id} needs a time limit`)
  }
})

// ---------------------------------------------------------------------------
// A3: atomic writes

test('A3: a reader never sees a half-written file, and no temp file is left', async () => {
  const { dir } = tmpDir()
  const file = path.join(dir, 'big.json')
  const big = (n) => JSON.stringify({ n, pad: 'x'.repeat(2_000_000) })
  await writeAtomic(file, big(0))
  let reading = true
  let bad = 0
  const reader = (async () => {
    while (reading) {
      try {
        JSON.parse(fs.readFileSync(file, 'utf8'))
      } catch (e) {
        if (e.code !== 'EPERM' && e.code !== 'EBUSY') bad++
      }
      await sleep(0)
    }
  })()
  for (let i = 1; i <= 10; i++) await writeAtomic(file, big(i))
  reading = false
  await reader
  assert.equal(bad, 0)
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).n, 10)
  assert.deepEqual(fs.readdirSync(dir), ['big.json'])
})

// ---------------------------------------------------------------------------
// A4: one refresh at a time

test('A4: two refreshes at once run one build; the second reuses its result', async () => {
  const { ctx } = tmpDir()
  let builds = 0
  const r = cache.report(ctx, 'test.report', {
    build: async () => {
      builds++
      await sleep(100)
      return { n: builds }
    },
  })
  const [a, b] = await Promise.all([r.refresh({ force: true }), r.refresh({ force: true })])
  assert.equal(builds, 1)
  assert.deepEqual(a.value, { n: 1 })
  assert.deepEqual(b.value, { n: 1 })
  assert.equal(fs.existsSync(r.lockFile), false)
})

test('A4: a second process waits on the lock file, never builds, and gives up with "still under way"', async () => {
  const { ctx } = tmpDir()
  let builds = 0
  let finish
  const slow = new ReportCache(ctx.dataDir, 'test.report', {
    build: () => {
      builds++
      return new Promise((r) => (finish = r))
    },
  })
  const other = new ReportCache(ctx.dataDir, 'test.report', { build: async () => (builds++, 'other') })
  const first = slow.refresh({ force: true, waitMs: 5000 })
  await sleep(50)
  assert.ok(fs.existsSync(slow.lockFile), 'the lock file is held during the build')
  const waited = await other.refresh({ force: true, waitMs: 300 })
  assert.equal(waited.status.building, true)
  assert.equal(waited.value, undefined)
  finish('slow')
  const done = await first
  assert.equal(done.value, 'slow')
  assert.equal(builds, 1)
  // The waiting cache now reads the result the first one wrote.
  assert.equal((await other.read()).value, 'slow')
})

test('A4: a lock left by a dead process is broken', async () => {
  const { dir } = tmpDir()
  const lock = path.join(dir, 'x.lock')
  fs.writeFileSync(lock, JSON.stringify({ pid: 999999999, startedAt: new Date().toISOString() }))
  const release = await tryLock(lock, { staleMs: HOUR })
  assert.ok(release)
  await release()
  assert.equal(fs.existsSync(lock), false)
})

test('A4: a lock still being written is busy, not stale; an old unreadable one is broken', async () => {
  const { dir } = tmpDir()
  const lock = path.join(dir, 'x.lock')
  // Another holder has just created the file and not yet written its pid.
  fs.writeFileSync(lock, '')
  assert.equal(await tryLock(lock, { staleMs: HOUR }), undefined)
  assert.equal(fs.existsSync(lock), true)
  const old = new Date(Date.now() - 2 * HOUR)
  fs.utimesSync(lock, old, old)
  const release = await tryLock(lock, { staleMs: HOUR })
  assert.ok(release)
  await release()
})

test('A4: a build that runs past its time limit fails and frees the lock', async () => {
  const { ctx } = tmpDir()
  const r = cache.report(ctx, 'test.report', { build: () => new Promise(() => {}) })
  const res = await r.refresh({ force: true, waitMs: 5000 })
  assert.match(res.status.lastError, /Gave up after 3 s/)
  assert.equal(fs.existsSync(r.lockFile), false)
})

// ---------------------------------------------------------------------------
// Version check (kept), C1-C5, D1, D3, D4: report cache

test('keep: a file with another version is rebuilt, not misread', async () => {
  const { ctx, dir } = tmpDir()
  fs.writeFileSync(path.join(dir, 'r.json'), JSON.stringify({ version: 1, builtAt: new Date().toISOString(), value: 'old format' }))
  const r = cache.report(ctx, 'test.report', { build: async () => 'new' })
  assert.equal((await r.read()).value, undefined)
  assert.equal((await r.refresh()).value, 'new')
})

test('C3: reading never builds; C2: the result carries its age and goes stale after its limit', async () => {
  const { ctx } = tmpDir()
  const c = clock()
  let builds = 0
  const r = cache.report(ctx, 'test.report', { now: c.now, build: async () => ++builds })
  const empty = await r.read()
  assert.equal(empty.value, undefined)
  assert.equal(empty.status.stale, true)
  assert.equal(builds, 0)

  await r.refresh({ force: true })
  c.advance(5 * MIN)
  let s = (await r.read()).status
  assert.equal(s.ageMs, 5 * MIN)
  assert.equal(s.stale, false)
  c.advance(5 * MIN)
  s = (await r.read()).status
  assert.equal(s.stale, true)
  assert.equal(builds, 1)
})

test('C1/D4: a failed build keeps the last good result, says why, and retries no sooner than its interval', async () => {
  const { ctx } = tmpDir()
  const c = clock()
  let fail = false
  let builds = 0
  const r = cache.report(ctx, 'test.report', {
    now: c.now,
    build: async () => {
      builds++
      if (fail) throw new Error('sign-in expired')
      return 'good'
    },
  })
  await r.refresh({ force: true })
  c.advance(11 * MIN)
  fail = true
  const res = await r.refresh()
  assert.equal(builds, 2)
  assert.equal(res.value, 'good', 'last good result stays')
  assert.equal(res.status.lastError, 'sign-in expired')
  assert.equal(res.status.nextRetryAt, new Date(c.now() + HOUR).toISOString())

  // Within the hour neither a page nor the schedule runs it again.
  c.advance(30 * MIN)
  await r.refresh()
  assert.equal(await r.due(), false)
  assert.equal(builds, 2)

  // C5: the Refresh button bypasses the wait.
  fail = false
  const forced = await r.refresh({ force: true })
  assert.equal(builds, 3)
  assert.equal(forced.status.lastError, undefined)
  assert.equal(forced.status.nextRetryAt, undefined)

  // After the interval the schedule tries again.
  fail = true
  c.advance(11 * MIN)
  await r.refresh()
  c.advance(HOUR)
  assert.equal(await r.due(), true)
})

test('C1: the backoff survives a restart (kept on disk)', async () => {
  const { ctx } = tmpDir()
  const c = clock()
  const r1 = cache.report(ctx, 'test.report', { now: c.now, build: async () => { throw new Error('boom') } })
  await r1.refresh()
  let builds = 0
  const r2 = cache.report(ctx, 'test.report', { now: c.now, build: async () => ++builds })
  await r2.refresh()
  assert.equal(builds, 0)
  assert.equal((await r2.read()).status.lastError, 'boom')
})

test('C4: the schedule rebuilds a due cache; the old result stays readable until the new one is written', async () => {
  const { ctx } = tmpDir()
  const c = clock()
  let release
  let n = 0
  const r = cache.report(ctx, 'test.report', {
    now: c.now,
    build: async () => {
      n++
      if (n > 1) await new Promise((res) => (release = res))
      return n
    },
  })
  await r.refresh({ force: true })
  assert.equal(await r.due(), false)
  c.advance(10 * MIN)
  assert.equal(await r.due(), true)
  cache.schedule(r, { tickMs: 1e9, firstDelayMs: 1e9 })
  const tick = cache.runDue()
  await sleep(50)
  const during = await r.read()
  assert.equal(during.value, 1)
  assert.equal(during.status.building, true)
  release()
  await tick
  await r.running
  assert.equal((await r.read()).value, 2)
  cache.stopSchedule()
})

test('D1: a build writes the module summary; Home reads only summary files', async () => {
  const { ctx, root } = tmpDir()
  const r = cache.report(ctx, 'test.report', {
    build: async () => ({ total: 12.5, rows: new Array(1000).fill(1) }),
    onBuilt: (v, builtAt) => cache.writeSummary(ctx, 'test.summary', { total: v.total }, { builtAt }),
  })
  await r.refresh({ force: true })
  const summary = JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'summary.json'), 'utf8'))
  assert.deepEqual(summary.summary, { total: 12.5 })
  // readSummaries only knows declared (non-test) summaries; the file shape is what Home reads.
  assert.deepEqual(await cache.readSummaries(root), {})
})

test('D1: Home reads the Claude Stats summary without building anything', async () => {
  const { root, ctx } = tmpDir('modules/claude-stats')
  await cache.writeSummary(ctx, 'claude-stats.summary', { total: 3 }, { builtAt: new Date().toISOString() })
  const home = require('../modules/home.cjs')
  const out = await home.methods.getSummaries({ rootDir: root })
  assert.deepEqual(out['claude-stats.summary'].summary, { total: 3 })
  assert.equal(out['claude-stats.summary'].stale, false)
})

test('D3: a saved reading is shown with its time and only retaken when asked', async () => {
  const { ctx } = tmpDir()
  const c = clock()
  let takes = 0
  const r = cache.report(ctx, 'test.reading', { now: c.now, build: async () => ({ processes: ++takes }) })
  await r.refresh({ force: true })
  c.advance(30 * 24 * HOUR)
  const later = await r.refresh() // not forced: never retaken on its own
  assert.equal(takes, 1)
  assert.equal(later.status.stale, false)
  assert.ok(later.status.builtAt)
  await r.refresh({ force: true })
  assert.equal(takes, 2)
})

// ---------------------------------------------------------------------------
// B1-B3: keyed checks and lists

test('B1: a check is reused 15 minutes after success and 2 minutes after failure', async () => {
  const c = clock()
  const k = new KeyedCache('test.check', { now: c.now })
  let runs = 0
  let state = 'error'
  const check = async () => (runs++, { state })
  const failed = (v) => v.state !== 'ok'
  await k.get('gmail', check, { failed })
  c.advance(1 * MIN)
  await k.get('gmail', check, { failed })
  assert.equal(runs, 1)
  c.advance(1 * MIN)
  state = 'ok'
  assert.equal((await k.get('gmail', check, { failed })).state, 'ok')
  assert.equal(runs, 2)
  c.advance(14 * MIN)
  await k.get('gmail', check, { failed })
  assert.equal(runs, 2)
  c.advance(1 * MIN)
  await k.get('gmail', check, { failed })
  assert.equal(runs, 3)
})

test('B2: editing the definition discards the old result at once; only a hash is kept', async () => {
  const k = new KeyedCache('test.check')
  let runs = 0
  const check = async () => ++runs
  await k.get('jira', check, { definition: { site: 'a.example', token: 'secret-1' } })
  await k.get('jira', check, { definition: { token: 'secret-1', site: 'a.example' } }) // same, keys reordered
  assert.equal(runs, 1)
  await k.get('jira', check, { definition: { site: 'b.example', token: 'secret-1' } })
  assert.equal(runs, 2)
  assert.ok(!JSON.stringify([...k.entries.values()]).includes('secret-1'))
})

test('B3: invalidate clears a cached list at once', async () => {
  const k = new KeyedCache('test.check')
  let runs = 0
  const list = async () => ++runs
  await k.get('recent', list)
  await k.get('recent', list)
  k.invalidate('recent')
  await k.get('recent', list)
  assert.equal(runs, 2)
})

test('A4: concurrent gets for one key share one check; a thrown failure is cached too', async () => {
  const c = clock()
  const k = new KeyedCache('test.check', { now: c.now })
  let runs = 0
  const slow = async () => {
    runs++
    await sleep(30)
    throw new Error('down')
  }
  const results = await Promise.allSettled([k.get('x', slow), k.get('x', slow)])
  assert.equal(runs, 1)
  assert.ok(results.every((r) => r.status === 'rejected'))
  await assert.rejects(k.get('x', slow), /down/)
  assert.equal(runs, 1)
  assert.equal(k.status('x').ok, false)
  assert.equal(k.status('x').ttlMs, 2 * MIN)
})

// ---------------------------------------------------------------------------
// B4: incremental reads

function lineCounter(seen) {
  return {
    init: () => ({ lines: 0, last: null }),
    reduce: (s, lines) => {
      seen.push(...lines)
      return { lines: s.lines + lines.length, last: lines.at(-1) ?? s.last }
    },
  }
}

test('B4: a growing file is parsed only from the byte offset reached', async () => {
  const { ctx, dir } = tmpDir('test/inc')
  const log = path.join(dir, '..', 'session.jsonl')
  const seen = []
  const inc = cache.incremental(ctx, 'test.inc', lineCounter(seen))
  fs.writeFileSync(log, '{"a":1}\n{"a":2}\n')
  assert.equal((await inc.read('s1', log)).lines, 2)
  fs.appendFileSync(log, '{"a":3}\n{"a":')
  assert.equal((await inc.read('s1', log)).lines, 3)
  assert.deepEqual(seen, ['{"a":1}', '{"a":2}', '{"a":3}'], 'only new complete lines were parsed')
  fs.appendFileSync(log, '4}\n')
  const s = await inc.read('s1', log)
  assert.equal(s.lines, 4)
  assert.equal(s.last, '{"a":4}', 'an unfinished line is read whole next time')
  assert.equal(seen.length, 4)
  // Unchanged file: nothing parsed.
  await inc.read('s1', log)
  assert.equal(seen.length, 4)
})

test('B4: a file that shrinks, or whose start changed, is read again from the start', async () => {
  const { ctx, dir } = tmpDir('test/inc')
  const log = path.join(dir, '..', 'b.jsonl')
  const seen = []
  const inc = cache.incremental(ctx, 'test.inc', lineCounter(seen))
  fs.writeFileSync(log, 'one\ntwo\nthree\n')
  await inc.read('k', log)
  fs.writeFileSync(log, 'new\n')
  assert.equal((await inc.read('k', log)).lines, 1)
  fs.writeFileSync(log, 'NEW\nmore\nlines\nthan before\n') // same start length, different bytes, longer
  assert.equal((await inc.read('k', log)).lines, 4)
})

test('B4: the state survives a restart and an older format is rebuilt', async () => {
  const { ctx, dir } = tmpDir('test/inc')
  const log = path.join(dir, '..', 'c.jsonl')
  fs.writeFileSync(log, 'a\nb\n')
  const first = cache.incremental(ctx, 'test.inc', lineCounter([]))
  await first.read('k', log)
  await first.flush()

  const seen = []
  const again = cache.incremental(ctx, 'test.inc', lineCounter(seen))
  fs.appendFileSync(log, 'c\n')
  assert.equal((await again.read('k', log)).lines, 3)
  assert.deepEqual(seen, ['c'], 'resumed from the saved offset')

  const seen2 = []
  const newer = cache.incremental(ctx, 'test.inc2', lineCounter(seen2)) // version 2, same file
  assert.equal((await newer.read('k', log)).lines, 3)
  assert.deepEqual(seen2, ['a', 'b', 'c'], 'version 1 state was not reused')
})

// ---------------------------------------------------------------------------
// D2: snapshots

test('D2: snapshots answer what changed since the previous scan, with a CSV history', async () => {
  const { ctx, dir } = tmpDir('test/hist')
  const c = clock()
  const h = cache.history(ctx, 'test.history', { now: c.now })
  for (const used of [10, 12, 15, 20]) {
    await h.add({ used }, { csvRow: { used, note: 'a, "quoted" note' } })
    c.advance(3 * 24 * HOUR)
  }
  const { current, previous } = await h.lastTwo()
  assert.equal(current.data.used - previous.data.used, 5)
  assert.equal((await h.list()).length, 3, 'keeps the newest N')
  const csv = fs.readFileSync(path.join(dir, 'disk.csv'), 'utf8').trim().split('\n')
  assert.equal(csv.length, 5)
  assert.equal(csv[0], 'takenAt,used,note')
  assert.ok(csv[1].endsWith(',10,"a, ""quoted"" note"'))
  assert.deepEqual(await cache.auditDataDir('test/hist', dir), [])
})

test('caches refuse a data folder that is not their own', () => {
  const { ctx } = tmpDir('apps/jira-plus')
  assert.throws(() => cache.report(ctx, 'claude-stats.usage', { build: async () => 1 }), /belongs to modules\/claude-stats/)
  assert.throws(() => new HistoryCache(ctx.dataDir, 'test.report'), /not a history cache/)
  assert.throws(() => new IncrementalCache(ctx.dataDir, 'test.report', lineCounter([])), /not an incremental cache/)
})
