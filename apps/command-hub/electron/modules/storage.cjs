// Storage Manager backend (Utilities > Storage): how full each drive is, and
// what MonoRail, agents, developer caches and a few well-known folders take up.
//
// Read-only by design. Nothing here deletes, moves, renames or copies a file
// or folder it measures. Drives are read on request (and sampled every few
// hours while the app runs), the folder scan runs only when the user asks
// (startScan), and the only things written are the history snapshot in this
// module's own data folder, through the shared cache primitive, and the
// free-space goals the user sets (storage-goals.cjs). The only
// actions open a folder in Explorer or the Windows storage settings, both by
// location id, never by a path from the page.
// Folder contents are never read, only names and sizes; links and junctions
// are counted as entries but never followed.

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

/** One location may take this long before its total is reported as "at least". */
const LOCATION_BUDGET_MS = 45_000
/** Locations measured at once, and directory reads in flight per location. */
const LOCATION_CONCURRENCY = 3
const DIR_CONCURRENCY = 8
/** Largest children kept for a location with a breakdown. */
const TOP_CHILDREN = 8
/** A drive that does not answer in time (a sleeping network share) is skipped. */
const DRIVE_TIMEOUT_MS = 3_000

/**
 * The locations to measure. Built from environment folders only, so nothing
 * user-specific is hard-coded. `advice`: 'safe' (a cache the tool rebuilds),
 * 'review' (may hold things you want) or 'keep' (in use, leave alone).
 */
