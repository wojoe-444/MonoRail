// Snapshots of a periodic scan (tier 'history', D2), e.g. disk usage every 3
// days. Each scan adds one snapshot; the newest `keep` are kept, so the page can
// say what changed since the previous scan. Optional CSV history: one row per
// scan in <name>.csv next to the file, appended and never rewritten.
//
// Unlike the other tiers this is not rebuildable: deleting it loses history.

const fs = require('node:fs/promises')
const path = require('node:path')

const { declaration } = require('./declared.cjs')
const { readJson, writeJsonAtomic } = require('./files.cjs')

class HistoryCache {
  /** @param {string} dir @param {string} id @param {{ now?: () => number }} [opts] */
  constructor(dir, id, opts = {}) {
    const d = declaration(id)
    if (d.tier !== 'history' || d.storage !== 'disk') throw new Error(`${id} is not a history cache`)
    this.decl = d
    this.file = path.join(dir, d.file)
    this.csvFile = path.join(dir, d.file.replace(/\.[^.]+$/, '') + '.csv')
    this.now = opts.now ?? Date.now
    this.lock = Promise.resolve()
  }

  /** All snapshots, oldest first: [{ takenAt, data }]. */
  async list() {
    const disk = await readJson(this.file)
    return disk?.version === this.decl.version && Array.isArray(disk.snapshots) ? disk.snapshots : []
  }

  async latest() {
    return (await this.list()).at(-1)
  }

  /** The newest snapshot and the one before it, for "what changed since the last scan". */
  async lastTwo() {
    const all = await this.list()
    return { current: all.at(-1), previous: all.at(-2) }
  }

  /**
   * Save a snapshot. `csvRow` (optional) is an object whose keys are the CSV
   * columns; the header is written with the first row.
   */
  add(data, { csvRow } = {}) {
    const job = this.lock.then(async () => {
      const takenAt = new Date(this.now()).toISOString()
      const snapshots = [...(await this.list()), { takenAt, data }].slice(-(this.decl.keep ?? 30))
      await writeJsonAtomic(this.file, { version: this.decl.version, snapshots })
      if (csvRow) await appendCsv(this.csvFile, { takenAt, ...csvRow })
      return { takenAt, data }
    })
    this.lock = job.catch(() => {})
    return job
  }
}

function csvCell(v) {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function appendCsv(file, row) {
  const cols = Object.keys(row)
  let header = ''
  try {
    await fs.access(file)
  } catch {
    header = cols.map(csvCell).join(',') + '\n'
  }
  await fs.appendFile(file, header + cols.map((c) => csvCell(row[c])).join(',') + '\n')
}

module.exports = { HistoryCache, csvCell }
