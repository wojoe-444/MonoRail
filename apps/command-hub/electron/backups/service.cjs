// The global backup schedule: backs up the pages that have no schedule of their
// own (Tasks private projects, Flashcards, Notes) into <global folder>/<page id>/ at
// the global frequency. GitHub+ repos run on GitHub+'s own per-repo scheduler
// (electron/apps/github-plus/backup.cjs), which reads the same settings.
//
// Each backup is written as <name>.partial and renamed when complete, so a
// synced folder never uploads half a file; the newest `keep` of that page's
// own backup files are kept and older ones deleted. Nothing else in the folder
// is ever touched. Run state lives in modules/backups/state.json.
//
// Before an update installs, runBeforeUpdate() backs up every item (whatever
// its own switch says) into <global folder>/before-update/, keeping the newest
// few of each. It only runs when the global folder and "Back up before
// updating" are both on; otherwise it reports why it skipped and the update
// goes ahead.
//
// No Electron here (tests run it under Node).

const fs = require('node:fs/promises')
const path = require('node:path')

const { writeAtomic } = require('../cache/files.cjs')
const {
  GLOBAL_ITEMS,
  PAGES,
  STATE_FILE,
  BEFORE_UPDATE_KEEP,
  globalDir,
  readGlobal,
  writeGlobal,
  pageRoot,
  beforeUpdateRoot,
} = require('./global.cjs')
const { nextDue, stamp, listBackups, prune, errorLine } = require('./schedule.cjs')

const CHECK_EVERY_MS = 60_000

/** How each page is backed up. `source` returns null when there is nothing to back up yet. */
const ITEMS = {
  'jira-plus': {
    prefix: 'jira-plus-projects-',
    suffix: '.bundle',
    async source(userData) {
      const { resolveJiraDataDir } = require('../apps/jira-plus/data-dir.cjs')
      const dir = path.join(resolveJiraDataDir(path.join(userData, 'apps', 'jira-plus')), 'local-repo')
      try {
        await fs.access(path.join(dir, '.git'))
        return dir
      } catch {
        return null
      }
    },
    async write(src, file) {
      // Every branch and the full history; restore with `git clone <file>`.
      await require('../apps/github-plus/git.cjs').createBundle(src, file)
    },
  },
  notes: {
    prefix: 'notes-',
    suffix: '.bundle',
    async source(userData) {
      const dir = path.join(userData, 'modules', 'notes', 'repo')
      try {
        await fs.access(path.join(dir, '.git'))
        return dir
      } catch {
        return null
      }
    },
    async write(src, file) {
      // Text saved in the last minute may not be committed yet; the next backup has it.
      await require('../apps/github-plus/git.cjs').createBundle(src, file)
    },
  },
  flows: {
    prefix: 'flows-',
    suffix: '.bundle',
    async source(userData) {
      const dir = path.join(userData, 'modules', 'flows', 'repo')
      try {
        await fs.access(path.join(dir, '.git'))
        return dir
      } catch {
        return null
      }
    },
    async write(src, file) {
      // A flow saved in the last minute may not be committed yet; the next backup has it.
      await require('../apps/github-plus/git.cjs').createBundle(src, file)
    },
  },
  flashcards: {
    prefix: 'flashcards-',
    suffix: '.json',
    async source(userData) {
      const file = path.join(userData, 'modules', 'flashcards', 'decks.json')
      try {
        await fs.access(file)
        return file
      } catch {
        return null
      }
    },
    async write(src, file) {
      // decks.json is replaced atomically, so one read sees a whole file. A
      // damaged file is not backed up: it would push good backups out.
      const raw = await fs.readFile(src)
      try {
        JSON.parse(raw.toString('utf8'))
      } catch {
        throw new Error('The flashcards file is damaged, so it was not backed up')
      }
      await fs.writeFile(file, raw)
    },
  },
}