function locations({ home = os.homedir(), env = process.env, platform = process.platform, rootDir, execPath = process.execPath, isPackaged = false } = {}) {
  const win = platform === 'win32'
  const appData = env.APPDATA || (win ? path.join(home, 'AppData', 'Roaming') : path.join(home, '.config'))
  const localAppData = env.LOCALAPPDATA || (win ? path.join(home, 'AppData', 'Local') : path.join(home, '.cache'))
  const list = []
  const add = (group, id, label, p, extra = {}) => p && list.push({ group, id, label, path: p, kind: 'dir', breakdown: false, advice: 'review', ...extra })

  // MonoRail itself.
  if (rootDir) {
    add('monorail', 'monorail-data', 'MonoRail data (in use)', rootDir, {
      breakdown: true,
      advice: 'keep',
      note: 'Settings, chat state, caches and extension data. MonoRail never moves or deletes this folder.',
    })
    // Data folders from earlier names (see electron/userData.cjs). Only listed.
    const parent = path.dirname(rootDir)
    for (const [name, key] of [['MonoRail', 'monorail'], ['MonoHub', 'monohub'], ['command-hub', 'command-hub'], ['Command Hub', 'command-hub-spaced']]) {
      const p = path.join(parent, name)
      if (samePath(p, rootDir)) continue
      add('monorail', `old-data-${key}`, `Older data folder: ${name}`, p, {
        breakdown: true,
        note: 'Not the folder MonoRail uses now. It is kept exactly as it was; look inside before removing anything.',
      })
    }
    const dev = path.join(parent, 'MonoRail Dev')
    if (!samePath(dev, rootDir)) add('monorail', 'dev-data', 'MonoRail Dev data', dev, { note: 'Used by npm run dev:browser.' })
  }
  if (isPackaged) add('monorail', 'install', 'MonoRail app', path.dirname(execPath), { advice: 'keep', note: 'The installed program. Remove it with Windows "Installed apps".' })
  add('monorail', 'updater', 'Downloaded updates', path.join(localAppData, 'command-hub-updater'), {
    advice: 'safe',
    note: 'Installers the updater downloaded. Safe to clear when no update is waiting to install.',
  })

  // Agents.
  add('agents', 'claude-code', 'Claude Code', path.join(home, '.claude'), {
    breakdown: true,
    note: 'Config and session logs. Chat and Claude Stats read the logs in projects/.',
  })
  if (win) {
    add('agents', 'claude-desktop', 'Claude desktop app', path.join(appData, 'Claude'), {
      breakdown: true,
      note: "Claude desktop's own data, including a local VM image if you use Cowork. Manage it from Claude's settings.",
    })
  }
  add('agents', 'pi', 'pi coding agent', env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent'), { breakdown: true, note: 'Settings, skills and session logs.' })
  add('agents', 'repos', 'Repos folder', path.join(home, 'Repos'), { breakdown: true, note: 'Your git repos. node_modules and build output inside them can be rebuilt.' })

  // Developer caches: each tool re-downloads what it needs.
  const cache = (id, label, p, tip, advice = 'safe') => add('dev', id, label, p, { advice, tip })
  cache('npm-cache', 'npm cache', win ? path.join(localAppData, 'npm-cache') : path.join(home, '.npm'), 'npm cache clean --force')
  cache('pnpm-store', 'pnpm store', win ? path.join(localAppData, 'pnpm', 'store') : path.join(home, '.local', 'share', 'pnpm', 'store'), 'pnpm store prune')
  cache('yarn-cache', 'Yarn cache', win ? path.join(localAppData, 'Yarn', 'Cache') : path.join(localAppData, 'yarn'), 'yarn cache clean')
  cache('bun-cache', 'Bun cache', path.join(home, '.bun', 'install', 'cache'), 'bun pm cache rm')
  cache('pip-cache', 'pip cache', win ? path.join(localAppData, 'pip', 'Cache') : path.join(localAppData, 'pip'), 'pip cache purge')
  cache('playwright', 'Playwright browsers', path.join(localAppData, 'ms-playwright'), 'npx playwright uninstall --all', 'review')
  cache('electron-cache', 'Electron downloads', win ? path.join(localAppData, 'electron', 'Cache') : path.join(localAppData, 'electron'), undefined)
  cache('electron-builder-cache', 'electron-builder cache', win ? path.join(localAppData, 'electron-builder', 'Cache') : path.join(localAppData, 'electron-builder'), undefined)

  // Your folders and the system.
  add('system', 'temp', 'Temporary files', os.tmpdir(), {
    advice: 'safe',
    note: win ? 'Windows Settings > System > Storage > Temporary files clears these safely.' : 'Cleared by the system.',
  })
  add('system', 'downloads', 'Downloads', path.join(home, 'Downloads'), { breakdown: true, note: 'Old installers and archives often pile up here.' })
  if (win) {
    const sys = `${(env.SystemDrive || 'C:').replace(/\\$/, '')}\\`
    add('system', 'hiberfil', 'Hibernation file', path.join(sys, 'hiberfil.sys'), {
      kind: 'file',
      advice: 'keep',
      note: 'Used by hibernate and Fast Startup. An administrator can remove it with: powercfg /hibernate off',
    })
    add('system', 'pagefile', 'Page file', path.join(sys, 'pagefile.sys'), { kind: 'file', advice: 'keep', note: 'Virtual memory, managed by Windows.' })
  }
  return list
}

function samePath(a, b) {
  const n = (p) => path.resolve(p).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b)
}

/**
 * Total size of a folder: bytes, files and folders, never following links or
 * junctions. With `byChild`, also the largest top-level children. Stops at
 * `deadline` and says so (`truncated`); unreadable folders are counted in
 * `skipped`, not fatal.
 */