function createGlobalBackups(userData, log = () => {}) {
  const running = new Set()
  let timer
  const stateFile = () => path.join(globalDir(userData), STATE_FILE)

  async function readState() {
    try {
      const s = JSON.parse(await fs.readFile(stateFile(), 'utf8'))
      return s && typeof s === 'object' && s.items ? s : { items: {} }
    } catch {
      return { items: {} }
    }
  }

  async function record(id, patch) {
    const s = await readState()
    s.items[id] = { ...(s.items[id] ?? {}), ...patch }
    await writeAtomic(stateFile(), JSON.stringify(s, null, 2))
  }

  /** The frequency to schedule `id` on, or null when it is off. */
  const frequencyFor = (g, id) => (g.enabled && g.items[id] ? g : null)

  /**
   * Write one backup of `item` into `root`: <prefix><stamp><tag><suffix>, as a
   * .partial renamed when complete, then keep the newest `keep`. Returns null
   * when there is nothing to back up yet.
   */
  async function writeOne(item, root, keep, tag = '') {
    const src = await item.source(userData)
    if (!src) return null
    await fs.mkdir(root, { recursive: true })
    const target = path.join(root, `${item.prefix}${stamp(new Date())}${tag}${item.suffix}`)
    const partial = target + '.partial'
    try {
      await item.write(src, partial)
      await fs.rename(partial, target)
    } finally {
      await fs.rm(partial, { force: true })
    }
    const st = await fs.stat(target)
    await prune(root, item.prefix, item.suffix, keep)
    return { file: target, size: st.size }
  }

  /** Back up one page now into <folder>/<id>/. */
  async function run(id) {
    const item = ITEMS[id]
    if (!item) throw new Error(`Unknown backup: ${id}`)
    if (running.has(id)) throw new Error('This backup is already running')
    const g = await readGlobal(userData)
    const root = pageRoot(g, id)
    if (!root) throw new Error('Turn on the global backup folder first')
    running.add(id)
    try {
      const written = await writeOne(item, root, g.keep)
      if (!written) {
        const result = { ok: true, skipped: true, at: new Date().toISOString() }
        await record(id, { lastAttemptAt: result.at, lastSuccessAt: result.at, lastResult: result })
        return result
      }
      const target = written.file
      const result = { ok: true, at: new Date().toISOString(), file: target, size: written.size }
      await record(id, { lastAttemptAt: result.at, lastSuccessAt: result.at, lastResult: result })
      log('backup ok', id, target)
      return result
    } catch (err) {
      const result = { ok: false, at: new Date().toISOString(), error: errorLine(err) }
      await record(id, { lastAttemptAt: result.at, lastResult: result })
      log('backup failed', id, result.error)
      throw new Error(result.error)
    } finally {
      running.delete(id)
    }
  }

  async function tick() {
    const g = await readGlobal(userData)
    if (!g.enabled) return
    const { items } = await readState()
    const now = Date.now()
    for (const id of GLOBAL_ITEMS) {
      const due = nextDue(frequencyFor(g, id), items[id])
      if (due && Date.parse(due) <= now && !running.has(id)) await run(id).catch(() => undefined)
    }
  }

  /** Repos in GitHub+'s schedules that follow the global folder or frequency (count only). */
  async function githubPlusFollowers() {
    try {
      const data = JSON.parse(await fs.readFile(path.join(userData, 'apps', 'github-plus', 'backups.json'), 'utf8'))
      return Object.values(data?.repos ?? {}).filter((e) => e?.schedule?.useGlobalFolder || e?.schedule?.useGlobalFrequency).length
    } catch {
      return 0
    }
  }

  /**
   * Back up every item into <folder>/before-update/ before an update installs.
   * `version` is the version about to be installed (only used in file names).
   * Resolves { ok, skipped?, at, folder?, items: [{ id, title, ok, file?, size?, skipped?, error? }] }:
   * skipped 'no-folder' / 'off' means nothing ran and the update may go ahead.
   * Never throws for a failed item; ok is false when any item failed.
   */
  async function runBeforeUpdate(version) {
    const g = await readGlobal(userData)
    const at = new Date().toISOString()
    if (!g.enabled || !g.folder) return { ok: true, skipped: 'no-folder', at, items: [] }
    const root = beforeUpdateRoot(g)
    if (!root) return { ok: true, skipped: 'off', at, items: [] }
    const tag = typeof version === 'string' && /^[0-9A-Za-z.-]{1,40}$/.test(version) ? `-before-${version}` : ''
    const items = []
    for (const id of GLOBAL_ITEMS) {
      const title = PAGES.find((p) => p.id === id)?.title ?? id
      try {
        const written = await writeOne(ITEMS[id], root, BEFORE_UPDATE_KEEP, tag)
        items.push(written ? { id, title, ok: true, ...written } : { id, title, ok: true, skipped: true })
      } catch (err) {
        items.push({ id, title, ok: false, error: errorLine(err) })
      }
    }
    const result = { ok: items.every((i) => i.ok), at, folder: root, items }
    try {
      const s = await readState()
      s.beforeUpdate = result
      await writeAtomic(stateFile(), JSON.stringify(s, null, 2))
    } catch {
      /* the result is still returned */
    }
    log(result.ok ? 'before-update backup ok' : 'before-update backup failed', root)
    return result
  }

  async function status() {
    const g = await readGlobal(userData)
    const { items, beforeUpdate } = await readState()
    const pages = []
    for (const p of PAGES) {
      const root = pageRoot(g, p.id)
      const entry = { id: p.id, title: p.title, what: p.what, folder: root }
      if (p.id === 'github-plus') {
        entry.repos = await githubPlusFollowers()
      } else {
        const item = ITEMS[p.id]
        const st = items[p.id] ?? {}
        entry.included = g.items[p.id]
        entry.lastResult = st.lastResult ?? null
        entry.nextDueAt = nextDue(frequencyFor(g, p.id), st) ?? null
        entry.running = running.has(p.id)
        entry.files = root ? (await listBackups(root, item.prefix, item.suffix)).length : 0
      }
      pages.push(entry)
    }
    return { settings: g, pages, lastBeforeUpdate: beforeUpdate ?? null }
  }

  return {
    status,
    async save(input) {
      await writeGlobal(userData, input)
      // A new setup may already be due: check soon.
      setTimeout(() => tick().catch(() => undefined), 2_000).unref?.()
      return status()
    },
    /** Back up every included page now. Failures are recorded per page and do not stop the others. */
    async runAll() {
      const g = await readGlobal(userData)
      if (!g.enabled) throw new Error('Turn on the global backup folder first')
      for (const id of GLOBAL_ITEMS) if (g.items[id]) await run(id).catch(() => undefined)
      return status()
    },
    run,
    runBeforeUpdate,
    tick,
    start() {
      if (timer) return
      setTimeout(() => tick().catch(() => undefined), 15_000).unref?.()
      timer = setInterval(() => tick().catch(() => undefined), CHECK_EVERY_MS)
      timer.unref?.()
    },
    stop() {
      clearInterval(timer)
      timer = undefined
    },
  }
}

module.exports = { createGlobalBackups, ITEMS }