async function measure(dir, { deadline = Date.now() + LOCATION_BUDGET_MS, byChild = false, concurrency = DIR_CONCURRENCY } = {}) {
  const result = { bytes: 0, files: 0, dirs: 0, skipped: 0, truncated: false }
  const children = new Map()
  const credit = (child, bytes) => {
    if (child === undefined) return
    const c = children.get(child)
    if (c) c.bytes += bytes
  }
  // Each item: [path, top-level child name or undefined].
  const queue = [[dir, undefined]]
  let active = 0

  await new Promise((resolve) => {
    const pump = () => {
      if (queue.length === 0 && active === 0) return resolve()
      while (active < concurrency && queue.length > 0) {
        if (Date.now() > deadline) {
          result.truncated = true
          queue.length = 0
          break
        }
        const [p, child] = queue.pop()
        active++
        readOne(p, child).finally(() => {
          active--
          pump()
        })
      }
      if (queue.length === 0 && active === 0) resolve()
    }

    async function readOne(p, child) {
      let entries
      try {
        entries = await fsp.readdir(p, { withFileTypes: true })
      } catch {
        result.skipped++
        return
      }
      const top = p === dir
      const files = []
      for (const e of entries) {
        const full = path.join(p, e.name)
        const owner = top ? e.name : child
        if (top && byChild) children.set(e.name, { name: e.name, bytes: 0, kind: e.isDirectory() && !e.isSymbolicLink() ? 'dir' : 'file' })
        if (e.isSymbolicLink()) continue
        if (e.isDirectory()) {
          result.dirs++
          queue.push([full, owner])
        } else if (e.isFile()) {
          files.push([full, owner])
        }
      }
      // lstat in small batches: one per file is the slow part.
      for (let i = 0; i < files.length; i += 64) {
        if (Date.now() > deadline) {
          result.truncated = true
          return
        }
        const stats = await Promise.all(files.slice(i, i + 64).map(([f]) => fsp.lstat(f).catch(() => null)))
        stats.forEach((st, j) => {
          if (!st) return
          result.files++
          result.bytes += st.size
          credit(files[i + j][1], st.size)
        })
      }
    }

    pump()
  })

  if (byChild) {
    result.children = [...children.values()].filter((c) => c.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, TOP_CHILDREN)
    result.childCount = children.size
  }
  return result
}

async function measureLocation(loc, opts = {}) {
  const base = { id: loc.id, group: loc.group, label: loc.label, path: loc.path, kind: loc.kind, advice: loc.advice, note: loc.note, tip: loc.tip }
  try {
    const st = await fsp.lstat(loc.path)
    if (loc.kind === 'file') return { ...base, exists: true, bytes: st.size, files: 1 }
    if (!st.isDirectory()) return { ...base, exists: false }
  } catch (e) {
    // A system file Windows holds open may refuse stat: say it exists, size unknown.
    if (loc.kind === 'file' && e && e.code === 'EBUSY') return { ...base, exists: true }
    return { ...base, exists: false }
  }
  const m = await measure(loc.path, { byChild: loc.breakdown, ...opts })
  return { ...base, exists: true, ...m }
}

function withTimeout(promise, ms) {
  let timer
  return Promise.race([promise, new Promise((resolve) => (timer = setTimeout(() => resolve(null), ms)))]).finally(() => clearTimeout(timer))
}

async function statDrive(root) {
  try {
    const s = await fsp.statfs(root)
    const total = Number(s.blocks) * Number(s.bsize)
    const free = Number(s.bavail) * Number(s.bsize)
    if (!total) return null
    return { total, free, used: Math.max(0, total - Number(s.bfree) * Number(s.bsize)) }
  } catch {
    return null
  }
}

/** Every mounted drive with its size and free space. */
async function listDrives({ platform = process.platform, env = process.env, home = os.homedir(), rootDir } = {}) {
  if (platform === 'win32') {
    const systemDrive = (env.SystemDrive || 'C:').toUpperCase().replace(/\\$/, '')
    const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const found = await Promise.all(
      letters.map(async (l) => {
        const root = `${l}:\\`
        const s = await withTimeout(statDrive(root), DRIVE_TIMEOUT_MS)
        if (!s) return null
        const id = `${l}:`
        return { id, path: root, ...s, system: id === systemDrive, holdsData: !!rootDir && rootDir.toUpperCase().startsWith(id) }
      }),
    )
    return found.filter(Boolean)
  }
  // Elsewhere: the root and the home folder's volume, once each.
  const out = []
  const seen = new Set()
  for (const [p, system] of [['/', true], [home, false]]) {
    let dev
    try {
      dev = fs.statSync(p).dev
    } catch {
      continue
    }
    if (seen.has(dev)) continue
    seen.add(dev)
    const s = await statDrive(p)
    if (s) out.push({ id: p, path: p, ...s, system, holdsData: !!rootDir && rootDir.startsWith(p === '/' ? '/' : p) })
  }
  return out
}

// ---- History (modules/storage/history.json) ---------------------------------
//
// Each finished scan is saved as a snapshot (drives + every measured location),
// and while the app runs a drives-only sample is added when the newest
// snapshot is older than DRIVE_SAMPLE_MS. Only numbers, the location list the
// page already shows and its local paths; never file names deeper than a
// location's largest children. Declared as the 'storage.history' cache.

const cache = require('../cache/index.cjs')
// Free-space goals live in their own file (storage-goals.cjs), so this file stays write-free.
const { goalsView, setGoal } = require('./storage-goals.cjs')

const HISTORY_ID = 'storage.history'
/** A drives-only sample is due when the newest snapshot is this old. */
const DRIVE_SAMPLE_MS = 6 * 60 * 60 * 1000
const SAMPLE_CHECK_MS = 60 * 60 * 1000

function history(ctx) {
  return cache.history(ctx, HISTORY_ID)
}

const driveFacts = (drives) => drives.map((d) => ({ id: d.id, total: d.total, free: d.free }))

/** What a location keeps in history: the row the page draws, nothing more. */
function savedLocation(l) {
  const { id, group, label, path: p, kind, advice, note, tip, bytes, files, dirs, skipped, truncated, children, childCount } = l
  return { id, group, label, path: p, kind, advice, note, tip, exists: true, bytes, files, dirs, skipped, truncated, children, childCount }
}

async function saveScan(ctx, result) {
  const drives = await listDrives({ rootDir: ctx.machineDir ?? ctx.rootDir }).catch(() => [])
  await history(ctx).add({ kind: 'scan', tookMs: result.tookMs, drives: driveFacts(drives), locations: result.locations.map(savedLocation) })
}

async function sampleDrives(ctx, { now = Date.now() } = {}) {
  const h = history(ctx)
  const latest = await h.latest()
  if (latest && now - Date.parse(latest.takenAt) < DRIVE_SAMPLE_MS) return false
  const drives = await listDrives({ rootDir: ctx.machineDir ?? ctx.rootDir })
  if (!drives.length) return false
  await h.add({ kind: 'drives', drives: driveFacts(drives) })
  return true
}

/** The page's over-time view: every snapshot, oldest first, sizes only. */
async function historyView(ctx) {
  const all = await history(ctx).list()
  return {
    sampleEveryMs: DRIVE_SAMPLE_MS,
    snapshots: all.map(({ takenAt, data }) => ({
      takenAt,
      kind: data.kind,
      drives: data.drives ?? [],
      locations: data.kind === 'scan' ? (data.locations ?? []).map((l) => ({ id: l.id, label: l.label, group: l.group, bytes: l.bytes, truncated: !!l.truncated })) : undefined,
    })),
  }
}

/** Sizes from the scan before the one shown, for "+1.2 GB since <date>". */
function previousSizes(scans, shownAt) {
  const before = scans.filter((s) => s.takenAt < shownAt).at(-1)
  if (!before) return undefined
  return { takenAt: before.takenAt, sizes: Object.fromEntries(before.data.locations.filter((l) => l.bytes !== undefined).map((l) => [l.id, l.bytes])) }
}

// ---- The scan job (memory, plus the saved snapshot above) ---------------------

let scan = { state: 'idle' }
/** Set once the last saved scan has been read back after a restart. */
let restored = false

async function restoreLastScan(ctx) {
  if (restored || scan.state !== 'idle') return
  restored = true
  const scans = (await history(ctx).list()).filter((s) => s.data.kind === 'scan')
  const last = scans.at(-1)
  if (last && scan.state === 'idle') {
    scan = { state: 'done', finishedAt: last.takenAt, tookMs: last.data.tookMs, saved: true, locations: last.data.locations }
  }
}

async function scanView(ctx) {
  const view = { ...scan, locations: scan.locations ? [...scan.locations] : undefined }
  if (view.finishedAt && view.locations) {
    try {
      const scans = (await history(ctx).list()).filter((s) => s.data.kind === 'scan')
      view.previous = previousSizes(scans, view.finishedAt)
    } catch {
      /* history unreadable: no deltas */
    }
  }
  return view
}

async function runScan(locs) {
  const results = []
  let next = 0
  const worker = async () => {
    while (next < locs.length) {
      const loc = locs[next++]
      scan.current = [...(scan.current ?? []), loc.label]
      const r = await measureLocation(loc, { deadline: Date.now() + LOCATION_BUDGET_MS }).catch(() => ({ id: loc.id, group: loc.group, label: loc.label, path: loc.path, exists: false }))
      scan.current = scan.current.filter((l) => l !== loc.label)
      scan.done++
      if (r.exists) results.push(r)
    }
  }
  await Promise.all(Array.from({ length: LOCATION_CONCURRENCY }, worker))
  return results
}

function startScan(ctx) {
  if (scan.state === 'running') return
  restored = true
  const locs = locations({ rootDir: ctx.machineDir ?? ctx.rootDir, isPackaged: ctx.isPackaged })
  const previous = scan.state === 'done' ? scan : undefined
  scan = { state: 'running', startedAt: new Date().toISOString(), done: 0, total: locs.length, current: [] }
  // Keep showing the last result while the new one runs.
  if (previous) scan.locations = previous.locations
  const started = Date.now()
  runScan(locs)
    .then(async (results) => {
      const done = { state: 'done', startedAt: scan.startedAt, finishedAt: new Date().toISOString(), tookMs: Date.now() - started, done: locs.length, total: locs.length, locations: results }
      try {
        await saveScan(ctx, done)
      } catch (e) {
        ctx.log('could not save the scan to history:', e && e.message)
        done.notSaved = true
      }
      scan = done
    })
    .catch((e) => {
      ctx.log('scan failed:', e && e.message)
      scan = { state: 'error', error: 'The scan stopped unexpectedly.', locations: scan.locations }
    })
}

/** A location from the scan shown, by id; the page never hands over a path. */
function scannedLocation(id) {
  if (typeof id !== 'string') return undefined
  return scan.locations?.find((l) => l.id === id)
}

module.exports = {
  id: 'storage',
  /** Drive samples while the app runs (cheap: one statfs per drive). Folder scans only run when asked. */
  start(ctx) {
    const tick = () => void sampleDrives(ctx).catch((e) => ctx.log('drive sample failed:', e && e.message))
    setTimeout(tick, 60 * 1000).unref?.()
    setInterval(tick, SAMPLE_CHECK_MS).unref?.()
  },
  methods: {
    async getDrives(ctx) {
      const [drives, goals] = await Promise.all([listDrives({ rootDir: ctx.machineDir ?? ctx.rootDir }), goalsView(ctx.dataDir)])
      return { platform: process.platform, drives, ...goals }
    },
    /** Set or clear a drive's free-space goal: `{ drive: 'C:', freeBytes: number | null }`. */
    async setGoal(ctx, args) {
      const drives = await listDrives({ rootDir: ctx.machineDir ?? ctx.rootDir })
      const goals = await setGoal(ctx.dataDir, { drive: args?.drive, freeBytes: args?.freeBytes ?? null }, drives.map((d) => d.id))
      return { goals }
    },
    async getScan(ctx) {
      await restoreLastScan(ctx).catch(() => {})
      return scanView(ctx)
    },
    async startScan(ctx) {
      startScan(ctx)
      return scanView(ctx)
    },
    getHistory(ctx) {
      return historyView(ctx)
    },
    async openLocation(_ctx, args) {
      const loc = scannedLocation(args && args.id)
      if (!loc) throw new Error('Scan again, then open the folder.')
      const { shell } = require('electron')
      if (loc.kind === 'file') {
        shell.showItemInFolder(loc.path)
        return { ok: true }
      }
      const err = await shell.openPath(loc.path)
      if (err) throw new Error(err)
      return { ok: true }
    },
    async openStorageSettings() {
      if (process.platform !== 'win32') throw new Error('Only on Windows.')
      const { shell } = require('electron')
      await shell.openExternal('ms-settings:storagesense')
      return { ok: true }
    },
  },
  // For tests.
  _internal: { locations, measure, measureLocation, listDrives, sampleDrives, saveScan, historyView, previousSizes, DRIVE_SAMPLE_MS },
}
